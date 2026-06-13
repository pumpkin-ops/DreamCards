param(
  [string]$Repository = "pumpkin-ops/DreamCards"
)

$labels = Get-Content ".github/labels.yml" -Raw
$matches = [regex]::Matches(
  $labels,
  '- name: (?<name>[^\r\n]+)\r?\n\s+color: "(?<color>[^"]+)"\r?\n\s+description: (?<description>[^\r\n]+)'
)

foreach ($label in $matches) {
  gh label create $label.Groups["name"].Value `
    --repo $Repository `
    --color $label.Groups["color"].Value `
    --description $label.Groups["description"].Value `
    --force
}
