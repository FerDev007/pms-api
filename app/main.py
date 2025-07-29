from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.engine import get_db
from app.db.models import Impresora, Suministro, Transaccion
from app.pms.service import ImpresoraService, SuministroService, TransaccionService
from app.pms.schemes import (
    ImpresoraRead,
    SuministroRead,
    TransaccionRead,
    TransaccionCreate,
    TipoTransaccion,
)


def get_version():
    with open("VERSION") as f:
        return f.read().strip()


app = FastAPI(title="PMS API", debug=settings.is_debug, version=get_version())

impresora_service = ImpresoraService()
suministro_service = SuministroService()
transaccion_service = TransaccionService()


@app.get(
    "/pms/impresoras",
    response_model=list[ImpresoraRead],
    tags=["impresoras"],
    description="Retorna todas las impresoras",
)
async def get_all_impresoras(db: Session = Depends(get_db)) -> list[ImpresoraRead]:
    impresoras = impresora_service.get_all_impresoras(db)
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
    impresora = impresora_service.get_impresora_by_id(impresora_id, db)
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
    suministros = suministro_service.get_all_suministros(db)
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
    suministro = suministro_service.get_suministro_by_id(suministro_id, db)
    if not suministro:
        raise HTTPException(
            detail="Ningun suministro con el ID dado fue encontrado",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return suministro


@app.get(
    "/pms/transacciones",
    response_model=list[TransaccionRead],
    tags=["transacciones"],
    description="Retorna todas las transacciones",
)
async def get_all_transacciones(db: Session = Depends(get_db)) -> list[TransaccionRead]:
    transacciones = transaccion_service.get_all_transacciones(db)
    return transacciones


@app.get(
    "/pms/transacciones/{transaccion_id}",
    response_model=TransaccionRead,
    tags=["transacciones"],
    description="Retorna una transaccion por su ID",
)
async def get_transaccion_by_id(
    transaccion_id: int, db: Session = Depends(get_db)
) -> TransaccionRead:
    transaccion = transaccion_service.get_transaccion_by_id(transaccion_id, db)
    if not transaccion:
        raise HTTPException(
            detail="Ninguna transaccion con el ID dado fue encontrada",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return transaccion


@app.post("/pms/transacciones", response_model=TransaccionRead, tags=["transacciones"])
async def create_transaccion(
    transaccion_data: TransaccionCreate, db: Session = Depends(get_db)
) -> TransaccionRead:
    new_transaccion = transaccion_service.create_transaccion(
        transaccion_data, suministro_service, db
    )

    return new_transaccion


@app.post(
    "/pms/transacciones/{transaccion_id}/revertir",
    response_model=TransaccionRead,
    tags=["transacciones"],
)
async def create_revert_transaccion(
    transaccion_id: int, db: Session = Depends(get_db)
) -> TransaccionRead:

    transaccion = transaccion_service.get_transaccion_by_id(transaccion_id, db)
    if not transaccion:
        raise HTTPException(
            detail="Ninguna transaccion con el ID dado fue encontrada",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    revert_transaccion = transaccion_service.revert_transaccion(
        transaccion, suministro_service, db
    )

    return revert_transaccion
