"""script to insert initial ImpresoraEnSitio records.

Revision ID: 7cdb1bd2cc7b
Revises: a85bb2c8c88f
Create Date: 2025-08-01 06:31:37.308101

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from app.db.models import *


# revision identifiers, used by Alembic.
revision: str = "7cdb1bd2cc7b"
down_revision: Union[str, Sequence[str], None] = "a85bb2c8c88f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    impresoras = [
        {"ip": "10.250.36.170", "a_color": False, "impresora_id": 1, "nombre": "RRHH"},
        {
            "ip": "10.250.37.56",
            "a_color": False,
            "impresora_id": 1,
            "nombre": "Oficina del pueblo",
        },
        {
            "ip": "10.250.36.197",
            "a_color": False,
            "impresora_id": 1,
            "nombre": "PC&L Almacen",
        },
        {
            "ip": "10.250.37.32",
            "a_color": False,
            "impresora_id": 1,
            "nombre": "Automaticas",
        },
        {
            "ip": "10.250.36.39",
            "a_color": False,
            "impresora_id": 1,
            "nombre": "Jaula de Corte",
        },
        {
            "ip": "10.250.36.103",
            "a_color": False,
            "impresora_id": 1,
            "nombre": "Jaula MCC",
        },
        {
            "ip": "10.250.36.114",
            "a_color": False,
            "impresora_id": 1,
            "nombre": "Moldeo",
        },
        {
            "ip": "10.250.36.141",
            "a_color": False,
            "impresora_id": 1,
            "nombre": "Finanzas",
        },
        {
            "ip": "10.250.36.123",
            "a_color": False,
            "impresora_id": 1,
            "nombre": "Jaula Fakra",
        },
        {
            "ip": "10.136.68.4",
            "a_color": False,
            "impresora_id": 1,
            "nombre": "Almacen HN03",
        },
        {
            "ip": "10.250.36.177",
            "a_color": False,
            "impresora_id": 5,
            "nombre": "Ingenieria",
        },
        {
            "ip": "10.250.36.87",
            "a_color": True,
            "impresora_id": 4,
            "nombre": "Colores customer service",
        },
        {
            "ip": "10.250.36.195",
            "a_color": False,
            "impresora_id": 6,
            "nombre": "TPA Almacen",
        },
        {
            "ip": "10.136.67.80",
            "a_color": False,
            "impresora_id": 6,
            "nombre": "Produccion HN03",
        },
        {
            "ip": "10.250.36.14",
            "a_color": True,
            "impresora_id": 7,
            "nombre": "Colores PC&L",
        },
    ]

    op.bulk_insert(
        sa.table(
            "pms_impresora_en_sitio",
            sa.column("ip", sa.String),
            sa.column("a_color", sa.Boolean),
            sa.column("impresora_id", sa.Integer),
            sa.column("nombre", sa.String),
        ),
        impresoras,
    )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    bind.execute("DELETE FROM pms_impresora_en_sitio")
