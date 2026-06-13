$ErrorActionPreference = 'Stop'

$portfolioRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$generated = Join-Path $portfolioRoot 'generated'
$pageDir = Join-Path $generated 'pages'
$renderDir = Join-Path $generated 'rendered'
$packageDir = Join-Path $generated 'docx-package'
$docxPath = Join-Path $portfolioRoot 'DreamCards_System_Design_Portfolio_ChenMing.docx'
$temporaryDocx = Join-Path $generated 'DreamCards_Portfolio.docx'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

New-Item -ItemType Directory -Path $renderDir -Force | Out-Null

for ($i = 1; $i -le 18; $i++) {
    $number = $i.ToString('00')
    $html = (Join-Path $pageDir "page-$number.html").Replace('\','/')
    $png = Join-Path $renderDir "page-$number.png"
    & $edge --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
        --window-size=1123,794 --virtual-time-budget=1500 `
        "--screenshot=$png" "file:///$html" | Out-Null
    if (-not (Test-Path -LiteralPath $png)) {
        throw "Failed to render page $number"
    }
}

if (Test-Path -LiteralPath $packageDir) {
    Remove-Item -LiteralPath $packageDir -Recurse -Force
}

$relsDir = Join-Path $packageDir '_rels'
$wordDir = Join-Path $packageDir 'word'
$wordRelsDir = Join-Path $wordDir '_rels'
$mediaDir = Join-Path $wordDir 'media'
New-Item -ItemType Directory -Path $relsDir,$wordDir,$wordRelsDir,$mediaDir -Force | Out-Null

for ($i = 1; $i -le 18; $i++) {
    $number = $i.ToString('00')
    Copy-Item -LiteralPath (Join-Path $renderDir "page-$number.png") -Destination (Join-Path $mediaDir "page-$number.png")
}

$contentTypes = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
'@

$rootRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
'@

$documentRels = New-Object System.Text.StringBuilder
[void]$documentRels.AppendLine('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
[void]$documentRels.AppendLine('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">')
for ($i = 1; $i -le 18; $i++) {
    $number = $i.ToString('00')
    [void]$documentRels.AppendLine("  <Relationship Id=`"rId$i`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image`" Target=`"media/page-$number.png`"/>")
}
[void]$documentRels.AppendLine('</Relationships>')

$document = New-Object System.Text.StringBuilder
[void]$document.AppendLine('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
[void]$document.AppendLine('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">')
[void]$document.AppendLine('<w:body>')

for ($i = 1; $i -le 18; $i++) {
    $pageBreak = if ($i -lt 18) { '<w:r><w:br w:type="page"/></w:r>' } else { '' }
    [void]$document.AppendLine(@"
<w:p>
  <w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr>
  <w:r>
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="10692000" cy="7560000"/>
        <wp:docPr id="$i" name="DreamCards Portfolio Page $i"/>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic>
              <pic:nvPicPr><pic:cNvPr id="$i" name="page-$i.png"/><pic:cNvPicPr/></pic:nvPicPr>
              <pic:blipFill><a:blip r:embed="rId$i"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
              <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="10692000" cy="7560000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
  $pageBreak
</w:p>
"@)
}

[void]$document.AppendLine('<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>')
[void]$document.AppendLine('</w:body></w:document>')

[IO.File]::WriteAllText((Join-Path $packageDir '[Content_Types].xml'), $contentTypes, [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $relsDir '.rels'), $rootRels, [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $wordRelsDir 'document.xml.rels'), $documentRels.ToString(), [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $wordDir 'document.xml'), $document.ToString(), [Text.UTF8Encoding]::new($false))

if (Test-Path -LiteralPath $docxPath) { Remove-Item -LiteralPath $docxPath -Force }
if (Test-Path -LiteralPath $temporaryDocx) { Remove-Item -LiteralPath $temporaryDocx -Force }

& tar.exe -a -c -f $temporaryDocx -C $packageDir '[Content_Types].xml' '_rels' 'word'
if ($LASTEXITCODE -ne 0) {
    throw "Failed to package DOCX."
}
Move-Item -LiteralPath $temporaryDocx -Destination $docxPath

$size = (Get-Item -LiteralPath $docxPath).Length
Write-Output "DOCX=$docxPath"
Write-Output "PAGES=18"
Write-Output "SIZE=$size"
