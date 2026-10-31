import httpx
import os
from typing import AsyncIterator

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
BASE_URL = "https://openrouter.ai/api/v1"

FREE_MODELS = [
    "google/gemini-2.5-flash:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "qwen/qwen-2.5-coder-32b-instruct:free",
]


async def chat_completion(messages, model=None, stream=False):
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://makky.local",
        "X-Title": "Makky",
    }
    tried = []
    models = [model] if model else FREE_MODELS
    for m in models:
        if m in tried:
            continue
        tried.append(m)
        payload = {"model": m, "messages": messages, "stream": stream}
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(f"{BASE_URL}/chat/completions", json=payload, headers=headers)
            if resp.status_code in (429, 503):
                continue
            resp.raise_for_status()
            return resp.json(), m
    raise RuntimeError("All models exhausted")


async def stream_completion(messages, model=None) -> AsyncIterator[str]:
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://makky.local",
        "X-Title": "Makky",
    }
    models = [model] if model else FREE_MODELS
    for m in models:
        payload = {"model": m, "messages": messages, "stream": True}
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream("POST", f"{BASE_URL}/chat/completions", json=payload, headers=headers) as resp:
                if resp.status_code in (429, 503):
                    continue
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data.strip() == "[DONE]":
                            return
                        yield data
                return
    raise RuntimeError("All models exhausted")
