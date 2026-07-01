"""
数据库连接管理
"""
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base

from app.config import DB_URL

Base = declarative_base()

_engine = None
_SessionFactory = None


def init_db(db_url: str = None):
    """初始化数据库连接并建表"""
    global _engine, _SessionFactory
    url = db_url or DB_URL
    _engine = create_engine(url, echo=False, future=True)
    _SessionFactory = sessionmaker(bind=_engine, expire_on_commit=False, future=True)

    # 导入所有模型以触发注册
    from app.database import models  # noqa: F401

    Base.metadata.create_all(_engine)


def get_engine():
    return _engine


@contextmanager
def get_session() -> Generator[Session, None, None]:
    """获取数据库 Session（自动提交/回滚/关闭）"""
    if _SessionFactory is None:
        init_db()
    session = _SessionFactory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
