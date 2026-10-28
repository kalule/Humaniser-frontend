param([Parameter(Mandatory=$true)][string]$SqlFile, [Parameter(Mandatory=$true)][string]$OutputFile)
$ErrorActionPreference = 'Stop'
$settings = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../../Humaniser/HumaniseAI.API/appsettings.Development.json') -Raw | ConvertFrom-Json
$parts = @{}
foreach ($part in ($settings.ConnectionStrings.DefaultConnection -split ';')) {
    if ($part -match '^([^=]+)=(.*)$') { $parts[$matches[1].Trim().ToLowerInvariant()] = $matches[2] }
}
if ($parts['host'] -notin @('localhost','127.0.0.1') -or $parts['port'] -ne '15433' -or $parts['database'] -ne 'humaniseaidb') { throw 'Database differs from the verified local baseline target.' }
$previousPassword = $env:PGPASSWORD
try {
    $env:PGPASSWORD = $parts['password']
    Get-Content -LiteralPath $SqlFile -Raw | & 'C:/Program Files/PostgreSQL/17/bin/psql.exe' -h $parts['host'] -p $parts['port'] -U $parts['username'] -d $parts['database'] -X -v ON_ERROR_STOP=1 -P pager=off | Set-Content -LiteralPath $OutputFile -Encoding UTF8
    if ($LASTEXITCODE -ne 0) { throw 'Baseline SQL failed.' }
    Write-Output ('Baseline SQL saved to ' + $OutputFile)
} finally { $env:PGPASSWORD = $previousPassword }
