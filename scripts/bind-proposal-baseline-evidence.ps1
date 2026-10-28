param([string]$ResultPrefix = 'docs/proposal-llm-baseline-evidence-result-')
$ErrorActionPreference = 'Stop'
$plan = Get-Content -LiteralPath 'docs/proposal-llm-baseline-evidence-plan.json' -Raw | ConvertFrom-Json
$papers = Get-Content -LiteralPath 'docs/proposal-llm-baseline-selected-literature.json' -Raw | ConvertFrom-Json
$index = 0
foreach ($item in $plan) {
    $index++
    $resultPath = $ResultPrefix + $index + '.json'
    if (Test-Path -LiteralPath $resultPath) { continue }
    $paper = $papers | Where-Object { $_.id -eq $item.literatureId } | Select-Object -First 1
    $offset = $paper.abstract.IndexOf($item.quote, [StringComparison]::Ordinal)
    if ($offset -lt 0) { throw ('Exact passage absent for item ' + $index) }
    $request = @{sectionCode=$item.sectionCode; literatureId=$item.literatureId;claim=$item.claim;coverage='Abstract';start=$offset;length=$item.quote.Length;quote=$item.quote;purpose='Support'}
    $requestPath = 'docs/proposal-llm-baseline-evidence-request-' + $index + '.json'
    $request | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $requestPath -Encoding UTF8
    & (Join-Path $PSScriptRoot 'run-proposal-baseline-request.ps1') -Endpoint '/api/v1/research/projects/4ffb55e2-c8da-4feb-99c6-086c565fed6c/proposal-workflow/evidence' -Method Post -BodyFile $requestPath -OutputFile $resultPath
    if ($LASTEXITCODE -ne 0) { exit 1 }
    $result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
    Write-Output ('Evidence item ' + $index + ': ' + $result.status + '; ' + $result.message)
    if ($result.status -ne 'Pass') { exit 1 }
}
