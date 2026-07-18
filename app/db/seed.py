from pathlib import Path

from sqlalchemy.orm import Session

from app.db.models import Impresora, ImpresoraEnSitio


SITES = [
    ("10.250.36.170", False, 1, "RRHH"),
    ("10.250.37.56", False, 1, "Oficina del pueblo"),
    ("10.250.36.197", False, 1, "PC&L Almacén"),
    ("10.250.37.32", False, 1, "Automáticas"),
    ("10.250.36.39", False, 1, "Jaula de Corte"),
    ("10.250.36.103", False, 1, "Jaula MCC"),
    ("10.250.36.114", False, 1, "Moldeo"),
    ("10.250.36.141", False, 1, "Finanzas"),
    ("10.250.36.123", False, 1, "Jaula Fakra"),
    ("10.136.68.4", False, 1, "Almacén HN03"),
    ("10.250.36.177", False, 5, "Ingeniería"),
    ("10.250.36.87", True, 4, "Colores customer service"),
    ("10.250.36.195", False, 6, "TPA Almacén"),
    ("10.136.67.80", False, 6, "Producción HN03"),
    ("10.250.36.14", True, 7, "Colores PC&L"),
]


def seed_catalog(db: Session) -> None:
    if db.query(Impresora).count() > 0:
        return
    sql_path = Path(__file__).resolve().parents[2] / "seed.sql"
    raw = db.connection().connection
    raw.executescript(sql_path.read_text(encoding="utf-8"))
    db.commit()
    for ip, color, printer_id, name in SITES:
        db.add(
            ImpresoraEnSitio(
                ip=ip,
                a_color=color,
                impresora_id=printer_id,
                nombre=name,
            )
        )
    db.commit()
