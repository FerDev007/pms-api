from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SuministroRetrieve(BaseModel):
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


class ImpresoraRetrieve(BaseModel):
    id: int
    nombre: str
    nombre_para_mostrar: str
    picture_url: str
    cantidad_alquiladas: int
    suministros: list[SuministroRetrieve] = []


class TransaccionRetrieve(BaseModel):
    id: int
    suministro_id: int
    stock_antes: int
    cantidad_afectada: int
    stock_despues: int
    tipo_transaccion: str
    fecha: datetime
    transaccion_revertida_id: Optional[int] = None
