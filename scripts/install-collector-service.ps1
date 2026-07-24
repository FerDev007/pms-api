# Instala el colector PMS como servicio de Windows usando NSSM.
# Arranca con Windows, se reinicia solo si se cae, y no depende de una sesión abierta.
#
# Requisitos previos (ver README / mensaje del asistente):
#   1. Python 3 instalado.
#   2. Dependencias: python -m pip install -r requirements.txt
#   3. net-snmp instalado y `snmpwalk` en el PATH del sistema.
#   4. NSSM instalado (winget install NSSM.NSSM  o  https://nssm.cc).
#   5. COLLECTOR_TOKEN configurado como secreto en la Edge Function (mismo valor de abajo).
#
# Ejecutar en PowerShell COMO ADMINISTRADOR:
#   powershell -ExecutionPolicy Bypass -File scripts\install-collector-service.ps1

# ============ EDITA ESTOS 4 VALORES ============
$RepoDir  = "C:\pms-api"                                                        # carpeta del repo en el servidor
$Python   = "C:\Program Files\Python313\python.exe"                            # ruta completa a python.exe
$Token    = "PON-AQUI-EL-MISMO-TOKEN-DE-LA-FUNCION"                            # == COLLECTOR_TOKEN de la Edge Function
$BaseUrl  = "https://vhnlvowjqkolpbcbuylr.supabase.co/functions/v1"           # termina en /functions/v1, SIN /pms
# ===============================================

$ServiceName = "PMSCollector"
$Interval    = 300   # segundos entre ciclos (5 min)
$LogDir      = Join-Path $RepoDir "logs"

$ErrorActionPreference = "Stop"

# --- comprobaciones antes de instalar ---
if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) {
  throw "NSSM no está en el PATH. Instálalo con 'winget install NSSM.NSSM' o desde https://nssm.cc y vuelve a abrir la terminal."
}
if (-not (Test-Path $Python))                  { throw "No existe python.exe en: $Python" }
if (-not (Test-Path (Join-Path $RepoDir "app\collector.py"))) { throw "No encuentro app\collector.py dentro de: $RepoDir" }
if (-not (Get-Command snmpwalk -ErrorAction SilentlyContinue)) {
  Write-Warning "snmpwalk no está en el PATH. Sin net-snmp el colector marcará todas las impresoras como 'sin conexión'. Instálalo antes de confiar en los datos."
}
if ($Token -like "*PON-AQUI*") { throw "Falta editar el Token en este script." }

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# --- si ya existía, se quita para reinstalar limpio ---
if (Get-Service $ServiceName -ErrorAction SilentlyContinue) {
  Write-Host "El servicio ya existe; se reinstala..."
  nssm stop   $ServiceName confirm 2>$null | Out-Null
  nssm remove $ServiceName confirm | Out-Null
  Start-Sleep -Seconds 1
}

# Modo continuo (sin --once): el propio script hace el bucle cada $Interval.
$params = "-m app.collector --base-url `"$BaseUrl`" --token `"$Token`" --interval $Interval"

nssm install $ServiceName "$Python" $params
nssm set $ServiceName AppDirectory  "$RepoDir"          # para que 'python -m app.collector' encuentre el paquete
nssm set $ServiceName DisplayName   "PMS - Colector de impresoras"
nssm set $ServiceName Description    "Consulta las impresoras por SNMP y envía la telemetría al API de PMS."
nssm set $ServiceName Start          SERVICE_AUTO_START  # arranca con Windows
nssm set $ServiceName AppStdout      (Join-Path $LogDir "collector.log")
nssm set $ServiceName AppStderr      (Join-Path $LogDir "collector.log")
nssm set $ServiceName AppRotateFiles 1                   # rota el log para que no crezca sin fin
nssm set $ServiceName AppRotateBytes 1048576             # ~1 MB por archivo
nssm set $ServiceName AppExit Default Restart            # si se cae, se reinicia
nssm set $ServiceName AppRestartDelay 10000              # espera 10 s antes de reiniciar

nssm start $ServiceName
Start-Sleep -Seconds 2
nssm status $ServiceName
Write-Host ""
Write-Host "Listo. Revisa el log en: $(Join-Path $LogDir 'collector.log')"
Write-Host "Comandos utiles:"
Write-Host "  nssm status  $ServiceName"
Write-Host "  nssm restart $ServiceName"
Write-Host "  nssm stop    $ServiceName"
Write-Host "  nssm remove  $ServiceName confirm   (para desinstalar)"
