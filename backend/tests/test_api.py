import asyncio
import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("JWT_SECRET", "test-secret-that-is-long-enough-for-tests")

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import get_session
from app.main import app
from app.models import Base, ScheduledLoop, Task, TaskEvent, User
from app.routes.tasks import build_cos_report, infer_task_type, run_task
from app.services import orchestration
from app.services import scheduler


def test_authenticated_tasks_are_user_scoped(tmp_path, monkeypatch):
    database_url = f"sqlite+aiosqlite:///{tmp_path / 'api-tests.db'}"
    engine = create_async_engine(database_url)
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    async def create_schema():
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    async def session_override():
        async with sessions() as session:
            yield session

    asyncio.run(create_schema())
    app.dependency_overrides[get_session] = session_override
    monkeypatch.setattr(run_task, "delay", lambda task_id: None)

    try:
        with TestClient(app) as client:
            first = client.post("/auth/register", json={
                "email": "first@example.com",
                "password": "a-strong-password-123",
            })
            assert first.status_code == 201
            assert "httponly" in first.headers["set-cookie"].lower()
            session_list = client.get("/auth/sessions").json()
            assert len(session_list) == 1 and session_list[0]["current"] is True
            old_session_id = session_list[0]["id"]
            assert client.post("/auth/refresh").status_code == 200
            rotated_sessions = client.get("/auth/sessions").json()
            assert len(rotated_sessions) == 2
            assert next(item for item in rotated_sessions if item["id"] == old_session_id)["revoked"] is True
            current_session = next(item for item in rotated_sessions if item["current"])

            created = client.post("/tasks", json={"prompt": "Summarize this project"})
            assert created.status_code == 202
            task_id = created.json()["id"]
            assert client.get("/tasks").json()[0]["id"] == task_id
            exported = client.get("/tasks/export").json()
            assert exported["tasks"][0]["id"] == task_id

            created_loop = client.post("/loops", json={
                "prompt": "Review the latest notes",
                "interval_minutes": 15,
            })
            assert created_loop.status_code == 201
            loop_id = created_loop.json()["id"]
            assert client.get("/tasks/metrics/summary").json()["active_loops"] == 1
            assert client.post("/loops", json={
                "prompt": "Another schedule",
                "interval_minutes": 30,
            }).status_code == 409
            assert client.patch(f"/loops/{loop_id}", json={"enabled": False}).json()["enabled"] is False
            assert client.get("/tasks/metrics/summary").json()["active_loops"] == 0

            assert client.delete(f"/auth/sessions/{current_session['id']}").status_code == 204
            assert client.get("/auth/me").status_code == 401
            client.post("/auth/logout")
            assert client.get("/auth/me").status_code == 401
            second = client.post("/auth/register", json={
                "email": "second@example.com",
                "password": "another-strong-password-456",
            })
            assert second.status_code == 201
            assert client.get("/tasks").json() == []
            assert client.get(f"/tasks/{task_id}").status_code == 404
            assert client.get("/loops").json() == []
            assert client.delete(f"/loops/{loop_id}").status_code == 404
            assert client.delete("/tasks").status_code == 204
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_task_type_metrics_are_task_aware():
    assert infer_task_type("Monitor crypto volatility and protect capital while trading meme coins") == "trading"
    assert infer_task_type("List my furniture on Facebook Marketplace and local classifieds") == "sales"
    assert infer_task_type("Prepare a quarterly business review for my team") == "operations"


def test_metrics_summary_exposes_task_specific_dashboard_report(tmp_path, monkeypatch):
    database_url = f"sqlite+aiosqlite:///{tmp_path / 'metrics-report.db'}"
    engine = create_async_engine(database_url)
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    async def create_schema():
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    async def session_override():
        async with sessions() as session:
            yield session

    asyncio.run(create_schema())
    app.dependency_overrides[get_session] = session_override
    monkeypatch.setattr(run_task, "delay", lambda task_id: None)

    try:
        with TestClient(app) as client:
            client.post("/auth/register", json={"email": "report@example.com", "password": "a-strong-password-123"})
            client.post("/tasks", json={"prompt": "Trade crypto with strict risk controls and profit tracking"})

            summary = client.get("/tasks/metrics/summary").json()
            assert summary["task_profile"]["recommended_dashboard"] == "trading"
            assert "report" in summary["task_profile"]
            assert summary["task_profile"]["report"]["task_type"] == "trading"
            assert "profit_report" in summary["task_profile"]["report"]
            assert "risk_controls" in summary["task_profile"]["report"]
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_cos_report_scores_agents_and_risk_status():
    task = Task(prompt="Trade crypto with strict risk controls and profit tracking", status="queued")
    report = build_cos_report(task)

    assert report["task_type"] == "trading"
    assert report["risk_status"] in {"within_limits", "needs_review"}
    assert report["profit_summary"]["status"] in {"pending_verification", "tracked"}
    assert len(report["agent_scorecard"]) >= 3
    assert report["agent_scorecard"][0]["agent_id"] in {"kiki", "mimi", "zazu"}
    assert report["agent_scorecard"][0]["score"] >= 0


def test_stream_agent_records_text_deltas(monkeypatch):
    emitted = []

    async def fake_stream(messages, model=None, fallback=True):
        yield '{"model":"test-model","choices":[{"delta":{"content":"Hello "}}]}'
        yield '{"choices":[{"delta":{"content":"world."}}]}'

    async def capture_event(task_id, agent_id, kind, message, progress):
        emitted.append((agent_id, kind, message, progress))

    monkeypatch.setattr(orchestration, "stream_completion", fake_stream)
    monkeypatch.setattr(orchestration, "_event", capture_event)

    result, model = asyncio.run(orchestration._stream_agent(
        "task-1", "mimi", "system", "user prompt", None, True,
    ))

    assert result == "Hello world."
    assert model == "test-model"
    assert "".join(message for agent, kind, message, _ in emitted if agent == "mimi" and kind == "delta") == result
    assert emitted[0][1] == "agent_started"
    assert emitted[-1][1] == "agent_completed"


def test_scheduler_dispatches_due_loop_once(tmp_path, monkeypatch):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'scheduler.db'}")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr(scheduler, "SessionLocal", sessions)
    monkeypatch.setattr(scheduler, "engine", engine)

    async def seed_database():
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as db:
            user = User(email="scheduler@example.com", password_hash="test-hash")
            db.add(user)
            await db.flush()
            db.add(ScheduledLoop(
                user_id=user.id,
                title="Due report",
                prompt="Prepare a report",
                interval_minutes=15,
                enabled=True,
                next_run_at=datetime.now(timezone.utc) - timedelta(minutes=1),
            ))
            await db.commit()

    asyncio.run(seed_database())
    task_ids = asyncio.run(scheduler.dispatch_due_loops())
    assert len(task_ids) == 1

    async def assert_dispatch_state():
        async with sessions() as db:
            task = await db.get(Task, task_ids[0])
            assert task is not None and task.status == "queued"
            event = await db.scalar(select(TaskEvent).where(TaskEvent.task_id == task.id))
            assert event is not None and event.agent_id == "tiko"
            loop = await db.scalar(select(ScheduledLoop))
            assert loop is not None and loop.last_run_at is not None
            next_run_at = loop.next_run_at
            if next_run_at.tzinfo is None:
                next_run_at = next_run_at.replace(tzinfo=timezone.utc)
            assert next_run_at > datetime.now(timezone.utc)

    asyncio.run(assert_dispatch_state())
    asyncio.run(engine.dispose())


def test_business_task_roles_are_dynamic_for_sales_and_trading():
    sales = orchestration.build_agent_roles("Find hot local leads for a furniture shop and qualify them for Facebook Marketplace sales")
    trading = orchestration.build_agent_roles("Monitor meme coin volatility and protect capital while trading on volatility")

    assert sales[0][0] == "kiki" and "growth" in sales[0][1].lower()
    assert sales[1][0] == "mimi" and "market" in sales[1][1].lower()
    assert trading[2][0] == "zazu" and "risk" in trading[2][1].lower()


def test_production_settings_require_strong_runtime_values(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "super-long-production-secret-1234567890")
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@db:5432/app")
    monkeypatch.setenv("REDIS_URL", "redis://redis:6379/0")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-api-key")
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://example.com")
    monkeypatch.setenv("COOKIE_SECURE", "true")

    from app import config
    import importlib
    importlib.reload(config)

    config.settings.validate_runtime()
    assert config.settings.app_env == "production"