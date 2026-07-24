# Empaqueta el colector en un solo pms-collector.exe (Windows), autocontenido:
# incluye Python, pysnmp, httpx y todo lo necesario. NO requiere net-snmp ni NSSM.
#
# El resultado queda en app\dist\ -- una carpeta EXCLUIDA de git (ver .gitignore),
# porque es un binario grande y específico del sistema operativo.
#
# Correr en una máquina de desarrollo CON Python (no en el servidor bloqueado):
#   powershell -ExecutionPolicy Bypass -File scripts\build-collector.ps1
#
# Salida: app\dist\pms-collector.exe (+ pms-collector.config para editar)
#         Copia esos dos archivos al servidor.

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$OutDir = Join-Path $Root "app\dist"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

python -m pip install -r requirements.txt pyinstaller

# --collect-all pysnmp/pyasn1: pysnmp carga módulos MIB de forma dinámica y hay que
# incluir esos archivos o falla en tiempo de ejecución.
# --distpath/--workpath/--specpath: todo dentro de app\dist para no ensuciar el repo.
python -m PyInstaller --noconfirm --onefile --name pms-collector `
  --collect-all pysnmp --collect-all pyasn1 `
  --hidden-import bs4 --hidden-import httpx `
  --distpath "$OutDir" `
  --workpath (Join-Path $OutDir "_work") `
  --specpath (Join-Path $OutDir "_spec") `
  run_collector.py

# Deja también la plantilla de config lista para editar, junto al exe.
$cfg = Join-Path $OutDir "pms-collector.config"
if (-not (Test-Path $cfg)) {
  Copy-Item (Join-Path $Root "scripts\pms-collector.config.example") $cfg
  Write-Host "Se creó $cfg -- edítalo con tu token antes de usarlo."
}

Write-Host ""
Write-Host "Listo:"
Write-Host "  $(Join-Path $OutDir 'pms-collector.exe')"
Write-Host "  $cfg"
