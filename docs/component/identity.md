## Azure Managed Identity Component (System-Assigned & User-Assigned)

### Overview
Azure Managed Identities provide secure, passwordless authentication for Azure resources to access other Azure services. There are two types:

- **System-Assigned:** Created with a parent resource (e.g., VM, App Service), deleted with the resource, can only be assigned to one resource, lifecycle is coupled.
- **User-Assigned:** Standalone Azure resource, reusable, assignable to multiple resources, must be deleted manually, lifecycle is independent.

#### Data Model (`ManagedIdentityComponent`)
| Field | Type | Description |
|---|---|---|
| `identityType` | 'SystemAssigned' \| 'UserAssigned' | Type of managed identity |
| `clientId` | string | Azure application (client) ID (auto-generated) |
| `principalId` | string | Service principal object ID in Microsoft Entra ID (auto-generated) |
| `tenantId` | string | Microsoft Entra tenant ID (required for cross-tenant RBAC) |
| `resourceId` | string | Azure resource ID (user-assigned only) |
| `isolationScope` | 'Regional' \| 'None' | User-assigned only; restricts assignment to resources in the same region |
| `assignedToId` | string | System-assigned only; parent resource (e.g., VM, App Service) |

#### Form Behavior (`IdentityForm.vue`)
- Identity Type selector with help text explaining lifecycle and assignment
- Client ID, Principal ID, Tenant ID fields (with help text)
- Resource ID and Isolation Scope (user-assigned only)
- Assigned To (system-assigned only)
- All fields are informational except assignment fields

#### Validation (`validateIdentity`)
- System-assigned: Warn if not attached to a parent resource
- User-assigned: Warn if not assigned to any resource (informational)
- Isolation scope: Warn if not 'Regional' or 'None'
- No error-level validation for these fields

#### Integration Points
- **Compute (VM, VMSS, AKS), App Service, Functions:**
  - Can enable system-assigned and/or assign one or more user-assigned identities
  - Both types can be enabled simultaneously (matches Azure reality)
  - User-assigned identities are referenced by ID in `userAssignedIdentityIds[]`
  - System-assigned is toggled by `enableManagedIdentity`
- **Key Vault, Storage, SQL, etc.:**
  - Managed identity is used for secure access (not modeled as direct assignment in v1)

#### Best Practices (from Azure docs)
- Use user-assigned identities for scenarios with multiple resources needing the same permissions, rapid creation/deletion, or compliance requirements
- Use system-assigned for unique-per-resource identity, audit logging, or when permissions should be removed with the resource
- Both types can be used together for maximum flexibility
- Assign only the minimum permissions needed (principle of least privilege)
- Clean up unused user-assigned identities and role assignments

#### Service Principal Concept
- Each managed identity is backed by a service principal in Microsoft Entra ID
- `clientId` is the application (client) ID; `principalId` is the service principal object ID
- Role assignments are made to the managed identity (not modeled in v1)

#### Future Enhancements
- Model role assignments and RBAC
- Support for Federated Identity Credentials (FIC)
- Lifecycle automation for user-assigned identity cleanup