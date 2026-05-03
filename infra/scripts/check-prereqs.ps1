param(
    [string]$Profile = "",
    [string]$Region = ""
)

$ErrorActionPreference = "Stop"

function Write-Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

Write-Info "Checking Terraform CLI..."
$terraform = Get-Command terraform -ErrorAction SilentlyContinue
if (-not $terraform) {
    Write-Fail "Terraform CLI not found. Install Terraform 1.6+ and retry."
    exit 1
}

$terraformVersionOutput = terraform version | Select-String -Pattern "Terraform v"
if (-not $terraformVersionOutput) {
    Write-Fail "Unable to determine Terraform version."
    exit 1
}

$terraformVersionString = ($terraformVersionOutput -replace ".*Terraform v", "").Trim()
$terraformVersion = [Version]($terraformVersionString.Split("-")[0])
if ($terraformVersion -lt [Version]"1.6.0") {
    Write-Fail "Terraform version $terraformVersion is below required 1.6.0"
    exit 1
}

Write-Ok "Terraform version $terraformVersion detected"

Write-Info "Checking AWS CLI..."
$awsCli = Get-Command aws -ErrorAction SilentlyContinue
if (-not $awsCli) {
    Write-Fail "AWS CLI not found. Install AWS CLI v2 and configure credentials."
    exit 1
}

$awsArgs = @("sts", "get-caller-identity")
if ($Profile) {
    $awsArgs += @("--profile", $Profile)
}
if ($Region) {
    $awsArgs += @("--region", $Region)
}

try {
    $identityJson = aws @awsArgs | Out-String
    if (-not $identityJson) {
        throw "No output"
    }
    $identity = $identityJson | ConvertFrom-Json
    Write-Ok "AWS credentials valid for account $($identity.Account) as $($identity.Arn)"
}
catch {
    Write-Fail "AWS credentials check failed. Run 'aws configure' or export AWS credential environment variables."
    exit 1
}

Write-Ok "Prerequisite checks passed"
