from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from app.core.config import settings
from app.db.engine import get_db
from app.db.models import Impresora, Suministro
from app.pms.schemes import ImpresoraRetrieve


def get_version():
    with open("VERSION") as f:
        return f.read().strip()


app = FastAPI(title="PMS API", debug=settings.is_debug, version=get_version())


@app.get("/pms/impresoras", response_model=list[ImpresoraRetrieve])
async def ok(db: Session = Depends(get_db)) -> list[ImpresoraRetrieve]:
    impresoras = db.query(Impresora).options(selectinload(Impresora.suministros)).all()
    return impresoras


@app.get("/pms/impresoras/{impresora_id}", response_model=ImpresoraRetrieve)
async def ok(impresora_id: int, db: Session = Depends(get_db)) -> ImpresoraRetrieve:
    impresora = (
        db.query(Impresora)
        .options(selectinload(Impresora.suministros))
        .filter(Impresora.id == impresora_id)
    ).first()

    if not impresora:
        raise HTTPException(
            detail="Ninguna impresora con el ID dado fue encontrada",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return impresora
