from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum
from datetime import datetime


class SuministroRead(BaseModel):
    id: int
    nombre: str
    sku: str
    upc: str
    stock: int
    tipo_suministro: str
    capacidad_paginas: int
    productos_compatibles: str
    picture_url: str
    impresora_id: int


class ImpresoraRead(BaseModel):
    id: int
    nombre: str
    nombre_para_mostrar: str
    picture_url: str
    cantidad_alquiladas: int
    suministros: list[SuministroRead] = []


# Resolver referencias circulares
ImpresoraRead.model_rebuild()
SuministroRead.model_rebuild()


class TipoTransaccion(str, Enum):
    ENTRADA = "entrada"
    SALIDA = "salida"
    REVERSION_ENTRADA = "reversion_entrada"
    REVERSION_SALIDA = "reversion_salida"


class TransaccionRead(BaseModel):
    id: int
    suministro_id: int
    stock_antes: int
    cantidad_afectada: int
    stock_despues: int
    tipo_transaccion: TipoTransaccion
    fecha: datetime
    transaccion_revertida_id: Optional[int] = None


class TransaccionCreate(BaseModel):
    suministro_id: int = Field(..., gt=0)
    cantidad_afectada: int = Field(..., gt=0, lt=10)
    tipo_transaccion: Literal[TipoTransaccion.ENTRADA, TipoTransaccion.SALIDA]
