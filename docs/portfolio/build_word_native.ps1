$ErrorActionPreference = 'Stop'

$portfolioRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$renderDir = Join-Path $portfolioRoot 'generated\rendered'
$outputPath = Join-Path $portfolioRoot 'DreamCards_System_Design_Portfolio_ChenMing.docx'
$temporaryPath = Join-Path $portfolioRoot 'generated\DreamCards_Native.docx'

$word = $null
$document = $null

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0

    $document = $word.Documents.Add()
    $section = $document.Sections.Item(1)
    $section.PageSetup.Orientation = 1
    $section.PageSetup.PageWidth = $word.CentimetersToPoints(29.7)
    $section.PageSetup.PageHeight = $word.CentimetersToPoints(21.0)
    $section.PageSetup.TopMargin = 0
    $section.PageSetup.BottomMargin = 0
    $section.PageSetup.LeftMargin = 0
    $section.PageSetup.RightMargin = 0
    $section.PageSetup.HeaderDistance = 0
    $section.PageSetup.FooterDistance = 0

    $selection = $word.Selection
    $selection.ParagraphFormat.SpaceBefore = 0
    $selection.ParagraphFormat.SpaceAfter = 0
    $selection.ParagraphFormat.LineSpacingRule = 0

    for ($i = 1; $i -le 18; $i++) {
        $number = $i.ToString('00')
        $imagePath = Join-Path $renderDir "page-$number.png"
        if (-not (Test-Path -LiteralPath $imagePath)) {
            throw "Missing rendered page: $imagePath"
        }

        $shape = $selection.InlineShapes.AddPicture($imagePath, $false, $true)
        $shape.LockAspectRatio = -1
        $shape.Width = $word.CentimetersToPoints(29.0)

        if ($i -lt 18) {
            $selection.Collapse(0)
            $selection.InsertBreak(7)
        }
    }

    if (Test-Path -LiteralPath $temporaryPath) {
        Remove-Item -LiteralPath $temporaryPath -Force
    }
    if (Test-Path -LiteralPath $outputPath) {
        Remove-Item -LiteralPath $outputPath -Force
    }

    $document.SaveAs2($temporaryPath, 16)
    $pages = $document.ComputeStatistics(2)
    $shapes = $document.InlineShapes.Count
    $document.Close($false)
    $document = $null

    Copy-Item -LiteralPath $temporaryPath -Destination $outputPath -Force
    $size = (Get-Item -LiteralPath $outputPath).Length

    Write-Output "DOCX=$outputPath"
    Write-Output "PAGES=$pages"
    Write-Output "IMAGES=$shapes"
    Write-Output "SIZE=$size"
}
finally {
    if ($document) {
        $document.Close($false)
    }
    if ($word) {
        $word.Quit()
    }
    if ($document) {
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document)
    }
    if ($word) {
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
