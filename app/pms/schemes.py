from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, IPvAnyAddress


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TipoTransaccion(str, Enum):
    ENTRADA = "entrada"
    SALIDA = "salida"
    REVERSION_ENTRADA = "reversion_entrada"
    REVERSION_SALIDA = "reversion_salida"


class UsuarioRead(ORMModel):
    id: int
    username: str
    nombre: str
    activo: bool
    creado_en: datetime


class UsuarioCreate(BaseModel):
    username: str = Field(min_length=3, max_length=80, pattern=r"^[a-zA-Z0-9._-]+$")
    nombre: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=8, max_length=128)


class UsuarioUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=2, max_length=160)
    activo: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class PasswordChange(BaseModel):
    password_actual: str
    password_nuevo: str = Field(min_length=8, max_length=128)


class SuministroRead(ORMModel):
    id: int
    nombre: str
    sku: str
    upc: str
    stock: int
    stock_minimo: int
    tipo_suministro: str
    capacidad_paginas: int
    productos_compatibles: str
    picture_url: str
    impresora_id: int


class SuministroWrite(BaseModel):
    nombre: str = Field(min_length=2, max_length=255)
    sku: str = Field(min_length=2, max_length=255)
    upc: str = Field(min_length=4, max_length=255)
    stock_minimo: int = Field(ge=0, le=9999)
    tipo_suministro: str = Field(min_length=2, max_length=255)
    capacidad_paginas: int = Field(gt=0)
    productos_compatibles: str = Field(min_length=2, max_length=500)
    picture_url: str = Field(default="", max_length=500)
    impresora_id: int = Field(gt=0)


class ImpresoraReadSimple(ORMModel):
    id: int
    nombre: str
    nombre_para_mostrar: str
    picture_url: str


class ImpresoraRead(ImpresoraReadSimple):
    cantidad_alquiladas: int
    suministros: list[SuministroRead] = []


class ImpresoraWrite(BaseModel):
    nombre: str = Field(min_length=2, max_length=255)
    nombre_para_mostrar: str = Field(min_length=2, max_length=255)
    picture_url: str = Field(default="", max_length=500)
    cantidad_alquiladas: int = Field(default=0, ge=0)


class TelemetriaRead(ORMModel):
    observada_en: datetime
    disponible: bool
    obsoleta: bool = False
    error: str | None = None
    nombre_dispositivo: str | None = None
    serie: str | None = None
    notificaciones: list[str] = []
    toners: list[dict] = []
    cartucho: dict | None = None
    consumo: dict | None = None


class ImpresoraEnSitioRead(ORMModel):
    id: int
    nombre: str
    ip: str
    a_color: bool
    impresora: ImpresoraReadSimple
    telemetria: TelemetriaRead | None = None


class ImpresoraEnSitioWrite(BaseModel):
    nombre: str = Field(min_length=2, max_length=255)
    ip: IPvAnyAddress
    a_color: bool = False
    impresora_id: int = Field(gt=0)


class TransaccionRead(ORMModel):
    id: int
    suministro: SuministroRead
    usuario: UsuarioRead | None = None
    stock_antes: int
    cantidad_afectada: int
    stock_despues: int
    tipo_transaccion: TipoTransaccion
    fecha: datetime
    transaccion_revertida_id: int | None = None


class TransaccionCreate(BaseModel):
    suministro_id: int = Field(gt=0)
    cantidad_afectada: int = Field(gt=0, le=9999)
    tipo_transaccion: Literal[TipoTransaccion.ENTRADA, TipoTransaccion.SALIDA]


class TelemetriaItem(BaseModel):
    impresora_en_sitio_id: int = Field(gt=0)
    observada_en: datetime
    disponible: bool
    error: str | None = None
    nombre_dispositivo: str | None = None
    serie: str | None = None
    notificaciones: list[str] = []
    toners: list[dict] = []
    cartucho: dict | None = None
    consumo: dict | None = None


class TelemetriaBatch(BaseModel):
    items: list[TelemetriaItem] = Field(min_length=1, max_length=200)
