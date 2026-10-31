from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.router import stream_completion

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    messages: list
    model: str | None = None


@router.post("/stream")
async def stream_chat(req: ChatRequest):
    async def gen():
        async for chunk in stream_completion(req.messages, req.model):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")
