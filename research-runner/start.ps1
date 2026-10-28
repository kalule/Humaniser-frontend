param([int]$Port = 8008, [string]$Python = "$PSScriptRoot\venv\Scripts\python.exe")
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Python)) { throw 'Install research-runner requirements in a venv first.' }
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "Port $Port is already in use." }
$logRoot = Join-Path $PSScriptRoot 'data'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
Start-Process -FilePath $Python -ArgumentList '-B','-m','uvicorn','main:app','--host','127.0.0.1','--port',"$Port",'--workers','1','--env-file','.env' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput "$logRoot/api-$stamp.stdout.log" -RedirectStandardError "$logRoot/api-$stamp.stderr.log"
Write-Output "Research runner starting at http://127.0.0.1:$Port/docs"
