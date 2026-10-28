param(
  [Parameter(Mandatory = $true)][uri]$ApiBase,
  [string]$RequestPath = (Join-Path $PSScriptRoot '../docs/evidence-scope-synthetic-request.json'),
  [string]$OutputPath = (Join-Path $PSScriptRoot '../docs/evidence-scope-live-result.json')
)
$ErrorActionPreference = 'Stop'
if (-not $env:HUMANISER_TEST_TOKEN) { throw 'Set HUMANISER_TEST_TOKEN to an authenticated test-session token.' }
$body = Get-Content -LiteralPath $RequestPath -Raw
$parsed = $body | ConvertFrom-Json
if ($parsed.sourceMode -ne 'MyFiles' -or -not $parsed.libraryDocuments.Count) {
  throw 'The fixed-evidence comparison requires MyFiles with nonempty libraryDocuments; label improved Web retrieval as a separate run.'
}
$uri = $ApiBase.AbsoluteUri.TrimEnd('/') + '/api/v1/workbench/write-with-ai'
$timer = [System.Diagnostics.Stopwatch]::StartNew()
$result = Invoke-RestMethod -Uri $uri -Method Post -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -Headers @{ Authorization = "Bearer $env:HUMANISER_TEST_TOKEN" } -TimeoutSec 1000
$timer.Stop()
@{ requestSha256 = (Get-FileHash -LiteralPath $RequestPath -Algorithm SHA256).Hash; elapsedMs = $timer.ElapsedMilliseconds; result = $result } |
  ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $OutputPath -Encoding utf8
Write-Output "Saved actual API response and elapsed time to $OutputPath"
