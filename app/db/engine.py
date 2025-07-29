from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from urllib.parse import quote_plus


conn_str = (
    f"DRIVER={{{settings.db_driver}}};"
    f"SERVER={settings.db_server},{settings.db_port};"
    f"DATABASE={settings.db_database};"
    f"UID={settings.db_uid};"
    f"PWD={settings.db_pwd};"
    f"TrustServerCertificate=yes;"
)

engine = create_engine(f"mssql+pyodbc:///?odbc_connect={quote_plus(conn_str)}")

SessionLocal = sessionmaker(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
