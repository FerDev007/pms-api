# Registra el colector empaquetado (pms-collector.exe) para que arranque con Windows,
# usando el Programador de tareas -- que YA viene en Windows, no instala nada.
#
# No necesitas Python, ni net-snmp, ni NSSM: todo va dentro del .exe.
#
# Requisitos:
#   - pms-collector.exe y pms-collector.config en la misma carpeta ($ExeDir).
#   - Permisos de administrador para crear la tarea (es una acción nativa de Windows,
#     no una instalación de software).
#
# Ejecutar en PowerShell COMO ADMINISTRADOR:
#   powershell -ExecutionPolicy Bypass -File register-collector-task.ps1

# ============ EDITA ESTA RUTA ============
$ExeDir = "C:\pms-collector"      # carpeta donde pusiste el .exe y el .config
# =========================================

$TaskName = "PMSCollector"
$Exe      = Join-Path $ExeDir "pms-collector.exe"
$Config   = Join-Path $ExeDir "pms-collector.config"

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Exe))    { throw "No encuentro pms-collector.exe en: $ExeDir" }
if (-not (Test-Path $Config)) { throw "No encuentro pms-collector.config en: $ExeDir (copia el .example y edítalo)" }

# El .exe corre en modo continuo (bucle interno cada PMS_INTERVAL); lee su config del
# archivo de al lado, así que la tarea no lleva argumentos ni el token.
$action = New-ScheduledTaskAction -Execute $Exe -WorkingDirectory $ExeDir

# Arranca al encender la máquina, sin que nadie inicie sesión.
$trigger = New-ScheduledTaskTrigger -AtStartup

# Corre como SYSTEM (tiene acceso a la red local para el SNMP).
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Sin límite de tiempo (el proceso vive siempre) y que se reinicie si se cae.
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -StartWhenAvailable

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Write-Host "La tarea ya existe; se reemplaza..."
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Principal $principal -Settings $settings `
  -Description "Colector PMS: consulta impresoras por SNMP y envía telemetría al API." | Out-Null

# Arranca ya, sin esperar al próximo reinicio.
Start-ScheduledTask -TaskName $TaskName

Write-Host ""
Write-Host "Tarea '$TaskName' registrada y en marcha."
Write-Host "Comprobar:  Get-ScheduledTask $TaskName ; Get-ScheduledTaskInfo $TaskName"
Write-Host "Detener:    Stop-ScheduledTask $TaskName"
Write-Host "Quitar:     Unregister-ScheduledTask $TaskName -Confirm:`$false"
