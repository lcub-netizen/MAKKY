import json
import logging
import re
import time
from datetime import datetime, timezone

from sqlalchemy import select

from app.database import SessionLocal, engine
from app.models import Task, TaskEvent
from app.services.router import chat_completion, stream_completion

logger = logging.getLogger(__name__)


def _extract_budget(prompt: str) -> float:
    match = re.search(r"\$?(\d+(?:\.\d+)?)", (prompt or ""))
    if not match:
        return 100.0
    return float(match.group(1))


def build_task_policy(prompt: str) -> dict:
    lowered = (prompt or "").lower()
    budget = _extract_budget(prompt)
    if any(term in lowered for term in ("crypto", "coin", "trading", "meme", "portfolio", "volatility", "risk", "trade", "forex")):
        return {
            "task_type": "trading",
            "risk_level": "high",
            "risk_limits": {
                "max_daily_loss_usd": min(100.0, max(10.0, budget * 0.08)),
                "max_drawdown_percent": 12,
                "max_position_ratio": 0.2,
                "max_positions": 3,
            },
            "browser_allowlist": [
                "finance.yahoo.com",
                "tradingview.com",
                "coinmarketcap.com",
                "broker dashboard",
            ],
            "blocked_actions": [
                "off-platform payment",
                "unapproved account changes",
                "unknown browser tabs",
            ],
            "required_approvals": [
                "risk guard review",
                "daily loss cap confirmation",
            ],
        }
    if any(term in lowered for term in ("sell", "sales", "listing", "product", "marketplace", "facebook", "ebay", "etsy", "shopify", "lead")):
        return {
            "task_type": "sales",
            "risk_level": "medium",
            "risk_limits": {
                "max_daily_loss_usd": min(250.0, max(25.0, budget * 0.25)),
                "max_ad_spend_usd": min(150.0, max(20.0, budget * 0.4)),
                "max_listing_variants": 5,
            },
            "browser_allowlist": [
                "facebook.com",
                "marketplace.facebook.com",
                "ebay.com",
                "etsy.com",
                "shopify.com",
            ],
            "blocked_actions": [
                "off-platform payment requests",
                "duplicate listings across unrelated categories",
                "spam outreach beyond approved channels",
            ],
            "required_approvals": [
                "listing compliance review",
                "channel spend approval",
            ],
        }
    return {
        "task_type": "operations",
        "risk_level": "low",
        "risk_limits": {
            "max_daily_loss_usd": 0.0,
            "max_output_minutes": 30,
        },
        "browser_allowlist": [
            "work domain only",
        ],
        "blocked_actions": [
            "external browsing beyond task scope",
            "personal data collection",
            "permissionless file downloads",
        ],
        "required_approvals": [
            "task-scope check",
            "final outcome review",
        ],
    }


def evaluate_agent_health(agent_scores: list[dict], policy: dict) -> dict:
    normalized = []
    for entry in agent_scores:
        score = float(entry.get("score", 0) or 0)
        risk_adherence = float(entry.get("risk_adherence", 0.0) or 0.0)
        if score < 70 or risk_adherence < 0.6:
            status = "pause"
        elif score < 85 or risk_adherence < 0.8:
            status = "monitor"
        else:
            status = "keep"
        normalized.append({
            "agent_id": entry.get("agent_id", "unknown"),
            "score": score,
            "risk_adherence": risk_adherence,
            "status": status,
        })

    if any(item["status"] == "pause" for item in normalized):
        recommended_action = "pause"
    elif any(item["status"] == "monitor" for item in normalized):
        recommended_action = "monitor"
    else:
        recommended_action = "keep"

    return {
        "recommended_action": recommended_action,
        "policy": policy,
        "agents": normalized,
    }


def build_agent_roles(prompt: str) -> list[tuple[str, str]]:
    lowered = (prompt or "").lower()
    if any(term in lowered for term in ("marketplace", "facebook", "fb", "lead", "sales", "prospect", "outreach", "listing")):
        return [
            ("kiki", "Growth strategist"),
            ("mimi", "Marketplace operations and outreach"),
            ("zazu", "Lead qualification and risk review"),
        ]
    if any(term in lowered for term in ("crypto", "coin", "trading", "meme", "portfolio", "volatility", "risk")):
        return [
            ("kiki", "Portfolio risk strategist"),
            ("mimi", "Market analyst and trade planner"),
            ("zazu", "Execution risk and profit guard"),
        ]
    return [
        ("kiki", "Chief of staff"),
        ("mimi", "Strategy and synthesis"),
        ("zazu", "Quality and risk review"),
    ]


async def _event(task_id: str, agent_id: str, kind: str, message: str, progress: int) -> None:
    async with SessionLocal() as db:
        db.add(TaskEvent(
            task_id=task_id,
            agent_id=agent_id,
            kind=kind,
            message=message,
            progress=progress,
        ))
        await db.commit()


async def _run_agent(
    task_id: str,
    agent_id: str,
    system_prompt: str,
    user_prompt: str,
    progress: int,
    model: str | None,
    fallback: bool,
) -> tuple[str, str]:
    await _event(task_id, agent_id, "agent_started", f"{agent_id.title()} started", progress)
    payload, model = await chat_completion([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ], model=model, fallback=fallback)
    result = payload["choices"][0]["message"]["content"]
    if not isinstance(result, str):
        raise RuntimeError("The model returned an unsupported response")
    await _event(task_id, agent_id, "agent_completed", f"{agent_id.title()} completed", progress + 10)
    return result, model


async def _stream_agent(
    task_id: str,
    agent_id: str,
    system_prompt: str,
    user_prompt: str,
    model: str | None,
    fallback: bool,
) -> tuple[str, str | None]:
    await _event(task_id, agent_id, "agent_started", f"{agent_id.title()} started", 45)
    output = ""
    pending = ""
    model_used = model
    last_flush = time.monotonic()
    async for raw_chunk in stream_completion([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ], model=model, fallback=fallback):
        try:
            chunk = json.loads(raw_chunk)
        except json.JSONDecodeError:
            continue
        model_used = chunk.get("model") or model_used
        choices = chunk.get("choices") or []
        text = choices[0].get("delta", {}).get("content") if choices else None
        if not isinstance(text, str) or not text:
            continue
        output += text
        pending += text
        now = time.monotonic()
        if len(pending) >= 160 or now - last_flush >= 0.5:
            await _event(task_id, agent_id, "delta", pending, 55)
            pending = ""
            last_flush = now
    if pending:
        await _event(task_id, agent_id, "delta", pending, 65)
    if not output:
        raise RuntimeError("The model returned an empty response")
    await _event(task_id, agent_id, "agent_completed", f"{agent_id.title()} completed", 70)
    return output, model_used


async def execute_task(task_id: str) -> None:
    async with SessionLocal() as db:
        task = await db.scalar(select(Task).where(Task.id == task_id))
        if task is None:
            return
        task.status = "running"
        task.updated_at = datetime.now(timezone.utc)
        await db.commit()

    try:
        await _event(task_id, "tiko", "status", "Task picked up by the background runner", 5)
        async with SessionLocal() as db:
            task = await db.get(Task, task_id)
            if task is None:
                return
            prompt = task.prompt
            preferred_model = task.model
            fallback = task.fallback_enabled

        agent_roles = build_agent_roles(prompt)
        kiki_id, kiki_role = agent_roles[0]
        mimi_id, mimi_role = agent_roles[1]
        zazu_id, zazu_role = agent_roles[2]

        plan, model = await _run_agent(
            task_id,
            kiki_id,
            f"You are {kiki_id.title()}, {kiki_role}. Produce a concise task plan and identify missing information. Do not claim to have used tools or accessed live data.",
            prompt,
            10,
            preferred_model,
            fallback,
        )
        answer, answer_model = await _stream_agent(
            task_id,
            mimi_id,
            f"You are {mimi_id.title()}, {mimi_role}. Complete the user's request using the plan and available model knowledge. Be explicit about limitations and never claim external actions occurred.",
            f"User request:\n{prompt}\n\n{kiki_id.title()}'s plan:\n{plan}",
            preferred_model,
            fallback,
        )
        reviewed, review_model = await _run_agent(
            task_id,
            zazu_id,
            f"You are {zazu_id.title()}, {zazu_role}. Check the draft for unsupported claims, missed constraints, and clarity. Return a corrected final response, not private reasoning.",
            f"User request:\n{prompt}\n\nDraft response:\n{answer}",
            80,
            preferred_model,
            fallback,
        )

        async with SessionLocal() as db:
            task = await db.get(Task, task_id)
            if task:
                task.status = "completed"
                task.result = reviewed
                task.model = review_model or answer_model or model
                task.updated_at = datetime.now(timezone.utc)
                await db.commit()
        await _event(task_id, "lulu", "completed", "Final response is ready", 100)
    except Exception:
        logger.exception("Background task %s failed", task_id)
        async with SessionLocal() as db:
            task = await db.get(Task, task_id)
            if task:
                task.status = "failed"
                task.error = "The background task failed. Check server configuration and logs."
                task.updated_at = datetime.now(timezone.utc)
                await db.commit()
        await _event(task_id, "zazu", "failed", "Task failed; no final response was produced", 100)
    finally:
        await engine.dispose()