import os
from datetime import datetime, timezone
from pathlib import Path


TEST_DB = Path(".pytest_pms.db")
TEST_DB.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["IS_DEBUG"] = "true"
os.environ["BOOTSTRAP_USERNAME"] = "admin"
os.environ["BOOTSTRAP_PASSWORD"] = "admin12345"
os.environ["COLLECTOR_TOKEN"] = "collector-test-token"

from fastapi.testclient import TestClient

from app.main import app


def login(client: TestClient) -> None:
    response = client.post(
        "/pms/auth/login",
        json={"username": "admin", "password": "admin12345"},
    )
    assert response.status_code == 200


def test_complete_application_flow():
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/pms/dashboard").status_code == 401
        login(client)

        dashboard = client.get("/pms/dashboard")
        assert dashboard.status_code == 200
        assert dashboard.json()["suministros_total"] > 0

        supplies = client.get("/pms/suministros?page_size=100").json()["items"]
        supply = supplies[0]
        entry = client.post(
            "/pms/transacciones",
            json={"suministro_id": supply["id"], "cantidad_afectada": 7, "tipo_transaccion": "entrada"},
        )
        assert entry.status_code == 201
        assert entry.json()["stock_despues"] == supply["stock"] + 7

        output = client.post(
            "/pms/transacciones",
            json={"suministro_id": supply["id"], "cantidad_afectada": 2, "tipo_transaccion": "salida"},
        )
        assert output.status_code == 201
        assert output.json()["stock_despues"] == supply["stock"] + 5

        old_reversal = client.post(f"/pms/transacciones/{entry.json()['id']}/revertir")
        assert old_reversal.status_code == 400
        reversal = client.post(f"/pms/transacciones/{output.json()['id']}/revertir")
        assert reversal.status_code == 201
        assert reversal.json()["stock_despues"] == supply["stock"] + 7

        protected_delete = client.delete(f"/pms/suministros/{supply['id']}")
        assert protected_delete.status_code == 409

        created_user = client.post(
            "/pms/usuarios",
            json={"username": "almacen", "nombre": "Equipo de almacén", "password": "secure-pass-123"},
        )
        assert created_user.status_code == 201
        disabled = client.patch(f"/pms/usuarios/{created_user.json()['id']}", json={"activo": False})
        assert disabled.status_code == 200
        assert disabled.json()["activo"] is False

        devices = client.get(
            "/pms/collector/devices", headers={"X-Collector-Token": "collector-test-token"}
        )
        assert devices.status_code == 200
        device = devices.json()[0]
        upload = client.post(
            "/pms/collector/telemetry",
            headers={"X-Collector-Token": "collector-test-token"},
            json={
                "items": [
                    {
                        "impresora_en_sitio_id": device["id"],
                        "observada_en": datetime.now(timezone.utc).isoformat(),
                        "disponible": True,
                        "nombre_dispositivo": "Xerox test",
                        "serie": "TEST-001",
                        "notificaciones": [],
                        "toners": [{"nombre": "Toner", "color": "Negro", "uso": 82}],
                        "cartucho": {"nombre": "Cartucho", "uso": 65},
                        "consumo": {"impresiones_en_negro": 100, "total_impresiones": 100},
                    }
                ]
            },
        )
        assert upload.status_code == 200
        telemetry = client.get(f"/pms/impresoras-en-sitio/{device['id']}/telemetry")
        assert telemetry.status_code == 200
        assert telemetry.json()["serie"] == "TEST-001"
        assert telemetry.json()["obsoleta"] is False

        invalid_collector = client.get(
            "/pms/collector/devices", headers={"X-Collector-Token": "wrong"}
        )
        assert invalid_collector.status_code == 401
