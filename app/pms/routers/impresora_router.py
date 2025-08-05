from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.engine import get_db
from app.pms.service import ImpresoraService
from app.pms.schemes import ImpresoraRead, ImpresoraEnSitioRead
from app.pms.snmp_printer_service import (
    XeroxBWPrinterService,
    XeroxColorPrinterService,
    SMNPData,
)


impresora_router = APIRouter(
    prefix="/pms/impresoras",
    tags=["impresoras"],
)
impresora_en_sitio_router = APIRouter(
    prefix="/pms/impresoras-en-sitio",
    tags=["impresoras"],
)

impresora_service = ImpresoraService()
xerox_bw_service = XeroxBWPrinterService()
xerox_color_service = XeroxColorPrinterService()


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


@impresora_en_sitio_router.get(
    "",
    response_model=list[ImpresoraEnSitioRead],
    tags=["impresoras"],
    description="Retorna todas las impresoras en la empresa",
)
async def get_all_impresoras_en_sitio(
    db: Session = Depends(get_db),
) -> list[ImpresoraEnSitioRead]:
    impresoras_en_sitio = impresora_service.get_all_impresoras_en_sitio(db)
    return impresoras_en_sitio


@impresora_en_sitio_router.get(
    "/{impresora_en_sitio_id}",
    response_model=ImpresoraEnSitioRead,
    tags=["impresoras"],
)
async def get_impresora__en_sitio_snmp_data_by_id(
    impresora_en_sitio_id: int, db: Session = Depends(get_db)
) -> ImpresoraEnSitioRead:
    impresora_en_sitio = impresora_service.get_impresora_en_sitio_by_id(
        impresora_en_sitio_id, db
    )
    if not impresora_en_sitio:
        raise HTTPException(
            detail="Ninguna impresora en sitio con el ID dado fue encontrada",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return impresora_en_sitio


@impresora_en_sitio_router.get(
    "/{impresora_en_sitio_id}/snmp",
    response_model=SMNPData,
    tags=["impresoras"],
)
async def get_impresora__en_sitio_snmp_data_by_id(
    impresora_en_sitio_id: int, db: Session = Depends(get_db)
) -> SMNPData:
    impresora_en_sitio = impresora_service.get_impresora_en_sitio_by_id(
        impresora_en_sitio_id, db
    )
    if not impresora_en_sitio:
        raise HTTPException(
            detail="Ninguna impresora en sitio con el ID dado fue encontrada",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    try:
        if impresora_en_sitio.a_color:
            data = await xerox_color_service.get_snmp_data(impresora_en_sitio.ip)
        else:
            data = await xerox_bw_service.get_snmp_data(impresora_en_sitio.ip)
    except Exception as e:
        raise HTTPException(
            detail=f"Error al obtener los datos de la impresora: {e}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    return data
