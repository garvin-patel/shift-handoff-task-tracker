from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.deps import DbSession
from app.routers import auth, handoffs, shifts, tasks, users

app = FastAPI(
    title="Shift Handoff Task Tracker API",
    version="1.0.0",
    description="Track tasks across shifts and hand unfinished work to the next shift.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (auth.router, users.router, tasks.router, shifts.router, handoffs.router):
    app.include_router(router)


@app.get("/health", tags=["health"])
def health(db: DbSession):
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok"}
