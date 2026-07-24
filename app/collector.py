"""On-premise printer collector.

Stays Python and stays on-prem: it talks SNMP over UDP to printers on the local
network, which Supabase Edge Functions cannot reach. Only the base URL changed when
the API moved -- the endpoints and the X-Collector-Token header are unchanged.

Run once with:
    python -m app.collector \\
        --base-url https://vhnlvowjqkolpbcbuylr.supabase.co/functions/v1 \\
        --token $COLLECTOR_TOKEN --once

Note the base URL stops at /functions/v1 -- the request paths below already start with
/pms, which is the Edge Function's name. Including it in the base URL doubles it.
The token must match the COLLECTOR_TOKEN secret set on the Edge Function.
"""

import argparse
import asyncio
import os
import sys
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


def log(mensaje: str) -> None:
    # Timestamped and flushed so the lines show up in the Windows service log
    # (NSSM) right away instead of sitting in a buffer.
    hora = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{hora}] {mensaje}", flush=True)


def pausa_si_interactivo() -> None:
    """Si se abrió con doble clic (consola interactiva), espera un Enter para que se
    alcance a leer el mensaje antes de que la ventana se cierre. Bajo el Programador
    de tareas no hay consola interactiva, así que no se queda colgado."""
    try:
        if sys.stdin and sys.stdin.isatty():
            input("\nPresiona Enter para cerrar...")
    except Exception:
        pass


def cargar_config() -> None:
    """Carga un archivo `pms-collector.config` (líneas CLAVE=valor) que esté junto al
    ejecutable. Así el .exe empaquetado se configura sin poner el token en la tarea de
    Windows ni en argumentos visibles."""
    base = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.getcwd()
    ruta = os.path.join(base, "pms-collector.config")
    if not os.path.exists(ruta):
        return
    for linea in open(ruta, encoding="utf-8"):
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, _, valor = linea.partition("=")
        os.environ.setdefault(clave.strip(), valor.strip())


async def main() -> None:
    cargar_config()
    parser = argparse.ArgumentParser(description="Colector local de telemetría PMS")
    # Los argumentos ganan; si faltan, se toman del archivo de config / variables de entorno.
    parser.add_argument("--base-url", default=os.environ.get("PMS_BASE_URL"))
    parser.add_argument("--token", default=os.environ.get("PMS_COLLECTOR_TOKEN"))
    parser.add_argument("--interval", type=int, default=int(os.environ.get("PMS_INTERVAL", "300")))
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    if not args.base_url or not args.token:
        log(
            "Falta configuración. Este programa necesita un archivo 'pms-collector.config'\n"
            "en la MISMA carpeta que el .exe, con este contenido:\n\n"
            "  PMS_BASE_URL=https://vhnlvowjqkolpbcbuylr.supabase.co/functions/v1\n"
            "  PMS_COLLECTOR_TOKEN=tu-token-de-colector\n"
            "  PMS_INTERVAL=300\n"
        )
        pausa_si_interactivo()
        sys.exit(1)
    while True:
        # Running as a service means "forget about it": a transient network or API
        # error must not kill the loop. Catch per cycle, log it, and try again next
        # tick. Unreachable individual printers are already handled inside run_cycle.
        try:
            count = await run_cycle(args.base_url, args.token)
            log(f"Telemetría enviada para {count} equipos")
        except Exception as exc:
            log(f"Error en el ciclo (se reintenta): {exc}")
        if args.once:
            break
        await asyncio.sleep(max(args.interval, 60))


if __name__ == "__main__":
    asyncio.run(main())
