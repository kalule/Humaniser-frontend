param([int]$Port = 8007, [string]$Python = "$PSScriptRoot\venv\Scripts\python.exe")
$ErrorActionPreference = 'Stop'
$envFile = Join-Path $PSScriptRoot '.env'
if (Test-Path -LiteralPath $envFile) {
    foreach ($line in Get-Content -LiteralPath $envFile) {
        if ($line -match '^\s*(OPENAI_API_KEY|ESSAY_API_KEY|ESSAY_MODEL|ESSAY_BASE_URL|ESSAY_APP_CONFIG|OPENALEX_API_KEY|OPENALEX_ENABLED|OPENALEX_POLITE_EMAIL|CITATION_RUNNER_URL|CITATION_RUNNER_SECRET)\s*=(.*)$') {
            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim(), 'Process')
        }
    }
}
if (-not (Test-Path -LiteralPath $Python)) { throw 'Create a venv and install requirements first (see README.md).' }
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    Write-Output "Port $Port is already in use."
    exit 0
}
$logDir = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$logStamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff')
$outputLog = Join-Path $logDir "essay-runner-$logStamp.stdout.log"
$errorLog = Join-Path $logDir "essay-runner-$logStamp.stderr.log"
Start-Process -FilePath $Python -ArgumentList '-B','-m','uvicorn','main:app','--host','127.0.0.1','--port',"$Port" -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput $outputLog -RedirectStandardError $errorLog
Write-Output "Essay runner starting at http://127.0.0.1:$Port/docs"
Write-Output "Logs: $errorLog"
