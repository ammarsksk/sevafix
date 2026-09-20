[CmdletBinding()]
param(
    [string]$Stack = "sevafix-dev",
    [string]$Profile = "sevafix-deploy",
    [string]$Region = "ap-south-1",
    [string]$CallbackUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$sam = "C:\Program Files\Amazon\AWSSAMCLI\bin\sam.cmd"

if (-not (Test-Path -LiteralPath $sam)) {
    $samCommand = Get-Command sam -ErrorAction SilentlyContinue
    if (-not $samCommand) {
        throw "AWS SAM CLI was not found. Install it or add it to PATH."
    }
    $sam = $samCommand.Source
}

$googleClientId = (Read-Host "Paste the Google Web application client ID").Trim()
if ($googleClientId -notmatch "^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$") {
    throw "That does not look like a Google Web application client ID."
}

$secureSecret = Read-Host "Paste the NEW Google client secret (input is hidden)" -AsSecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)

Push-Location $repoRoot
try {
    $googleClientSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    if ([string]::IsNullOrWhiteSpace($googleClientSecret)) {
        throw "The Google client secret cannot be empty."
    }

    $env:SAM_CLI_TELEMETRY = "0"
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
            "AllowedOrigins=http://localhost:3000,$CallbackUrl" `
            "EnableMalwareProtection=false" `
            "EnableKnowledgeBase=false" `
            "ManagedKnowledgeBaseId=QDX1TUBOTV" `
            "ManagedKnowledgeBaseDataSourceId=XEQOEY0VSA" `
            "ManagedKnowledgeBaseRegion=ap-northeast-1" `
            "ManagedKnowledgeBaseBucketName=sevafix-851725360556-ap-northeast-1-dev-managed-kb" `
            "BedrockMantleModelId=openai.gpt-oss-20b" `
            "GoogleClientId=$googleClientId" `
            "GoogleClientSecret=$googleClientSecret" `
            "GoogleCallbackUrls=http://localhost:3000,$CallbackUrl"
    if ($LASTEXITCODE -ne 0) {
        throw "SAM deployment failed."
    }

    $outputs = & aws cloudformation describe-stacks `
        --stack-name $Stack `
        --profile $Profile `
        --region $Region `
        --query "Stacks[0].Outputs" `
        --output json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) {
        throw "Could not read stack outputs after deployment."
    }
    $domain = ($outputs | Where-Object OutputKey -eq "CognitoHostedUiDomain").OutputValue
    $appClientId = ($outputs | Where-Object OutputKey -eq "UserPoolClientId").OutputValue
    if (-not $domain -or -not $appClientId) {
        throw "Cognito OAuth outputs were not present after deployment."
    }

    $redirect = [Uri]::EscapeDataString($CallbackUrl)
    $authorizeUrl = "$domain/oauth2/authorize?identity_provider=Google&redirect_uri=$redirect&response_type=code&client_id=$appClientId&scope=openid+email+profile"
    $status = & curl.exe -s -o NUL -w "%{http_code}" $authorizeUrl
    if ($status -ne "302") {
        throw "Cognito OAuth verification returned HTTP $status instead of 302."
    }

    Write-Host "Google OAuth was deployed and Cognito redirected to Google successfully." -ForegroundColor Green
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    Remove-Variable googleClientSecret -ErrorAction SilentlyContinue
    Remove-Variable secureSecret -ErrorAction SilentlyContinue
    Remove-Item Env:SAM_CLI_TELEMETRY -ErrorAction SilentlyContinue
    Pop-Location
}
