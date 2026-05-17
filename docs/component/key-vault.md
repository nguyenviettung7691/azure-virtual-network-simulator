## Azure Key Vault Component Specification

**Overview:**
Azure Key Vault is a secure cloud service for storing and managing secrets, encryption keys, and certificates. It provides centralized secrets management, key management, and certificate management for Azure resources and applications. The simulator models Key Vault as a first-class component, supporting core Azure features and integration with other Azure services.

**Data Model** (`KeyVaultComponent` in `types/network.ts`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Vault name (1-24 chars, alphanumeric and hyphens, must start/end with alphanumeric) |
| `type` | `KEY_VAULT` | ✓ | Enum value |
| `sku` | 'Standard' \| 'Premium' | ✓ | Azure Key Vault SKU |
| `tenantId` | string | — | Microsoft Entra tenant ID (required for access policies) |
| `enableSoftDelete` | boolean | — | Enables soft delete (recommended, default true in Azure) |
| `softDeleteRetentionDays` | number | — | Retention period (7–90 days, default 90) |
| `enablePurgeProtection` | boolean | — | Prevents immediate deletion (recommended for production) |
| `networkDefaultAction` | 'Allow' \| 'Deny' | — | Default network access (Allow = public, Deny = private only) |
| `virtualNetworkRules` | string[] | — | Array of allowed subnet IDs (VNet integration) |
| `ipRules` | string[] | — | Array of allowed public IP CIDRs |
| `accessPolicies` | KeyVaultAccessPolicy[] | — | Array of access policies (objectId, tenantId, permissions) |
| `tags` | object | — | Key-value metadata |
| `createdAt` | string | ✓ | ISO 8601 timestamp |

**Access Policy Model** (`KeyVaultAccessPolicy`):
| Field | Type | Required | Notes |
|---|---|---|---|
| `tenantId` | string | ✓ | Microsoft Entra tenant ID |
| `objectId` | string | ✓ | Principal object ID (user, app, or managed identity) |
| `permissions` | object | — | `{ keys?: string[], secrets?: string[], certificates?: string[] }` |

**Form Behavior** (`IdentityForm.vue`, Key Vault mode):
- Name (required, 1–24 chars, Azure naming rules)
- SKU selector (Standard, Premium)
- Soft Delete toggle (recommended enabled)
- Soft Delete Retention Days (shown if soft delete enabled, 7–90)
- Purge Protection toggle (recommended enabled)
- Network Default Action (Allow/Deny)
- Virtual Network Rules (checkboxes for subnets in diagram)
- IP Rules (comma-separated CIDRs)
- Access Policies (array editor: add/remove principal, set permissions for keys/secrets/certificates)
- All fields validated per Azure constraints

**Validation Logic** (`validateKeyVault()` in `lib/componentValidators.ts`):
- Name: required, 1–24 chars, alphanumeric/hyphen, must start/end with alphanumeric
- SKU: required, must be 'Standard' or 'Premium'
- Soft Delete: if enabled, retention days required (7–90)
- Purge Protection: optional, recommended enabled
- Network Default Action: must be 'Allow' or 'Deny'
- Virtual Network Rules: if set, all referenced subnets must exist
- IP Rules: if set, must be valid IPv4 CIDR blocks
- Access Policies: each must have tenantId, objectId, at least one permission
- Warn if no access policies defined (vault will be inaccessible)

**Integration with Other Components:**
- **App Gateway:** `keyVaultCertificateId` references Key Vault for TLS certificate storage/rotation
- **App Service / Functions:** `keyVaultSecretUri` references Key Vault secret for app settings/connection strings
- **Managed Identity:** Used as principal in access policies for secure access
- **Subnet/NetworkIC:** Service endpoints can include Microsoft.KeyVault for private access
- Validation ensures referenced Key Vaults exist and are of correct type

**Azure Alignment & Constraints:**
| Constraint | Azure Requirement | Implementation |
|---|---|---|
| **Name** | 1–24 chars, alphanumeric/hyphen, start/end with alphanumeric | ✓ Enforced |
| **SKU** | Standard or Premium | ✓ Enforced |
| **Soft Delete** | Enabled by default, 7–90 days retention | ✓ Enforced, default 90 |
| **Purge Protection** | Optional, recommended enabled | ✓ Supported |
| **Network Rules** | Allow or Deny, VNet and IP rules | ✓ Supported |
| **Access Policies** | Required for access, must specify principal and permissions | ✓ Supported |
| **Private Endpoint** | Not modeled in v1 (future enhancement) | ℹ️ Not yet modeled |
| **RBAC** | Azure RBAC supported in Azure, not modeled in v1 | ℹ️ Not yet modeled |

**Key Invariants:**
- Vault name must follow Azure naming rules
- Soft delete and purge protection recommended for production
- At least one access policy required for usability
- Network rules can restrict access to selected subnets/IPs
- Integration with App Gateway, App Service, Functions, Managed Identity
- Private endpoint and RBAC are future enhancements

**Future Enhancements (Out of Scope):**
- Per-object (key/secret/cert) management
- Private endpoint support
- Azure RBAC (role-based access control)
- Managed HSM (separate resource type)
