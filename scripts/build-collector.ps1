# Empaqueta el colector en un solo pms-collector.exe (Windows), autocontenido:
# incluye Python, pysnmp, httpx y todo lo necesario. NO requiere net-snmp ni NSSM.
#
# Correr en una máquina de desarrollo CON Python (no en el servidor bloqueado):
#   powershell -ExecutionPolicy Bypass -File scripts\build-collector.ps1
#
# Salida: dist\pms-collector.exe  -> cópialo al servidor junto con pms-collector.config

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

python -m pip install -r requirements.txt pyinstaller

# --collect-all pysnmp/pyasn1: pysnmp carga módulos MIB de forma dinámica y hay que
# incluir esos archivos o falla en tiempo de ejecución.
python -m PyInstaller --noconfirm --onefile --name pms-collector `
  --collect-all pysnmp --collect-all pyasn1 `
  --hidden-import bs4 --hidden-import httpx `
  run_collector.py

Write-Host ""
Write-Host "Listo: dist\pms-collector.exe"
