import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, ForeignKey, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker
from contextlib import contextmanager

# Ensure directory for DB exists
DB_DIR = os.environ.get("DB_DIR", "/app/data")
if os.name == 'nt':
    try:
        os.makedirs(DB_DIR, exist_ok=True)
    except PermissionError:
        DB_DIR = "./data"
        os.makedirs(DB_DIR, exist_ok=True)
else:
    os.makedirs(DB_DIR, exist_ok=True)

DB_PATH = os.path.join(DB_DIR, "netmon.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # Needed for SQLite in multi-threaded environment
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Enable foreign keys support in SQLite
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

class Target(Base):
    __tablename__ = "targets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    host = Column(String, nullable=False)
    port = Column(Integer, nullable=True)
    protocol = Column(String, nullable=False, default="tcp")
    expected_status = Column(Integer, nullable=False, default=200)
    description = Column(String, nullable=False, default="")
    
    # Current status/stats
    is_up = Column(Boolean, nullable=True)
    last_check = Column(DateTime, nullable=True)
    last_up = Column(DateTime, nullable=True)
    last_down = Column(DateTime, nullable=True)
    last_response_time = Column(Float, nullable=True)
    consecutive_failures = Column(Integer, nullable=False, default=0)
    total_checks = Column(Integer, nullable=False, default=0)
    total_up = Column(Integer, nullable=False, default=0)
    total_down = Column(Integer, nullable=False, default=0)

class CheckHistory(Base):
    __tablename__ = "check_history"

    id = Column(Integer, primary_key=True, index=True)
    target_id = Column(Integer, ForeignKey("targets.id", ondelete="CASCADE"), nullable=False)
    time = Column(DateTime, nullable=False, default=datetime.now)
    status = Column(String, nullable=False)  # "UP" or "DOWN"
    response_time_ms = Column(Float, nullable=True)

class DowntimeEvent(Base):
    __tablename__ = "downtime_events"

    id = Column(Integer, primary_key=True, index=True)
    target_id = Column(Integer, ForeignKey("targets.id", ondelete="CASCADE"), nullable=False)
    event = Column(String, nullable=False)  # "UP" or "DOWN"
    time = Column(DateTime, nullable=False, default=datetime.now)
    message = Column(String, nullable=False)

def init_db():
    Base.metadata.create_all(bind=engine)

@contextmanager
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
