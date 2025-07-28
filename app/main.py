from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from app.core.config import settings
from app.db.engine import get_db
from app.db.models import Impresora, Suministro
from app.pms.schemes import ImpresoraRead, SuministroRead


def get_version():
    with open("VERSION") as f:
        return f.read().strip()


app = FastAPI(title="PMS API", debug=settings.is_debug, version=get_version())


@app.get(
    "/pms/impresoras",
    response_model=list[ImpresoraRead],
    tags=["impresoras"],
    description="Retorna todas las impresoras",
)
async def get_all_impresoras(db: Session = Depends(get_db)) -> list[ImpresoraRead]:
    impresoras = db.query(Impresora).options(selectinload(Impresora.suministros)).all()
    return impresoras


@app.get(
    "/pms/impresoras/{impresora_id}",
    response_model=ImpresoraRead,
    tags=["impresoras"],
    description="Retorna una impresora por su ID",
)
async def get_impresora_by_id(
    impresora_id: int, db: Session = Depends(get_db)
) -> ImpresoraRead:
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


@app.get(
    "/pms/suministros",
    response_model=list[SuministroRead],
    tags=["suministros"],
    description="Retorna todos los suministros",
)
async def get_all_suministros(db: Session = Depends(get_db)) -> list[SuministroRead]:
    suministros = db.query(Suministro).all()
    return suministros


@app.get(
    "/pms/suministros/{suministro_id}",
    response_model=SuministroRead,
    tags=["suministros"],
    description="Retorna un suministro por su ID",
)
async def get_suministro_by_id(
    suministro_id: int, db: Session = Depends(get_db)
) -> SuministroRead:
    suministro = db.query(Suministro).filter(Suministro.id == suministro_id).first()
    if not suministro:
        raise HTTPException(
            detail="Ningun suministro con el ID dado fue encontrado",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return suministro
