$ErrorActionPreference = 'Stop'

$portfolioRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$generated = Join-Path $portfolioRoot 'generated'
$templatePath = Join-Path $generated 'one-page-template.docx'
$packageDir = Join-Path $generated 'template-build'
$renderDir = Join-Path $generated 'rendered'
$temporaryDocx = Join-Path $generated 'DreamCards_Template_Build.docx'
$outputPath = Join-Path $portfolioRoot 'DreamCards_System_Design_Portfolio_ChenMing.docx'

if (Test-Path -LiteralPath $packageDir) {
    Remove-Item -LiteralPath $packageDir -Recurse -Force
}
New-Item -ItemType Directory -Path $packageDir | Out-Null
& tar.exe -xf $templatePath -C $packageDir
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to extract the Word template.'
}

$documentPath = Join-Path $packageDir 'word\document.xml'
$relationshipsPath = Join-Path $packageDir 'word\_rels\document.xml.rels'
$mediaDir = Join-Path $packageDir 'word\media'

$documentXml = [IO.File]::ReadAllText($documentPath, [Text.Encoding]::UTF8)
$paragraphMatch = [regex]::Match($documentXml, '<w:p .*?</w:p>')
if (-not $paragraphMatch.Success) {
    throw 'Could not locate the template image paragraph.'
}

$paragraphTemplate = $paragraphMatch.Value
$bodyStart = $documentXml.Substring(0, $paragraphMatch.Index)
$afterParagraph = $documentXml.Substring($paragraphMatch.Index + $paragraphMatch.Length)
$sectionIndex = $afterParagraph.IndexOf('<w:sectPr')
if ($sectionIndex -lt 0) {
    throw 'Could not locate section properties.'
}
$sectionAndEnd = $afterParagraph.Substring($sectionIndex)

$paragraphs = New-Object System.Text.StringBuilder
for ($i = 1; $i -le 18; $i++) {
    $number = $i.ToString('00')
    $sourceImage = Join-Path $renderDir "page-$number.png"
    $targetImage = Join-Path $mediaDir "image$i.png"
    Copy-Item -LiteralPath $sourceImage -Destination $targetImage -Force

    $relationshipId = if ($i -eq 1) { 'rId4' } else { "rId$($i + 5)" }
    $paragraph = $paragraphTemplate
    $paragraph = [regex]::Replace($paragraph, 'w14:paraId="[A-F0-9]+"', ('w14:paraId="{0:X8}"' -f (4096 + $i)))
    $paragraph = [regex]::Replace($paragraph, 'w14:textId="[A-F0-9]+"', ('w14:textId="{0:X8}"' -f (8192 + $i)))
    $paragraph = [regex]::Replace($paragraph, 'wp14:anchorId="[A-F0-9]+"', ('wp14:anchorId="{0:X8}"' -f (12288 + $i)))
    $paragraph = [regex]::Replace($paragraph, 'wp14:editId="[A-F0-9]+"', ('wp14:editId="{0:X8}"' -f (16384 + $i)))
    $paragraph = [regex]::Replace($paragraph, '<wp:docPr id="\d+" name="[^"]*"/>', "<wp:docPr id=`"$i`" name=`"Portfolio Page $i`"/>")
    $paragraph = [regex]::Replace($paragraph, '<pic:cNvPr id="\d+" name="[^"]*"/>', "<pic:cNvPr id=`"$i`" name=`"Portfolio Page $i`"/>")
    $paragraph = $paragraph.Replace('r:embed="rId4"', "r:embed=`"$relationshipId`"")
    if ($i -gt 1) {
        $paragraph = $paragraph.Replace('<w:pPr>', '<w:pPr><w:pageBreakBefore/>')
    }
    [void]$paragraphs.Append($paragraph)
}

$newDocument = $bodyStart + $paragraphs.ToString() + $sectionAndEnd
[IO.File]::WriteAllText($documentPath, $newDocument, [Text.UTF8Encoding]::new($false))

$relsXml = [IO.File]::ReadAllText($relationshipsPath, [Text.Encoding]::UTF8)
$relsXml = $relsXml.Replace('Target="media/image1.png"', 'Target="media/image1.png"')
$relationshipInsert = New-Object System.Text.StringBuilder
for ($i = 2; $i -le 18; $i++) {
    $rid = $i + 5
    [void]$relationshipInsert.Append("<Relationship Id=`"rId$rid`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image`" Target=`"media/image$i.png`"/>")
}
$relsXml = $relsXml.Replace('</Relationships>', $relationshipInsert.ToString() + '</Relationships>')
[IO.File]::WriteAllText($relationshipsPath, $relsXml, [Text.UTF8Encoding]::new($false))

if (Test-Path -LiteralPath $temporaryDocx) {
    Remove-Item -LiteralPath $temporaryDocx -Force
}
if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Force
}

& tar.exe -a -c -f $temporaryDocx -C $packageDir '[Content_Types].xml' '_rels' 'docProps' 'word'
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to package the Word document.'
}
Copy-Item -LiteralPath $temporaryDocx -Destination $outputPath -Force

$size = (Get-Item -LiteralPath $outputPath).Length
Write-Output "DOCX=$outputPath"
Write-Output 'EXPECTED_PAGES=18'
Write-Output 'IMAGES=18'
Write-Output "SIZE=$size"
