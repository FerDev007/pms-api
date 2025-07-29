from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.engine import get_db
from app.pms.service import SuministroService
from app.pms.schemes import SuministroRead

suministro_router = APIRouter(
    prefix="/pms/suministros",
    tags=["suministros"],
)
suministro_service = SuministroService()


@suministro_router.get(
    "",
    response_model=list[SuministroRead],
    tags=["suministros"],
    description="Retorna todos los suministros",
)
async def get_all_suministros(db: Session = Depends(get_db)) -> list[SuministroRead]:
    suministros = suministro_service.get_all_suministros(db)
    return suministros


@suministro_router.get(
    "/{suministro_id}",
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
