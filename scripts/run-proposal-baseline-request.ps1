param(
    [Parameter(Mandatory=$true)][string]$Endpoint,
    [ValidateSet('Get','Post','Patch','Put')][string]$Method = 'Get',
    [string]$BodyFile,
    [Parameter(Mandatory=$true)][string]$OutputFile
)
$ErrorActionPreference = 'Stop'
$baselineProject = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../docs/proposal-llm-baseline-project.json') -Raw | ConvertFrom-Json
$allowedPrefix = '/api/v1/research/projects/' + $baselineProject.id
if (-not $Endpoint.StartsWith($allowedPrefix, [StringComparison]::Ordinal)) { throw 'Only the recorded baseline project is allowed.' }
$tokenPath = Join-Path $env:TEMP 'humaniser-baseline-auth.dpapi'
$secureToken = Get-Content -LiteralPath $tokenPath | ConvertTo-SecureString
$request = @{ Uri = 'http://localhost:5062' + $Endpoint; Method = $Method; Headers = @{ Authorization = 'Bearer ' + [System.Net.NetworkCredential]::new('', $secureToken).Password }; TimeoutSec = 240 }
if ($BodyFile) { $request.ContentType = 'application/json'; $request.Body = Get-Content -LiteralPath $BodyFile -Raw }
try {
    $result = Invoke-RestMethod @request
    $result.data | ConvertTo-Json -Depth 60 | Set-Content -LiteralPath $OutputFile -Encoding UTF8
    Write-Output ($Method + ' ' + $Endpoint + ': completed; result saved to ' + $OutputFile)
    $global:LASTEXITCODE = 0
} catch {
    Write-Output ($Method + ' ' + $Endpoint + ': ' + $_.Exception.Message)
    if ($_.ErrorDetails.Message) { Write-Output $_.ErrorDetails.Message }
    exit 1
}
