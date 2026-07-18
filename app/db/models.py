from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, text
from sqlalchemy.orm import declarative_base, relationship


Base = declarative_base()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Usuario(Base):
    __tablename__ = "pms_usuario"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(80), nullable=False, unique=True, index=True)
    nombre = Column(String(160), nullable=False)
    password_hash = Column(String(255), nullable=False)
    activo = Column(Boolean, nullable=False, default=True, index=True)
    creado_en = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    sesiones = relationship("Sesion", back_populates="usuario", cascade="all, delete-orphan")


class Sesion(Base):
    __tablename__ = "pms_sesion"

    id = Column(Integer, primary_key=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    usuario_id = Column(ForeignKey("pms_usuario.id", ondelete="CASCADE"), nullable=False, index=True)
    expira_en = Column(DateTime(timezone=True), nullable=False, index=True)
    creado_en = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    usuario = relationship("Usuario", back_populates="sesiones")


class Impresora(Base):
    __tablename__ = "pms_impresora"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False, index=True)
    nombre_para_mostrar = Column(String(255), nullable=False, index=True)
    picture_url = Column(String(500), nullable=False, default="")
    cantidad_alquiladas = Column(Integer, nullable=False, default=0)

    suministros = relationship("Suministro", back_populates="impresora")
    impresoras_en_sitio = relationship("ImpresoraEnSitio", back_populates="impresora")


class ImpresoraEnSitio(Base):
    __tablename__ = "pms_impresora_en_sitio"

    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String(255), nullable=False, unique=True, index=True)
    nombre = Column(String(255), nullable=False, unique=True, index=True)
    a_color = Column(Boolean, nullable=False, default=False, index=True)
    impresora_id = Column(ForeignKey("pms_impresora.id"), nullable=False, index=True)

    impresora = relationship("Impresora", back_populates="impresoras_en_sitio")
    telemetria = relationship(
        "TelemetriaImpresora", back_populates="impresora_en_sitio", uselist=False,
        cascade="all, delete-orphan",
    )


class Suministro(Base):
    __tablename__ = "pms_suministro"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False, index=True)
    sku = Column(String(255), nullable=False, unique=True, index=True)
    upc = Column(String(255), nullable=False, unique=True, index=True)
    stock = Column(Integer, nullable=False, default=0)
    stock_minimo = Column(Integer, nullable=False, default=2, server_default=text("2"))
    tipo_suministro = Column(String(255), nullable=False, index=True)
    capacidad_paginas = Column(Integer, nullable=False)
    productos_compatibles = Column(String(500), nullable=False, index=True)
    picture_url = Column(String(500), nullable=False, default="")
    impresora_id = Column(ForeignKey("pms_impresora.id"), nullable=False, index=True)

    transacciones = relationship("Transaccion", back_populates="suministro")
    impresora = relationship("Impresora", back_populates="suministros")


class Transaccion(Base):
    __tablename__ = "pms_transaccion"

    id = Column(Integer, primary_key=True, index=True)
    suministro_id = Column(ForeignKey("pms_suministro.id"), nullable=False, index=True)
    usuario_id = Column(ForeignKey("pms_usuario.id"), nullable=True, index=True)
    stock_antes = Column(Integer, nullable=False)
    cantidad_afectada = Column(Integer, nullable=False)
    stock_despues = Column(Integer, nullable=False)
    tipo_transaccion = Column(String(40), nullable=False, index=True)
    fecha = Column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    transaccion_revertida_id = Column(ForeignKey("pms_transaccion.id"), nullable=True, index=True)

    suministro = relationship("Suministro", back_populates="transacciones")
    usuario = relationship("Usuario")


class TelemetriaImpresora(Base):
    __tablename__ = "pms_telemetria_impresora"

    id = Column(Integer, primary_key=True)
    impresora_en_sitio_id = Column(
        ForeignKey("pms_impresora_en_sitio.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    observada_en = Column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    disponible = Column(Boolean, nullable=False, default=False, index=True)
    error = Column(Text, nullable=True)
    nombre_dispositivo = Column(String(255), nullable=True)
    serie = Column(String(255), nullable=True)
    notificaciones = Column(JSON, nullable=False, default=list)
    toners = Column(JSON, nullable=False, default=list)
    cartucho = Column(JSON, nullable=True)
    consumo = Column(JSON, nullable=True)

    impresora_en_sitio = relationship("ImpresoraEnSitio", back_populates="telemetria")
