from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import URL
from app.core.config import settings


database_url = URL.create(
    drivername="mssql+pyodbc",
    username=settings.db_uid,
    password=settings.db_pwd,
    host=f"{settings.db_server}",
    port=f"{settings.db_port}",
    database=settings.db_database,
    query={
        "driver": "ODBC Driver 18 for SQL Server",
        "Encrypt": "yes",
        "TrustServerCertificate": "yes",
    },
)

print()

engine = create_engine(database_url)
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
