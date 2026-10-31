AGENTS = [
    {"id": "kiki", "name": "Kiki", "emoji": "🌟", "color": "#FFD700", "role": "Chief of Staff", "desc": "Conversational master controller."},
    {"id": "pip", "name": "Pip", "emoji": "🔭", "color": "#00F0FF", "role": "Trend Scout", "desc": "Autonomous market intelligence watcher."},
    {"id": "noko", "name": "Noko", "emoji": "🤖", "color": "#10B981", "role": "Web Automation", "desc": "Headless browser navigator."},
    {"id": "mimi", "name": "Mimi", "emoji": "💡", "color": "#EC4899", "role": "Strategy & Synthesis", "desc": "Content generator and strategist."},
    {"id": "zazu", "name": "Zazu", "emoji": "🛡️", "color": "#F59E0B", "role": "Quality Assurance", "desc": "Strict validator and error checker."},
    {"id": "tiko", "name": "Tiko", "emoji": "⏱️", "color": "#3B82F6", "role": "Workflow Scheduler", "desc": "Task queue manager and timer."},
    {"id": "lulu", "name": "Lulu", "emoji": "📢", "color": "#8B5CF6", "role": "Notification", "desc": "Alert delivery and integration manager."},
]


def get_agent(agent_id):
    for a in AGENTS:
        if a["id"] == agent_id:
            return a
    return None
