from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.auth.router import auth_router
from app.core.config import settings
from app.core.security import bootstrap_user
from app.db.engine import SessionLocal, engine
from app.db.models import Base
from app.db.seed import seed_catalog
from app.pms.api import api_router, collector_router


def get_version() -> str:
    try:
        return open("VERSION", encoding="utf-8").read().strip()
    except FileNotFoundError:
        return "dev"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_catalog(db)
        bootstrap_user(db)
    finally:
        db.close()
    yield


app = FastAPI(title="PMS", debug=settings.is_debug, version=get_version(), lifespan=lifespan)


@app.middleware("http")
async def same_origin_mutations(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        host = request.headers.get("host")
        if origin and host and host not in origin:
            return JSONResponse(status_code=403, content={"detail": "Origen de solicitud no permitido"})
    return await call_next(request)


@app.get("/health", tags=["sistema"])
def health():
    return {"status": "ok", "version": get_version()}


app.include_router(auth_router)
app.include_router(api_router)
app.include_router(collector_router)


frontend = settings.frontend_path
assets = frontend / "assets"
if assets.exists():
    app.mount("/assets", StaticFiles(directory=assets), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
def spa(full_path: str):
    if full_path:
        requested = (frontend / full_path).resolve()
        if requested.is_relative_to(frontend.resolve()) and requested.is_file():
            return FileResponse(requested)
    index = frontend / "index.html"
    if index.is_file():
        return FileResponse(index)
    raise HTTPException(404, "La interfaz web aún no ha sido compilada")
