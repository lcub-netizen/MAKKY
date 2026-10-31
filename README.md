# Makky — Autonomous Multi-Agent AI System (v3.0)

Enterprise-grade full-stack app: Python FastAPI backend + React (Vite, Tailwind, Lucide, Framer Motion) frontend, driving a 7-agent autonomous swarm over OpenRouter.

## Architecture

- **Frontend**: React 18 + TypeScript + Vite, Tailwind CSS, glassmorphism theme (white/green/blue ambient orbs), Lucide icons, Framer Motion, Zustand, React Router.
- **Backend**: FastAPI (Python 3.11+), OpenRouter wrapper with free-model rotation, SSE streaming.
- **Agents**: Kiki (Chief of Staff), Pip (Trend Scout), Noko (Web Automation), Mimi (Strategy), Zazu (QA), Tiko (Scheduler), Lulu (Notifications).

## Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- An OpenRouter API key

## Setup — Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # set OPENROUTER_API_KEY
uvicorn app.main:app --reload --port 8000
```

Create `backend/.env`:
```
OPENROUTER_API_KEY=sk-or-...
```

## Setup — Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

The frontend proxies `/chat` and `/health` to the backend (configure in `vite.config.ts` if needed).

## API

- `GET /health` — server + agent status
- `GET /` — app info
- `POST /chat/stream` — SSE stream of LLM chunks. Body: `{ "messages": [...], "model": "optional" }`

## Agent Roster

| Agent | Mascot | Color | Role |
|---|---|---|---|
| Kiki | 🌟 | #FFD700 | Chief of Staff |
| Pip | 🔭 | #00F0FF | Trend Scout |
| Noko | 🤖 | #10B981 | Web Automation |
| Mimi | 💡 | #EC4899 | Strategy & Synthesis |
| Zazu | 🛡️ | #F59E0B | Quality Assurance |
| Tiko | ⏱️ | #3B82F6 | Workflow Scheduler |
| Lulu | 📢 | #8B5CF6 | Notifications |

## OpenRouter Routing

`app/services/router.py` rotates through free models (`google/gemini-2.5-flash:free`, `meta-llama/llama-3.3-70b-instruct:free`, `qwen/qwen-2.5-coder-32b-instruct:free`) on HTTP 429/503. Keys stay server-side only (`.env`).

## Pages

- `/` — Landing (hero, features, mascots, pricing, footer)
- `/app` — Chat workspace (sidebar + Kiki chat + browser container)
- `/metrics` — KPIs, agent utilization, execution log
- `/settings` — AI routing, loop controls, security/sessions

## Notes on Running on Android

Native dependencies (Vite/rollup, pydantic-core) cannot build on Android's linker. Develop and run on a desktop or CI runner; source is portable.

## License

MIT
