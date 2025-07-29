from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc
from typing import Optional
from app.db.models import Impresora, Suministro, Transaccion
from .schemes import TransaccionCreate, TipoTransaccion


class ImpresoraService:
    def get_all_impresoras(self, db: Session) -> list[Impresora]:
        return db.query(Impresora).options(selectinload(Impresora.suministros)).all()

    def get_impresora_by_id(
        self, impresora_id: int, db: Session
    ) -> Optional[Impresora]:
        return (
            db.query(Impresora)
            .options(selectinload(Impresora.suministros))
            .filter(Impresora.id == impresora_id)
            .first()
        )


class SuministroService:

    def get_all_suministros(self, db: Session) -> list[Suministro]:
        return db.query(Suministro).all()

    def get_suministro_by_id(
        self, suministro_id: int, db: Session
    ) -> Optional[Suministro]:
        return db.query(Suministro).filter(Suministro.id == suministro_id).first()


class TransaccionService:
    def get_all_transacciones(self, db: Session) -> list[Transaccion]:
        return db.query(Transaccion).order_by(desc(Transaccion.id)).all()

    def get_transaccion_by_id(
        self, transaccion_id: int, db: Session
    ) -> Optional[Transaccion]:
        return db.query(Transaccion).filter(Transaccion.id == transaccion_id).first()

    def create_transaccion(
        self,
        transaccion_data: TransaccionCreate,
        suministro_service: SuministroService,
        db: Session,
    ) -> Transaccion:

        suministro = suministro_service.get_suministro_by_id(
            transaccion_data.suministro_id, db
        )
        if not suministro:
            raise HTTPException(
                detail="Ningun suministro con el ID dado fue encontrado",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        cantidad_afectada = transaccion_data.cantidad_afectada
        tipo_transaccion = transaccion_data.tipo_transaccion
        stock_antes = suministro.stock

        new_transaccion = Transaccion(**transaccion_data.model_dump())
        if tipo_transaccion == TipoTransaccion.ENTRADA:
            new_transaccion.stock_despues = stock_antes + cantidad_afectada

        elif tipo_transaccion == TipoTransaccion.SALIDA:
            if suministro.stock - cantidad_afectada < 0:
                raise HTTPException(
                    detail="No hay suficiente stock para realizar la transaccion",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            new_transaccion.stock_despues = stock_antes - cantidad_afectada

        # Actualizamos el stock del suministro y guardamos la transaccion
        new_transaccion.stock_antes = stock_antes
        new_transaccion.cantidad_afectada = cantidad_afectada
        suministro.stock = new_transaccion.stock_despues

        db.add(new_transaccion)
        db.add(suministro)
        db.commit()
        db.refresh(new_transaccion)
        return new_transaccion

    def revert_transaccion(
        self,
        transaccion_a_revertir: Transaccion,
        suministro_service: SuministroService,
        db: Session,
    ):

        ultima_transaccion = (
            db.query(Transaccion).order_by(desc(Transaccion.id)).first()
        )

        if transaccion_a_revertir.id != ultima_transaccion.id:
            raise HTTPException(
                detail="No se puede revertir una transaccion que no sea la ultima",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if transaccion_a_revertir.tipo_transaccion not in [
            TipoTransaccion.ENTRADA,
            TipoTransaccion.SALIDA,
        ]:
            raise HTTPException(
                detail="No se puede revertir una transaccion de reversion",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # sunministro de la transaccion a revertir
        suministro = suministro_service.get_suministro_by_id(
            transaccion_a_revertir.suministro_id, db
        )

        tipo_transaccion = None
        stock_despues_de_transaccion_de_reversion = None
        if transaccion_a_revertir.tipo_transaccion == TipoTransaccion.ENTRADA:
            tipo_transaccion = TipoTransaccion.REVERSION_ENTRADA
            stock_despues_de_transaccion_de_reversion = (
                transaccion_a_revertir.stock_despues
                - transaccion_a_revertir.cantidad_afectada
            )

        elif transaccion_a_revertir.tipo_transaccion == TipoTransaccion.SALIDA:
            tipo_transaccion = TipoTransaccion.REVERSION_SALIDA
            stock_despues_de_transaccion_de_reversion = (
                transaccion_a_revertir.stock_despues
                + transaccion_a_revertir.cantidad_afectada
            )

        if stock_despues_de_transaccion_de_reversion < 0:
            raise HTTPException(
                detail="No hay suficiente stock para realizar la transaccion",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Creamos la transaccion de reversion y actualizamos el stock al suministro
        new_transaccion = Transaccion(
            suministro_id=suministro.id,
            stock_antes=transaccion_a_revertir.stock_despues,
            cantidad_afectada=transaccion_a_revertir.cantidad_afectada,
            stock_despues=stock_despues_de_transaccion_de_reversion,
            tipo_transaccion=tipo_transaccion,
            transaccion_revertida_id=transaccion_a_revertir.id,
        )
        suministro.stock = new_transaccion.stock_despues

        db.add(new_transaccion)
        db.add(suministro)
        db.commit()
        db.refresh(new_transaccion)
        return new_transaccion
