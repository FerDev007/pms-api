import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.db.engine import get_db
from app.db.models import Sesion, Usuario


password_hasher = PasswordHasher()
SESSION_COOKIE = "pms_session"


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def hash_session_token(token: str) -> str:
    value = f"{settings.session_secret}:{token}".encode("utf-8")
    return hashlib.sha256(value).hexdigest()


def create_session(db: Session, usuario: Usuario) -> tuple[str, Sesion]:
    token = secrets.token_urlsafe(48)
    sesion = Sesion(
        token_hash=hash_session_token(token),
        usuario_id=usuario.id,
        expira_en=datetime.now(timezone.utc) + timedelta(days=settings.session_days),
    )
    db.add(sesion)
    db.commit()
    return token, sesion


def get_current_user(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
    db: Session = Depends(get_db),
) -> Usuario:
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inicia sesión para continuar")
    sesion = (
        db.query(Sesion)
        .options(joinedload(Sesion.usuario))
        .filter(Sesion.token_hash == hash_session_token(session_token))
        .first()
    )
    now = datetime.now(timezone.utc)
    expires = sesion.expira_en if sesion else None
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if not sesion or expires <= now or not sesion.usuario.activo:
        if sesion:
            db.delete(sesion)
            db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="La sesión venció")
    return sesion.usuario


def require_collector(x_collector_token: str = Header(alias="X-Collector-Token")) -> None:
    if not hmac.compare_digest(x_collector_token, settings.collector_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credencial del colector inválida")


def bootstrap_user(db: Session) -> None:
    if db.query(Usuario).count() > 0:
        return
    db.add(
        Usuario(
            username=settings.bootstrap_username.lower(),
            nombre="Administrador",
            password_hash=hash_password(settings.bootstrap_password),
            activo=True,
        )
    )
    db.commit()
