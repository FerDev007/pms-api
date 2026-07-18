import os
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import desc, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.config import settings
from app.core.security import get_current_user, hash_password, require_collector
from app.db.engine import get_db
from app.db.models import (
    Impresora,
    ImpresoraEnSitio,
    Sesion,
    Suministro,
    TelemetriaImpresora,
    Transaccion,
    Usuario,
)
from app.pms.schemes import (
    ImpresoraEnSitioWrite,
    ImpresoraRead,
    ImpresoraWrite,
    SuministroRead,
    SuministroWrite,
    TelemetriaBatch,
    TipoTransaccion,
    TransaccionCreate,
    TransaccionRead,
    UsuarioCreate,
    UsuarioRead,
    UsuarioUpdate,
)


api_router = APIRouter(
    prefix="/pms",
    dependencies=[Depends(get_current_user)],
)
collector_router = APIRouter(
    prefix="/pms/collector",
    tags=["colector"],
    dependencies=[Depends(require_collector)],
)
movement_lock = threading.Lock()


def page(items: list, total: int, current: int, size: int) -> dict:
    return {"items": items, "total": total, "page": current, "page_size": size}


def pagination(page_number: int, page_size: int) -> tuple[int, int]:
    return (page_number - 1) * page_size, page_size


def site_payload(site: ImpresoraEnSitio) -> dict:
    telemetry = None
    if site.telemetria:
        observed = site.telemetria.observada_en
        if observed.tzinfo is None:
            observed = observed.replace(tzinfo=timezone.utc)
        telemetry = {
            "observada_en": observed,
            "disponible": site.telemetria.disponible,
            "obsoleta": observed < datetime.now(timezone.utc) - timedelta(minutes=settings.telemetry_stale_minutes),
            "error": site.telemetria.error,
            "nombre_dispositivo": site.telemetria.nombre_dispositivo,
            "serie": site.telemetria.serie,
            "notificaciones": site.telemetria.notificaciones or [],
            "toners": site.telemetria.toners or [],
            "cartucho": site.telemetria.cartucho,
            "consumo": site.telemetria.consumo,
        }
    return {
        "id": site.id,
        "nombre": site.nombre,
        "ip": site.ip,
        "a_color": site.a_color,
        "impresora": site.impresora,
        "telemetria": telemetry,
    }


def get_printer(db: Session, printer_id: int) -> Impresora:
    printer = db.query(Impresora).filter(Impresora.id == printer_id).first()
    if not printer:
        raise HTTPException(404, "No se encontró la impresora")
    return printer


def get_supply(db: Session, supply_id: int) -> Suministro:
    supply = db.query(Suministro).filter(Suministro.id == supply_id).first()
    if not supply:
        raise HTTPException(404, "No se encontró el suministro")
    return supply


def get_site(db: Session, site_id: int) -> ImpresoraEnSitio:
    site = (
        db.query(ImpresoraEnSitio)
        .options(joinedload(ImpresoraEnSitio.impresora), joinedload(ImpresoraEnSitio.telemetria))
        .filter(ImpresoraEnSitio.id == site_id)
        .first()
    )
    if not site:
        raise HTTPException(404, "No se encontró el equipo")
    return site


@api_router.get("/dashboard", tags=["inicio"])
def dashboard(db: Session = Depends(get_db)):
    supplies = db.query(Suministro).all()
    sites = db.query(ImpresoraEnSitio).options(joinedload(ImpresoraEnSitio.telemetria)).all()
    recent = (
        db.query(Transaccion)
        .options(joinedload(Transaccion.suministro), joinedload(Transaccion.usuario))
        .order_by(desc(Transaccion.id))
        .limit(5)
        .all()
    )
    now = datetime.now(timezone.utc)
    stale_before = now - timedelta(minutes=settings.telemetry_stale_minutes)
    available = stale = unavailable = 0
    for site in sites:
        if not site.telemetria:
            stale += 1
            continue
        observed = site.telemetria.observada_en
        if observed.tzinfo is None:
            observed = observed.replace(tzinfo=timezone.utc)
        if observed < stale_before:
            stale += 1
        elif site.telemetria.disponible:
            available += 1
        else:
            unavailable += 1
    return {
        "stock_total": sum(item.stock for item in supplies),
        "suministros_total": len(supplies),
        "stock_bajo": sum(1 for item in supplies if item.stock <= item.stock_minimo),
        "sin_stock": sum(1 for item in supplies if item.stock == 0),
        "equipos": {"total": len(sites), "disponibles": available, "sin_conexion": unavailable, "obsoletos": stale},
        "movimientos_recientes": [TransaccionRead.model_validate(item) for item in recent],
    }


@api_router.get("/impresoras", response_model=list[ImpresoraRead], tags=["impresoras"])
def list_printers(db: Session = Depends(get_db)):
    return db.query(Impresora).options(selectinload(Impresora.suministros)).order_by(Impresora.nombre_para_mostrar).all()


@api_router.post("/impresoras", response_model=ImpresoraRead, status_code=201, tags=["impresoras"])
def create_printer(data: ImpresoraWrite, db: Session = Depends(get_db)):
    printer = Impresora(**data.model_dump())
    db.add(printer)
    db.commit()
    db.refresh(printer)
    return printer


@api_router.get("/impresoras/{printer_id}", response_model=ImpresoraRead, tags=["impresoras"])
def read_printer(printer_id: int, db: Session = Depends(get_db)):
    printer = (
        db.query(Impresora).options(selectinload(Impresora.suministros)).filter(Impresora.id == printer_id).first()
    )
    if not printer:
        raise HTTPException(404, "No se encontró la impresora")
    return printer


@api_router.put("/impresoras/{printer_id}", response_model=ImpresoraRead, tags=["impresoras"])
def update_printer(printer_id: int, data: ImpresoraWrite, db: Session = Depends(get_db)):
    printer = get_printer(db, printer_id)
    for key, value in data.model_dump().items():
        setattr(printer, key, value)
    db.commit()
    return printer


@api_router.delete("/impresoras/{printer_id}", status_code=204, tags=["impresoras"])
def delete_printer(printer_id: int, db: Session = Depends(get_db)):
    printer = get_printer(db, printer_id)
    if printer.suministros or printer.impresoras_en_sitio:
        raise HTTPException(409, "La impresora tiene suministros o equipos asociados")
    db.delete(printer)
    db.commit()


@api_router.get("/suministros", tags=["suministros"])
def list_supplies(
    q: str = "",
    tipo: str | None = None,
    estado: str | None = Query(default=None, pattern="^(bajo|agotado|normal)$"),
    impresora_id: int | None = None,
    page_number: int = Query(default=1, alias="page", ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Suministro)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(or_(Suministro.nombre.ilike(term), Suministro.sku.ilike(term), Suministro.upc.ilike(term)))
    if tipo:
        query = query.filter(Suministro.tipo_suministro == tipo)
    if impresora_id:
        query = query.filter(Suministro.impresora_id == impresora_id)
    if estado == "bajo":
        query = query.filter(Suministro.stock <= Suministro.stock_minimo)
    elif estado == "agotado":
        query = query.filter(Suministro.stock == 0)
    elif estado == "normal":
        query = query.filter(Suministro.stock > Suministro.stock_minimo)
    total = query.count()
    offset, limit = pagination(page_number, page_size)
    items = query.order_by(Suministro.nombre).offset(offset).limit(limit).all()
    return page([SuministroRead.model_validate(item) for item in items], total, page_number, page_size)


@api_router.post("/suministros", response_model=SuministroRead, status_code=201, tags=["suministros"])
def create_supply(data: SuministroWrite, db: Session = Depends(get_db)):
    get_printer(db, data.impresora_id)
    supply = Suministro(**data.model_dump(), stock=0)
    db.add(supply)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "El SKU o UPC ya existe")
    db.refresh(supply)
    return supply


@api_router.get("/suministros/{supply_id}", response_model=SuministroRead, tags=["suministros"])
def read_supply(supply_id: int, db: Session = Depends(get_db)):
    return get_supply(db, supply_id)


@api_router.put("/suministros/{supply_id}", response_model=SuministroRead, tags=["suministros"])
def update_supply(supply_id: int, data: SuministroWrite, db: Session = Depends(get_db)):
    supply = get_supply(db, supply_id)
    get_printer(db, data.impresora_id)
    for key, value in data.model_dump().items():
        setattr(supply, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "El SKU o UPC ya existe")
    return supply


@api_router.delete("/suministros/{supply_id}", status_code=204, tags=["suministros"])
def delete_supply(supply_id: int, db: Session = Depends(get_db)):
    supply = get_supply(db, supply_id)
    if supply.transacciones:
        raise HTTPException(409, "El suministro tiene movimientos asociados")
    db.delete(supply)
    db.commit()


@api_router.get("/impresoras-en-sitio", tags=["equipos"])
def list_sites(
    q: str = "",
    page_number: int = Query(default=1, alias="page", ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(ImpresoraEnSitio).options(joinedload(ImpresoraEnSitio.impresora), joinedload(ImpresoraEnSitio.telemetria))
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(or_(ImpresoraEnSitio.nombre.ilike(term), ImpresoraEnSitio.ip.ilike(term)))
    total = query.count()
    offset, limit = pagination(page_number, page_size)
    sites = query.order_by(ImpresoraEnSitio.nombre).offset(offset).limit(limit).all()
    return page([site_payload(site) for site in sites], total, page_number, page_size)


@api_router.post("/impresoras-en-sitio", status_code=201, tags=["equipos"])
def create_site(data: ImpresoraEnSitioWrite, db: Session = Depends(get_db)):
    get_printer(db, data.impresora_id)
    site = ImpresoraEnSitio(**data.model_dump(mode="json"))
    db.add(site)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "El nombre o IP ya existe")
    return site_payload(get_site(db, site.id))


@api_router.get("/impresoras-en-sitio/{site_id}", tags=["equipos"])
def read_site(site_id: int, db: Session = Depends(get_db)):
    return site_payload(get_site(db, site_id))


@api_router.put("/impresoras-en-sitio/{site_id}", tags=["equipos"])
def update_site(site_id: int, data: ImpresoraEnSitioWrite, db: Session = Depends(get_db)):
    site = get_site(db, site_id)
    get_printer(db, data.impresora_id)
    for key, value in data.model_dump(mode="json").items():
        setattr(site, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "El nombre o IP ya existe")
    return site_payload(get_site(db, site.id))


@api_router.delete("/impresoras-en-sitio/{site_id}", status_code=204, tags=["equipos"])
def delete_site(site_id: int, db: Session = Depends(get_db)):
    site = get_site(db, site_id)
    db.delete(site)
    db.commit()


@api_router.get("/impresoras-en-sitio/{site_id}/telemetry", tags=["equipos"])
@api_router.get("/impresoras-en-sitio/{site_id}/snmp", tags=["equipos"], include_in_schema=False)
def read_telemetry(site_id: int, db: Session = Depends(get_db)):
    payload = site_payload(get_site(db, site_id))["telemetria"]
    if not payload:
        raise HTTPException(404, "El colector aún no ha enviado datos de este equipo")
    return payload


def transaction_query(db: Session):
    return db.query(Transaccion).options(joinedload(Transaccion.suministro), joinedload(Transaccion.usuario))


@api_router.get("/transacciones", tags=["movimientos"])
def list_transactions(
    tipo: str | None = None,
    suministro_id: int | None = None,
    page_number: int = Query(default=1, alias="page", ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = transaction_query(db)
    if tipo:
        query = query.filter(Transaccion.tipo_transaccion == tipo)
    if suministro_id:
        query = query.filter(Transaccion.suministro_id == suministro_id)
    total = query.count()
    offset, limit = pagination(page_number, page_size)
    items = query.order_by(desc(Transaccion.id)).offset(offset).limit(limit).all()
    return page([TransaccionRead.model_validate(item) for item in items], total, page_number, page_size)


@api_router.get("/transacciones/{transaction_id}", response_model=TransaccionRead, tags=["movimientos"])
def read_transaction(transaction_id: int, db: Session = Depends(get_db)):
    item = transaction_query(db).filter(Transaccion.id == transaction_id).first()
    if not item:
        raise HTTPException(404, "No se encontró el movimiento")
    return item


@api_router.post("/transacciones", response_model=TransaccionRead, status_code=201, tags=["movimientos"])
def create_transaction(
    data: TransaccionCreate,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    with movement_lock:
        supply = get_supply(db, data.suministro_id)
        before = supply.stock
        if data.tipo_transaccion == TipoTransaccion.SALIDA and before < data.cantidad_afectada:
            raise HTTPException(400, "No hay suficiente stock para completar la salida")
        after = before + data.cantidad_afectada if data.tipo_transaccion == TipoTransaccion.ENTRADA else before - data.cantidad_afectada
        item = Transaccion(
            suministro_id=supply.id,
            usuario_id=usuario.id,
            stock_antes=before,
            cantidad_afectada=data.cantidad_afectada,
            stock_despues=after,
            tipo_transaccion=data.tipo_transaccion.value,
        )
        supply.stock = after
        db.add_all([supply, item])
        db.commit()
        return transaction_query(db).filter(Transaccion.id == item.id).first()


@api_router.post("/transacciones/{transaction_id}/revertir", response_model=TransaccionRead, status_code=201, tags=["movimientos"])
def revert_transaction(
    transaction_id: int,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    with movement_lock:
        latest = transaction_query(db).order_by(desc(Transaccion.id)).first()
        if not latest or latest.id != transaction_id:
            raise HTTPException(400, "Solo se puede revertir el último movimiento")
        if latest.tipo_transaccion not in (TipoTransaccion.ENTRADA.value, TipoTransaccion.SALIDA.value):
            raise HTTPException(400, "Un movimiento de reversión no se puede revertir")
        supply = latest.suministro
        if latest.tipo_transaccion == TipoTransaccion.ENTRADA.value:
            after = supply.stock - latest.cantidad_afectada
            reverse_type = TipoTransaccion.REVERSION_ENTRADA.value
        else:
            after = supply.stock + latest.cantidad_afectada
            reverse_type = TipoTransaccion.REVERSION_SALIDA.value
        if after < 0:
            raise HTTPException(400, "El stock actual no permite esta reversión")
        reverse = Transaccion(
            suministro_id=supply.id,
            usuario_id=usuario.id,
            stock_antes=supply.stock,
            cantidad_afectada=latest.cantidad_afectada,
            stock_despues=after,
            tipo_transaccion=reverse_type,
            transaccion_revertida_id=latest.id,
        )
        supply.stock = after
        db.add_all([supply, reverse])
        db.commit()
        return transaction_query(db).filter(Transaccion.id == reverse.id).first()


@api_router.get("/usuarios", tags=["usuarios"])
def list_users(
    q: str = "",
    page_number: int = Query(default=1, alias="page", ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Usuario)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(or_(Usuario.username.ilike(term), Usuario.nombre.ilike(term)))
    total = query.count()
    offset, limit = pagination(page_number, page_size)
    items = query.order_by(Usuario.nombre).offset(offset).limit(limit).all()
    return page([UsuarioRead.model_validate(item) for item in items], total, page_number, page_size)


@api_router.post("/usuarios", response_model=UsuarioRead, status_code=201, tags=["usuarios"])
def create_user(data: UsuarioCreate, db: Session = Depends(get_db)):
    user = Usuario(
        username=data.username.strip().lower(),
        nombre=data.nombre.strip(),
        password_hash=hash_password(data.password),
        activo=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "El nombre de usuario ya existe")
    db.refresh(user)
    return user


@api_router.patch("/usuarios/{user_id}", response_model=UsuarioRead, tags=["usuarios"])
def update_user(
    user_id: int,
    data: UsuarioUpdate,
    current: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user:
        raise HTTPException(404, "No se encontró el usuario")
    values = data.model_dump(exclude_unset=True)
    if values.get("activo") is False:
        if user.id == current.id:
            raise HTTPException(400, "No puedes desactivar tu propia cuenta")
        if db.query(Usuario).filter(Usuario.activo.is_(True)).count() <= 1:
            raise HTTPException(400, "Debe existir al menos una cuenta activa")
        db.query(Sesion).filter(Sesion.usuario_id == user.id).delete(synchronize_session=False)
    if "password" in values:
        user.password_hash = hash_password(values.pop("password"))
        db.query(Sesion).filter(Sesion.usuario_id == user.id).delete(synchronize_session=False)
    for key, value in values.items():
        setattr(user, key, value)
    db.commit()
    return user


def latest_apk() -> Path:
    folder = Path(settings.apks_folder)
    candidates = list(folder.glob("*.apk")) if folder.exists() else []
    if not candidates:
        raise HTTPException(404, "No hay una aplicación Android disponible")
    try:
        return max(candidates, key=lambda path: int(path.stem.split("_")[-1]))
    except ValueError:
        return max(candidates, key=lambda path: path.stat().st_mtime)


@api_router.get("/apks/latest_version", tags=["descargas"])
def apk_version():
    apk = latest_apk()
    try:
        version = int(apk.stem.split("_")[-1])
    except ValueError:
        version = 0
    return {"version": version, "filename": apk.name}


@api_router.get("/apks/download_apk", tags=["descargas"])
def apk_download():
    return FileResponse(latest_apk(), media_type="application/vnd.android.package-archive")


@collector_router.get("/devices")
def collector_devices(db: Session = Depends(get_db)):
    devices = db.query(ImpresoraEnSitio).options(joinedload(ImpresoraEnSitio.impresora)).order_by(ImpresoraEnSitio.id).all()
    return [
        {"id": item.id, "nombre": item.nombre, "ip": item.ip, "a_color": item.a_color, "modelo": item.impresora.nombre_para_mostrar}
        for item in devices
    ]


@collector_router.post("/telemetry")
def upload_telemetry(batch: TelemetriaBatch, db: Session = Depends(get_db)):
    updated = 0
    for data in batch.items:
        if not db.query(ImpresoraEnSitio.id).filter(ImpresoraEnSitio.id == data.impresora_en_sitio_id).first():
            continue
        telemetry = db.query(TelemetriaImpresora).filter(
            TelemetriaImpresora.impresora_en_sitio_id == data.impresora_en_sitio_id
        ).first()
        if not telemetry:
            telemetry = TelemetriaImpresora(impresora_en_sitio_id=data.impresora_en_sitio_id)
        for key, value in data.model_dump().items():
            if key != "impresora_en_sitio_id":
                setattr(telemetry, key, value)
        db.add(telemetry)
        updated += 1
    db.commit()
    return {"updated": updated}
