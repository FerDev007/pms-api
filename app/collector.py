"""On-premise printer collector.

Run once with:
    python -m app.collector --base-url https://your-app.onrender.com --token SECRET --once
"""

import argparse
import asyncio
from datetime import datetime, timezone

import httpx

from app.pms.snmp_printer_service import XeroxBWPrinterService, XeroxColorPrinterService


async def collect_device(device: dict) -> dict:
    service = XeroxColorPrinterService() if device["a_color"] else XeroxBWPrinterService()
    observed = datetime.now(timezone.utc).isoformat()
    try:
        data = await service.get_snmp_data(device["ip"])
        raw = data.model_dump(mode="json")
        notifications = raw.get("notificaciones") or []
        if isinstance(notifications, str):
            notifications = [value.strip() for value in notifications.split("|") if value.strip()]
        return {
            "impresora_en_sitio_id": device["id"],
            "observada_en": observed,
            "disponible": True,
            "nombre_dispositivo": raw.get("nombre"),
            "serie": raw.get("serie"),
            "notificaciones": notifications,
            "toners": raw.get("toners") or [],
            "cartucho": raw.get("cartucho"),
            "consumo": raw.get("consumo"),
        }
    except Exception as exc:
        return {
            "impresora_en_sitio_id": device["id"],
            "observada_en": observed,
            "disponible": False,
            "error": str(exc),
            "notificaciones": [],
            "toners": [],
        }


async def run_cycle(base_url: str, token: str) -> int:
    headers = {"X-Collector-Token": token}
    async with httpx.AsyncClient(base_url=base_url.rstrip("/"), headers=headers, timeout=60) as client:
        response = await client.get("/pms/collector/devices")
        response.raise_for_status()
        devices = response.json()
        items = await asyncio.gather(*(collect_device(device) for device in devices))
        if items:
            upload = await client.post("/pms/collector/telemetry", json={"items": items})
            upload.raise_for_status()
        return len(items)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Colector local de telemetría PMS")
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--token", required=True)
    parser.add_argument("--interval", type=int, default=300)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    while True:
        count = await run_cycle(args.base_url, args.token)
        print(f"Telemetría enviada para {count} equipos")
        if args.once:
            break
        await asyncio.sleep(max(args.interval, 60))


if __name__ == "__main__":
    asyncio.run(main())
