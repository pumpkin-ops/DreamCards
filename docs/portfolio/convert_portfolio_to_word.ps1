$ErrorActionPreference = 'Stop'

$portfolioRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$generated = Join-Path $portfolioRoot 'generated'
$htmlPath = Join-Path $generated 'DreamCards_Portfolio.html'
$docxPath = Join-Path $portfolioRoot '陈铭_DreamCards_系统策划作品集.docx'

if (-not (Test-Path -LiteralPath $htmlPath)) {
    throw "Portfolio HTML not found: $htmlPath"
}

$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0

    $document = $word.Documents.Open($htmlPath, $false, $true)
    $document.PageSetup.Orientation = 1
    $document.PageSetup.PageWidth = $word.CentimetersToPoints(29.7)
    $document.PageSetup.PageHeight = $word.CentimetersToPoints(21.0)
    $document.PageSetup.TopMargin = 0
    $document.PageSetup.BottomMargin = 0
    $document.PageSetup.LeftMargin = 0
    $document.PageSetup.RightMargin = 0

    $document.SaveAs2($docxPath, 16)
    $pages = $document.ComputeStatistics(2)
    Write-Output "DOCX=$docxPath"
    Write-Output "PAGES=$pages"
}
finally {
    if ($document) { $document.Close($false) }
    if ($word) { $word.Quit() }
    if ($document) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document) }
    if ($word) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
