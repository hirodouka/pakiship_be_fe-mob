param(
  [string]$ProjectId = "api-center-496422",
  [string]$SecretName = "api-shared-services-prod",
  [string]$Namespace = "api-center",
  [string]$KubernetesSecretName = "api-shared-services-prod"
)

$ErrorActionPreference = "Stop"

$tempDir = Join-Path $env:TEMP ("apic-shared-secret-" + [guid]::NewGuid().ToString())
$jsonPath = Join-Path $tempDir "secret.json"
$envPath = Join-Path $tempDir "secret.env"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
  $secretJson = gcloud.cmd secrets versions access latest `
    --secret=$SecretName `
    --project=$ProjectId

  [System.IO.File]::WriteAllText($jsonPath, ($secretJson -join "`n"), $utf8NoBom)

  $secret = Get-Content -Raw -LiteralPath $jsonPath | ConvertFrom-Json
  $lines = New-Object System.Collections.Generic.List[string]

  foreach ($property in $secret.PSObject.Properties) {
    $name = [string]$property.Name
    $value = [string]$property.Value

    if ($name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
      throw "Secret key '$name' is not a valid environment variable name."
    }

    if ($value -match "`r|`n") {
      throw "Secret key '$name' contains a newline and cannot be synced through --from-env-file."
    }

    $lines.Add("$name=$value")
  }

  [System.IO.File]::WriteAllText($envPath, ($lines -join "`n"), $utf8NoBom)

  kubectl -n $Namespace create secret generic $KubernetesSecretName `
    --from-env-file=$envPath `
    --dry-run=client `
    -o yaml |
    kubectl apply -f -
} finally {
  Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
