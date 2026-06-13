$ErrorActionPreference = 'Stop'

$portfolioRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$rtfPath = Join-Path $portfolioRoot 'generated\DreamCards_Portfolio.rtf'
$temporaryDocx = Join-Path $portfolioRoot 'generated\DreamCards_RTF_Converted.docx'
$outputPath = Join-Path $portfolioRoot 'DreamCards_System_Design_Portfolio_ChenMing.docx'

$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Open($rtfPath, $false, $false)

    if (Test-Path -LiteralPath $temporaryDocx) {
        Remove-Item -LiteralPath $temporaryDocx -Force
    }
    if (Test-Path -LiteralPath $outputPath) {
        Remove-Item -LiteralPath $outputPath -Force
    }

    $document.SaveAs2($temporaryDocx, 16)
    $document.Close($false)
    $document = $null

    Copy-Item -LiteralPath $temporaryDocx -Destination $outputPath -Force
    $size = (Get-Item -LiteralPath $outputPath).Length

    Write-Output "DOCX=$outputPath"
    Write-Output "EXPECTED_PAGES=18"
    Write-Output "SIZE=$size"
}
finally {
    if ($document) { $document.Close($false) }
    if ($word) { $word.Quit() }
    if ($document) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document) }
    if ($word) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
