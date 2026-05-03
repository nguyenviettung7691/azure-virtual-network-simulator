#!/usr/bin/env bash

set -euo pipefail

PROFILE="${1:-}"
REGION="${2:-}"

echo "[INFO] Checking Terraform CLI..."
if ! command -v terraform >/dev/null 2>&1; then
  echo "[FAIL] Terraform CLI not found. Install Terraform 1.6+ and retry."
  exit 1
fi

TF_VERSION_RAW="$(terraform version | head -n1 | sed -E 's/^Terraform v//; s/-.*$//')"
TF_MAJOR="$(echo "$TF_VERSION_RAW" | cut -d. -f1)"
TF_MINOR="$(echo "$TF_VERSION_RAW" | cut -d. -f2)"

if [ "$TF_MAJOR" -lt 1 ] || { [ "$TF_MAJOR" -eq 1 ] && [ "$TF_MINOR" -lt 6 ]; }; then
  echo "[FAIL] Terraform version $TF_VERSION_RAW is below required 1.6.0"
  exit 1
fi

echo "[OK] Terraform version $TF_VERSION_RAW detected"

echo "[INFO] Checking AWS CLI..."
if ! command -v aws >/dev/null 2>&1; then
  echo "[FAIL] AWS CLI not found. Install AWS CLI v2 and configure credentials."
  exit 1
fi

AWS_ARGS=(sts get-caller-identity)
if [ -n "$PROFILE" ]; then
  AWS_ARGS+=(--profile "$PROFILE")
fi
if [ -n "$REGION" ]; then
  AWS_ARGS+=(--region "$REGION")
fi

if ! AWS_IDENTITY_JSON="$(aws "${AWS_ARGS[@]}" 2>/dev/null)"; then
  echo "[FAIL] AWS credentials check failed. Run 'aws configure' or export AWS credential environment variables."
  exit 1
fi

ACCOUNT_ID="$(echo "$AWS_IDENTITY_JSON" | sed -n 's/.*"Account"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
ARN="$(echo "$AWS_IDENTITY_JSON" | sed -n 's/.*"Arn"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"

echo "[OK] AWS credentials valid for account ${ACCOUNT_ID} as ${ARN}"
echo "[OK] Prerequisite checks passed"
