from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session

from .config import get_settings


class Base(DeclarativeBase):
    pass


@lru_cache
def get_engine():
    return create_engine(get_settings().database_url, pool_pre_ping=True,
                         connect_args={"connect_timeout": 5})


def get_db():
    # One session per request. Uncommitted changes roll back on close.
    with Session(get_engine()) as session:
        yield session
