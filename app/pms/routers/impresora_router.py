from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.engine import get_db
from app.pms.service import ImpresoraService
from app.pms.schemes import ImpresoraRead


impresora_router = APIRouter(
    prefix="/pms/impresoras",
    tags=["impresoras"],
)
impresora_service = ImpresoraService()


@impresora_router.get(
    "",
    response_model=list[ImpresoraRead],
    tags=["impresoras"],
    description="Retorna todas las impresoras",
)
async def get_all_impresoras(db: Session = Depends(get_db)) -> list[ImpresoraRead]:
    impresoras = impresora_service.get_all_impresoras(db)
    return impresoras


@impresora_router.get(
    "/{impresora_id}",
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
