"""Punto de entrada para empaquetar el colector con PyInstaller en un solo .exe.

PyInstaller sigue este import y mete el paquete `app` completo (incluido el servicio
SNMP, que ahora usa pysnmp y no depende del binario externo `snmpwalk`).
"""

import asyncio

from app.collector import main, pausa_si_interactivo

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as exc:
        # Si algo truena al iniciar y se abrió con doble clic, muestra el error y espera
        # en vez de cerrar la ventana al instante.
        print(f"\nError inesperado: {exc}", flush=True)
        pausa_si_interactivo()
        raise SystemExit(1)
