from sqlalchemy import String, Integer, Column, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base


Base = declarative_base()


class Impresora(Base):
    __tablename__ = "pms_impresora"

    id: int = Column(Integer, primary_key=True, index=True)
    nombre: str = Column(String(length=255), nullable=False, index=True)
    nombre_para_mostrar: str = Column(String(length=255), nullable=False, index=True)
    picture_url: str = Column(String(length=255), nullable=False)
    cantidad_alquiladas: int = Column(Integer, nullable=True)

    # Relaciones
    suministros = relationship("Suministro")
    impresoras_en_sitio = relationship("ImpresoraEnSitio")


class ImpresoraEnSitio(Base):
    __tablename__ = "pms_impresora_en_sitio"

    id: int = Column(Integer, primary_key=True, index=True)
    ip: str = Column(String(length=255), nullable=False, unique=True, index=True)
    nombre: str = Column(String(255), nullable=False, unique=True)
    a_color: bool = Column(Boolean, nullable=False, index=True)
    impresora_id: int = Column(
        ForeignKey("pms_impresora.id"),
        nullable=False,
        index=True,
    )
    impresora = relationship(Impresora, back_populates="impresoras_en_sitio")


class Suministro(Base):
    __tablename__ = "pms_suministro"

    id: int = Column(Integer, primary_key=True, index=True)
    nombre: str = Column(String(length=255), nullable=False, index=True)
    sku: str = Column(String(length=255), nullable=False, index=True)
    upc: str = Column(String(length=255), nullable=False, index=True)
    stock: int = Column(Integer, nullable=False, default=0)
    tipo_suministro: str = Column(String(length=255), nullable=False, index=True)
    capacidad_paginas: int = Column(Integer, nullable=False)
    productos_compatibles: str = Column(String(length=255), nullable=False, index=True)
    picture_url: str = Column(String(length=255), nullable=False)
    impresora_id: int = Column(
        ForeignKey("pms_impresora.id"), nullable=False, index=True
    )

    # Relaciones
    transacciones = relationship("Transaccion")
    impresora = relationship("Impresora", back_populates="suministros")


class Transaccion(Base):
    __tablename__ = "pms_transaccion"

    id: int = Column(Integer, primary_key=True, index=True)
    suministro_id: int = Column(ForeignKey("pms_suministro.id"), nullable=False)
    stock_antes: int = Column(Integer, nullable=False)
    cantidad_afectada: int = Column(Integer, nullable=False)
    stock_despues: int = Column(Integer, nullable=False)
    tipo_transaccion: str = Column(String(length=255), nullable=False, index=True)
    fecha: datetime = Column(DateTime, nullable=False, default=func.now())
    transaccion_revertida_id: int = Column(
        ForeignKey("pms_transaccion.id"), nullable=True, index=True
    )

    # Relaciones
    suministro = relationship(Suministro, back_populates="transacciones")
