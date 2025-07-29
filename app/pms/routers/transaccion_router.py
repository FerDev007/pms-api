from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.engine import get_db
from app.pms.service import TransaccionService, SuministroService
from app.pms.schemes import TransaccionRead, TransaccionCreate


transaccion_router = APIRouter(
    prefix="/pms/transacciones",
    tags=["transacciones"],
)

transaccion_service = TransaccionService()
suministro_service = SuministroService()


@transaccion_router.get(
    "",
    response_model=list[TransaccionRead],
    tags=["transacciones"],
    description="Retorna todas las transacciones",
)
async def get_all_transacciones(db: Session = Depends(get_db)) -> list[TransaccionRead]:
    transacciones = transaccion_service.get_all_transacciones(db)
    return transacciones


@transaccion_router.get(
    "/{transaccion_id}",
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


@transaccion_router.post("", response_model=TransaccionRead, tags=["transacciones"])
async def create_transaccion(
    transaccion_data: TransaccionCreate, db: Session = Depends(get_db)
) -> TransaccionRead:
    new_transaccion = transaccion_service.create_transaccion(
        transaccion_data, suministro_service, db
    )

    return new_transaccion


@transaccion_router.post(
    "/{transaccion_id}/revertir",
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
