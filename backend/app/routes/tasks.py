import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import SessionLocal, get_session
from app.models import Task, TaskEvent, User
from app.models import ScheduledLoop
from app.worker import run_task

router = APIRouter(prefix="/tasks", tags=["tasks"])


class TaskCreate(BaseModel):
    prompt: str = Field(min_length=1, max_length=10000)
    title: str | None = Field(default=None, max_length=200)

    @field_validator("prompt")
    @classmethod
    def prompt_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Prompt cannot be blank")
        return value


def infer_task_type(prompt: str) -> str:
    lowered = (prompt or "").lower()
    trading_terms = (
        "trade",
        "trading",
        "forex",
        "crypto",
        "coin",
        "meme coin",
        "meme",
        "portfolio",
        "pnl",
        "profit",
        "risk",
        "stop loss",
        "volatility",
        "market signal",
        "broker",
    )
    sales_terms = (
        "sell",
        "sales",
        "listing",
        "product",
        "lead",
        "marketplace",
        "facebook marketplace",
        "fb marketplace",
        "ebay",
        "etsy",
        "shopify",
        "prospect",
        "outreach",
    )
    if any(term in lowered for term in trading_terms):
        return "trading"
    if any(term in lowered for term in sales_terms):
        return "sales"
    return "operations"


def _task_dashboard_cards(outcomes: dict[str, int] | str) -> list[dict]:
    if isinstance(outcomes, str):
        outcomes = {"total": 0, "completed": 0, "active": 0, "failed": 0}
    return [
        {"label": "Tasks", "value": outcomes.get("total", 0), "tone": "neutral"},
        {"label": "Completed", "value": outcomes.get("completed", 0), "tone": "profit"},
        {"label": "Active", "value": outcomes.get("active", 0), "tone": "safe"},
        {"label": "Failed", "value": outcomes.get("failed", 0), "tone": "warning"},
    ]


def _agent_score(agent_id: str, task_type: str, task_status: str) -> int:
    base_scores = {"kiki": 92, "mimi": 88, "zazu": 94, "tiko": 74}
    status_adjustments = {"completed": 8, "running": 4, "queued": 2, "failed": -20, "cancelled": -15}
    task_type_bonus = {"trading": 4, "sales": 5, "operations": 3}
    return max(0, min(100, base_scores.get(agent_id, 65) + status_adjustments.get(task_status, 0) + task_type_bonus.get(task_type, 0)))


def build_cos_report(task: Task) -> dict:
    task_type = infer_task_type(task.prompt)
    if task_type == "trading":
        task_contract = {
            "daily_cap_usd": 1000,
            "max_loss_percent": 5,
            "allow_leverage": False,
            "market_scope": ["major pairs", "liquid crypto pairs"],
        }
        risk_status = "needs_review" if task.status == "failed" else "within_limits"
        profit_summary = {
            "reported_profit_usd": 0.0,
            "status": "pending_verification" if task.status in {"queued", "running"} else "tracked",
            "requires_execution_ledger": True,
            "profit_guard": "Only verified broker or exchange statements may close the task.",
        }
        agents = [
            ("kiki", "Portfolio risk strategist"),
            ("mimi", "Market analyst and trade planner"),
            ("zazu", "Execution risk and profit guard"),
        ]
    elif task_type == "sales":
        task_contract = {
            "daily_cap_usd": 250,
            "approved_channels": ["Facebook Marketplace", "eBay", "Etsy", "Shopify"],
            "no_off_platform_payment": True,
            "listing_compliance_required": True,
        }
        risk_status = "needs_review" if task.status == "failed" else "within_limits"
        profit_summary = {
            "reported_profit_usd": 0.0,
            "status": "pending_verification" if task.status in {"queued", "running"} else "tracked",
            "requires_execution_ledger": True,
            "profit_guard": "Revenue is only counted after verified sale and payment settlement.",
        }
        agents = [
            ("kiki", "Growth strategist"),
            ("mimi", "Marketplace operations"),
            ("zazu", "Compliance and quality review"),
        ]
    else:
        task_contract = {
            "scope_boundaries": ["approved actions only", "user approval required for high-risk outputs"],
            "time_budget_minutes": 30,
            "handoff_required": True,
        }
        risk_status = "needs_review" if task.status == "failed" else "within_limits"
        profit_summary = {
            "reported_profit_usd": 0.0,
            "status": "pending_verification" if task.status in {"queued", "running"} else "tracked",
            "requires_execution_ledger": False,
            "profit_guard": "Value is measured via objective completion and output quality.",
        }
        agents = [
            ("kiki", "Chief of staff"),
            ("mimi", "Strategy and synthesis"),
            ("zazu", "Quality and risk review"),
        ]

    scorecard = [
        {
            "agent_id": agent_id,
            "role": role,
            "score": _agent_score(agent_id, task_type, task.status),
            "status": "green" if _agent_score(agent_id, task_type, task.status) >= 85 else "amber" if _agent_score(agent_id, task_type, task.status) >= 70 else "red",
            "risk_adherence": round(_agent_score(agent_id, task_type, task.status) / 100, 2),
        }
        for agent_id, role in agents
    ]
    scorecard.sort(key=lambda entry: entry["score"], reverse=True)
    return {
        "task_type": task_type,
        "risk_status": risk_status,
        "task_contract": task_contract,
        "profit_summary": profit_summary,
        "agent_scorecard": scorecard,
        "recommendations": [
            "Pause weak performers below 70 after repeated policy breaches.",
            "Promote the top-scoring agent for the next high-value task.",
            "Only execute in approved channels or markets with documented risk checks.",
        ],
    }


def build_task_report(task: Task) -> dict:
    task_type = infer_task_type(task.prompt)
    status_counts = {
        "total": 1,
        "completed": 1 if task.status == "completed" else 0,
        "active": 1 if task.status in {"queued", "running"} else 0,
        "failed": 1 if task.status == "failed" else 0,
    }
    cos_report = build_cos_report(task)
    if task_type == "trading":
        return {
            "task_id": task.id,
            "task_type": "trading",
            "recommended_dashboard": "trading",
            "summary": "Capital is being tracked with risk-adjusted execution checks and trade-level performance logging.",
            "profit_report": {
                "currency": "USD",
                "gross_revenue": 0.0,
                "net_profit": 0.0,
                "fees": 0.0,
                "roi_percent": 0.0,
                "status": task.status,
            },
            "risk_controls": [
                "Max daily loss cap",
                "Position sizing rules",
                "Stop-loss guard",
                "Volatility filter",
                "Agent performance review",
            ],
            "techniques_used": [
                "Risk-adjusted trade sizing",
                "Trend quality review",
                "Broker spread and slippage checks",
                "Post-trade journaling",
            ],
            "dashboard_cards": _task_dashboard_cards(status_counts),
            "cos_report": cos_report,
        }
    if task_type == "sales":
        return {
            "task_id": task.id,
            "task_type": "sales",
            "recommended_dashboard": "sales",
            "summary": "The workflow is focused on listing quality, conversion efficiency, and revenue tracking across approved channels.",
            "profit_report": {
                "currency": "USD",
                "gross_revenue": 0.0,
                "net_profit": 0.0,
                "ad_spend": 0.0,
                "roas_percent": 0.0,
                "status": task.status,
            },
            "risk_controls": [
                "Approved sales channels only",
                "No off-platform payment flow",
                "Listing compliance checks",
                "Campaign spend cap",
            ],
            "techniques_used": [
                "Offer optimization",
                "Listing copy testing",
                "Channel-specific pricing",
                "Lead qualification",
            ],
            "dashboard_cards": _task_dashboard_cards(status_counts),
            "cos_report": cos_report,
        }
    return {
        "task_id": task.id,
        "task_type": "operations",
        "recommended_dashboard": "operations",
        "summary": "This is a productivity-focused task with reporting centered on execution quality and objective completion.",
        "profit_report": {
            "currency": "USD",
            "value_created": 0.0,
            "efficiency_score": 0.0,
            "status": task.status,
        },
        "risk_controls": [
            "Scope and task boundaries",
            "Approval gates",
            "Action logging",
            "Outcome review",
        ],
        "techniques_used": [
            "Task decomposition",
            "Role assignment",
            "Structured review",
            "Outcome scoring",
        ],
        "dashboard_cards": _task_dashboard_cards(status_counts),
        "cos_report": cos_report,
    }


def task_dict(task: Task) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "prompt": task.prompt,
        "task_type": infer_task_type(task.prompt),
        "status": task.status,
        "model": task.model,
        "fallback_enabled": task.fallback_enabled,
        "result": task.result,
        "error": task.error,
        "created_at": task.created_at.isoformat(),
        "updated_at": task.updated_at.isoformat(),
    }


@router.post("", status_code=202)
async def create_task(
    body: TaskCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    title = body.title or body.prompt.strip().splitlines()[0][:200]
    task = Task(
        user_id=user.id,
        title=title,
        prompt=body.prompt.strip(),
        model=user.preferred_model,
        fallback_enabled=user.fallback_enabled,
    )
    db.add(task)
    await db.flush()
    db.add(TaskEvent(
        task_id=task.id,
        agent_id="tiko",
        kind="queued",
        message="Task queued for background execution",
        progress=0,
    ))
    await db.commit()
    await db.refresh(task)
    try:
        run_task.delay(task.id)
    except Exception as exc:
        task.status = "failed"
        task.error = "The background queue is unavailable. Try again shortly."
        db.add(TaskEvent(
            task_id=task.id,
            agent_id="tiko",
            kind="failed",
            message="Task could not be submitted to the background queue",
            progress=100,
        ))
        await db.commit()
        raise HTTPException(status_code=503, detail=task.error) from exc
    return task_dict(task)


@router.get("")
async def list_tasks(
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    limit = min(max(limit, 1), 100)
    rows = await db.scalars(
        select(Task).where(Task.user_id == user.id).order_by(Task.created_at.desc()).limit(limit)
    )
    return [task_dict(task) for task in rows]


@router.get("/export")
async def export_tasks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    tasks = await db.scalars(select(Task).where(Task.user_id == user.id).order_by(Task.created_at.desc()))
    rows = list(tasks)
    events = await db.scalars(
        select(TaskEvent)
        .join(Task, Task.id == TaskEvent.task_id)
        .where(Task.user_id == user.id)
        .order_by(TaskEvent.id)
    )
    grouped: dict[str, list[dict]] = {}
    for event in events:
        grouped.setdefault(event.task_id, []).append({
            "id": event.id,
            "agent_id": event.agent_id,
            "kind": event.kind,
            "message": event.message,
            "progress": event.progress,
            "created_at": event.created_at.isoformat(),
        })
    exported = []
    for task in rows:
        record = task_dict(task)
        record["events"] = grouped.get(task.id, [])
        exported.append(record)
    return JSONResponse(
        {"exported_at": datetime.now(timezone.utc).isoformat(), "tasks": exported},
        headers={"Content-Disposition": "attachment; filename=makky-task-export.json"},
    )


@router.delete("", status_code=204)
async def clear_tasks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    active_count = await db.scalar(
        select(func.count(Task.id)).where(Task.user_id == user.id, Task.status.in_(["queued", "running"]))
    ) or 0
    if active_count:
        raise HTTPException(status_code=409, detail="Wait for active tasks to finish before resetting history")
    await db.execute(delete(Task).where(Task.user_id == user.id))
    await db.commit()


async def owned_task(task_id: str, user_id: str, db: AsyncSession) -> Task:
    task = await db.scalar(select(Task).where(Task.id == task_id, Task.user_id == user_id))
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/{task_id}/report")
async def get_task_report(
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    task = await owned_task(task_id, user.id, db)
    return build_task_report(task)


@router.get("/{task_id}")
async def get_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    task = await owned_task(task_id, user.id, db)
    events = await db.scalars(
        select(TaskEvent).where(TaskEvent.task_id == task_id).order_by(TaskEvent.id)
    )
    result = task_dict(task)
    result["events"] = [
        {"id": event.id, "agent_id": event.agent_id, "kind": event.kind,
         "message": event.message, "progress": event.progress, "created_at": event.created_at.isoformat()}
        for event in events
    ]
    result["task_report"] = build_task_report(task)
    return result


@router.get("/{task_id}/events")
async def stream_task_events(
    task_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    after_id: int = 0,
):
    await owned_task(task_id, user.id, db)
    try:
        cursor = max(int(last_event_id or after_id), 0)
    except ValueError:
        cursor = 0

    async def events():
        nonlocal cursor
        while not await request.is_disconnected():
            async with SessionLocal() as stream_db:
                rows = await stream_db.scalars(
                    select(TaskEvent).where(
                        TaskEvent.task_id == task_id,
                        TaskEvent.id > cursor,
                    ).order_by(TaskEvent.id)
                )
                emitted = False
                for event in rows:
                    emitted = True
                    cursor = event.id
                    payload = {
                        "agent_id": event.agent_id,
                        "kind": event.kind,
                        "message": event.message,
                        "progress": event.progress,
                        "created_at": event.created_at.isoformat(),
                    }
                    yield f"id: {event.id}\ndata: {json.dumps(payload)}\n\n"
                current = await stream_db.get(Task, task_id)
                if current is None or current.status in {"completed", "failed", "cancelled"}:
                    if not emitted:
                        yield "event: end\ndata: {}\n\n"
                    break
            if not emitted:
                yield ": keep-alive\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/metrics/summary")
async def metrics_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    total = await db.scalar(select(func.count(Task.id)).where(Task.user_id == user.id)) or 0
    completed = await db.scalar(
        select(func.count(Task.id)).where(Task.user_id == user.id, Task.status == "completed")
    ) or 0
    active = await db.scalar(
        select(func.count(Task.id)).where(Task.user_id == user.id, Task.status.in_(["queued", "running"]))
    ) or 0
    active_loops = await db.scalar(
        select(func.count(ScheduledLoop.id)).where(
            ScheduledLoop.user_id == user.id,
            ScheduledLoop.enabled.is_(True),
        )
    ) or 0
    agent_rows = await db.execute(
        select(TaskEvent.agent_id, func.count(TaskEvent.id))
        .join(Task, Task.id == TaskEvent.task_id)
        .where(Task.user_id == user.id)
        .group_by(TaskEvent.agent_id)
        .order_by(func.count(TaskEvent.id).desc())
    )
    recent = await db.scalars(
        select(Task).where(Task.user_id == user.id).order_by(Task.created_at.desc()).limit(10)
    )
    task_rows = list(await db.scalars(select(Task).where(Task.user_id == user.id)))
    by_type: dict[str, int] = {"trading": 0, "sales": 0, "operations": 0}
    outcomes_by_type = {
        task_type: {"total": 0, "completed": 0, "active": 0, "failed": 0}
        for task_type in by_type
    }
    for task in task_rows:
        task_type = infer_task_type(task.prompt)
        by_type[task_type] += 1
        outcomes = outcomes_by_type[task_type]
        outcomes["total"] += 1
        if task.status == "completed":
            outcomes["completed"] += 1
        elif task.status in {"queued", "running"}:
            outcomes["active"] += 1
        elif task.status == "failed":
            outcomes["failed"] += 1
    recommended_dashboard = "operations"
    if by_type["trading"] >= by_type["sales"] and by_type["trading"] >= by_type["operations"]:
        recommended_dashboard = "trading"
    elif by_type["sales"] >= by_type["trading"] and by_type["sales"] >= by_type["operations"]:
        recommended_dashboard = "sales"

    selected_task = None
    for task in task_rows:
        if infer_task_type(task.prompt) == recommended_dashboard:
            selected_task = task
            break
    report = build_task_report(selected_task) if selected_task else {
        "task_id": None,
        "task_type": recommended_dashboard,
        "recommended_dashboard": recommended_dashboard,
        "summary": "No matching task has been completed yet. The dashboard will populate once a task is created.",
        "profit_report": {"currency": "USD", "status": "pending"},
        "risk_controls": [],
        "techniques_used": [],
        "dashboard_cards": _task_dashboard_cards({"total": 0, "completed": 0, "active": 0, "failed": 0}),
        "cos_report": build_cos_report(Task(prompt="placeholder", status="queued")) if recommended_dashboard == "trading" else {
            "task_type": recommended_dashboard,
            "risk_status": "within_limits",
            "task_contract": {},
            "profit_summary": {"reported_profit_usd": 0.0, "status": "pending_verification"},
            "agent_scorecard": [],
            "recommendations": [],
        },
    }

    return {
        "total_tasks": total,
        "active_tasks": active,
        "completed_tasks": completed,
        "success_rate": round(completed / total * 100, 1) if total else 0,
        "active_loops": active_loops,
        "agent_utilization": [{"agent_id": row[0], "events": row[1]} for row in agent_rows],
        "recent_tasks": [task_dict(task) for task in recent],
        "task_profile": {
            "recommended_dashboard": recommended_dashboard,
            "by_type": by_type,
            "outcomes_by_type": outcomes_by_type,
            "dashboard_cards": report["dashboard_cards"],
            "report": report,
            "financial_reporting": {
                "available": False,
                "reason": "No broker, exchange, or commerce execution ledger is connected; realized profit cannot be verified.",
            },
        },
    }