from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    SESSION_COOKIE,
    create_session,
    get_current_user,
    hash_session_token,
    hash_password,
    verify_password,
)
from app.db.engine import get_db
from app.db.models import Sesion, Usuario
from app.pms.schemes import LoginRequest, PasswordChange, UsuarioRead


auth_router = APIRouter(prefix="/pms/auth", tags=["autenticación"])


@auth_router.post("/login", response_model=UsuarioRead)
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.username == data.username.strip().lower()).first()
    if not usuario or not usuario.activo or not verify_password(data.password, usuario.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña incorrectos")
    token, _ = create_session(db, usuario)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        secure=not settings.is_debug,
        samesite="lax",
        max_age=settings.session_days * 86400,
        path="/",
    )
    return usuario


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        sesion = db.query(Sesion).filter(Sesion.token_hash == hash_session_token(token)).first()
        if sesion:
            db.delete(sesion)
            db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")


@auth_router.get("/me", response_model=UsuarioRead)
def me(usuario: Usuario = Depends(get_current_user)):
    return usuario


@auth_router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: PasswordChange,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.password_actual, usuario.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual no coincide")
    usuario.password_hash = hash_password(data.password_nuevo)
    db.query(Sesion).filter(Sesion.usuario_id == usuario.id).delete(synchronize_session=False)
    db.add(usuario)
    db.commit()
