## Azure Key Vault Component Specification

### Overview

Azure Key Vault stores secrets, keys, and certificates behind a data-plane access model plus optional network restrictions. The simulator models a vault resource with:

- legacy **access policies** as the only behavioral access-control mode in v1
- Key Vault firewall metadata (`networkDefaultAction`, subnet rules, IP rules, trusted-services bypass)
- integrations with App Service, Functions, Application Gateway, and managed identities

Azure RBAC is documented as the current recommended/default model for new vaults created with API version `2026-02-01` or later, but RBAC permission evaluation is intentionally out of scope for this simulator version.

### Data Model (`KeyVaultComponent`)

| Field | Type | Notes |
|---|---|---|
| `name` | string | Required. Vault name must be `3-24` chars, alphanumeric or `-`, start/end alphanumeric, no consecutive `--`. |
| `sku` | `'Standard' \| 'Premium'` | Required. |
| `tenantId` | string | Optional metadata, but strongly recommended for access-policy authoring. |
| `enableSoftDelete` | boolean | Defaults to `true` for new nodes. |
| `softDeleteRetentionDays` | number | Required when soft delete is enabled. Range `7-90`. Default `90`. |
| `enablePurgeProtection` | boolean | Optional. Allowed only when soft delete is enabled. |
| `networkDefaultAction` | `'Allow' \| 'Deny'` | `Allow` keeps the public endpoint open. `Deny` turns on the firewall and requires selected networks, IP rules, or trusted-service bypass. |
| `allowTrustedMicrosoftServices` | boolean | Optional metadata flag for trusted-service bypass. |
| `virtualNetworkRules` | string[] | Optional subnet IDs. Max `200`. |
| `ipRules` | string[] | Optional public IPv4 addresses or CIDRs. Max `1000`. Private RFC1918 ranges are rejected. |
| `accessPolicies` | `KeyVaultAccessPolicy[]` | Optional array, max `16`. Behavioral access control is based on these legacy policies in v1. |

### Access Policy Model (`KeyVaultAccessPolicy`)

| Field | Type | Notes |
|---|---|---|
| `tenantId` | string | Required GUID. |
| `objectId` | string | Required GUID. Must be unique per vault. |
| `permissions.keys` | string[] | Optional fixed permission set from Azure Key Vault key permissions. |
| `permissions.secrets` | string[] | Optional fixed permission set from Azure Key Vault secret permissions. |
| `permissions.certificates` | string[] | Optional fixed permission set from Azure Key Vault certificate permissions. |

Each access policy must grant at least one key, secret, or certificate permission.

### Form Behavior (`IdentityForm.vue`)

- Name
- Tenant ID
- SKU
- Soft Delete
- Soft Delete Retention Days
- Purge Protection
- Network Default Action
- Allow Trusted Microsoft Services
- Virtual Network Rules
- IP Rules
- Legacy Access Policies editor

The form explicitly describes Azure RBAC as recommended/current for new vaults, while keeping the simulator’s behavioral scope on legacy access policies.

### Validation (`validateKeyVault`)

- Error on invalid vault name, invalid SKU, invalid `networkDefaultAction`, invalid soft-delete retention, or purge protection without soft delete
- Error when virtual network rules exceed `200`
- Error when IP rules exceed `1000`
- Error when an IP rule is not public IPv4 / IPv4 CIDR, or uses RFC1918 space
- Error when an access policy is malformed, duplicated by `objectId`, exceeds `16`, or grants no permissions
- Warning when:
  - `tenantId` is missing or malformed
  - no access policies are configured
  - firewall is enabled with no subnet rules, IP rules, or trusted-services bypass
  - a selected subnet lacks the `Microsoft.KeyVault` service endpoint

### Integration Model

- **App Service / Functions**
  - Authoritative fields: `keyVaultId`, `keyVaultSecretName`, `keyVaultSecretVersion`
  - Legacy field: `keyVaultSecretUri`
  - The form shows a resolved secret URI preview and validators warn when managed identity or plausible network access metadata are missing.
- **Application Gateway**
  - Authoritative fields: `keyVaultId`, `keyVaultCertificateName`, `keyVaultCertificateVersion`, `keyVaultManagedIdentityId`
  - Legacy field: `keyVaultCertificateId`
  - The form shows a resolved secret URI preview and validators require a user-assigned managed identity for Key Vault certificate integration.
- **Managed Identity**
  - Managed identity metadata can be referenced as Key Vault access-policy principals or as Application Gateway Key Vault fetch identities.
- **Subnet**
  - Service endpoints may include `Microsoft.KeyVault`; subnet-based Key Vault firewall rules warn when that endpoint is missing.

### Azure Alignment

- Name rules follow Azure Key Vault vault-name constraints (`3-24`, alphanumeric/hyphen, no consecutive `--`)
- Soft delete retention is enforced at `7-90`
- Firewall rules distinguish public endpoint open vs selected networks, instead of equating `Deny` with “private only”
- Access-policy behavior is preserved for simulator compatibility
- Azure RBAC, private endpoints, and effective permission computation remain out of scope

### Out of Scope

- Azure RBAC role assignment modeling
- Private-endpoint-only Key Vault access flow
- Per-secret / per-key / per-certificate lifecycle operations
- Managed HSM
