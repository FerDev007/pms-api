"""Punto de entrada para empaquetar el colector con PyInstaller en un solo .exe.

PyInstaller sigue este import y mete el paquete `app` completo (incluido el servicio
SNMP, que ahora usa pysnmp y no depende del binario externo `snmpwalk`).
"""

import asyncio

from app.collector import main

if __name__ == "__main__":
    asyncio.run(main())
