[CmdletBinding()]
param(
    [string]$Stack = "sevafix-dev",
    [string]$Profile = "sevafix-deploy",
    [string]$Region = "ap-south-1",
    [string]$AllowedOrigins = "http://localhost:3000,https://se-336f1f086653422a93c5d50efec9bd01.ecs.ap-south-1.on.aws"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$sam = "C:\Program Files\Amazon\AWSSAMCLI\bin\sam.cmd"
$python = Join-Path $repoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $sam)) {
    $samCommand = Get-Command sam -ErrorAction SilentlyContinue
    if (-not $samCommand) {
        throw "AWS SAM CLI was not found. Install it or add it to PATH."
    }
    $sam = $samCommand.Source
}
if (-not (Test-Path -LiteralPath $python)) {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCommand) {
        throw "Python was not found. Create .venv or add Python to PATH."
    }
    $python = $pythonCommand.Source
}

$secureKey = Read-Host "Paste your data.gov.in API key (input is hidden)" -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)

Push-Location $repoRoot
try {
    $dataGovKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    if ([string]::IsNullOrWhiteSpace($dataGovKey)) {
        throw "The data.gov.in API key cannot be empty."
    }

    & $sam build `
        --template-file "backend\template.yaml" `
        --build-dir "backend\.aws-sam\build" `
        --cached
    if ($LASTEXITCODE -ne 0) {
        throw "SAM build failed."
    }

    & $sam deploy `
        --template-file "backend\.aws-sam\build\template.yaml" `
        --stack-name $Stack `
        --resolve-s3 `
        --s3-prefix $Stack `
        --region $Region `
        --profile $Profile `
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM `
        --no-confirm-changeset `
        --no-fail-on-empty-changeset `
        --parameter-overrides `
            "Environment=dev" `
            "AllowedOrigins=$AllowedOrigins" `
            "EnableMalwareProtection=false" `
            "EnableKnowledgeBase=false" `
            "ManagedKnowledgeBaseId=QDX1TUBOTV" `
            "ManagedKnowledgeBaseDataSourceId=XEQOEY0VSA" `
            "ManagedKnowledgeBaseRegion=ap-northeast-1" `
            "ManagedKnowledgeBaseBucketName=sevafix-851725360556-ap-northeast-1-dev-managed-kb" `
            "BedrockMantleModelId=openai.gpt-oss-20b" `
            "DataGovApiKey=$dataGovKey"
    if ($LASTEXITCODE -ne 0) {
        throw "SAM deployment failed."
    }

    & $python "backend\scripts\seed_scheme_catalog.py" `
        --stack $Stack `
        --profile $Profile `
        --region $Region
    if ($LASTEXITCODE -ne 0) {
        throw "Scheme and source seeding failed."
    }

    & $python "backend\scripts\activate_scheme_policies.py" `
        --stack $Stack `
        --profile $Profile `
        --region $Region
    if ($LASTEXITCODE -ne 0) {
        throw "Scheme policy activation failed."
    }

    Write-Host "Deployment, scheme seeding, and policy activation completed successfully." -ForegroundColor Green
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    Remove-Variable dataGovKey -ErrorAction SilentlyContinue
    Remove-Variable secureKey -ErrorAction SilentlyContinue
    Pop-Location
}
