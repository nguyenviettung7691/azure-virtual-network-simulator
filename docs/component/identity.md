## Azure Managed Identity Component (System-Assigned & User-Assigned)

### Overview

Azure Managed Identities provide passwordless authentication for Azure resources. The simulator models both Azure identity types, but they have different ownership semantics:

- **User-assigned:** A standalone Azure resource that can be assigned to multiple supported resources. This is the default for new `MANAGED_IDENTITY` nodes.
- **System-assigned:** An identity attached to exactly one supported resource. Its lifecycle is tied to that resource. In this simulator, a `SystemAssigned` managed identity node is an optional documentation/attachment record; the source resource itself uses `enableManagedIdentity`.

RBAC role assignments, Azure role definitions, and target-scope permissions are intentionally out of scope for v1.

### Data Model (`ManagedIdentityComponent`)

| Field | Type | Description |
|---|---|---|
| `identityType` | `'SystemAssigned' \| 'UserAssigned'` | Required identity kind. |
| `clientId` | string | Optional Azure application/client ID. Azure generates this value. |
| `principalId` | string | Optional service principal object ID in Microsoft Entra ID. Azure generates this value. |
| `tenantId` | string | Optional Microsoft Entra tenant ID. |
| `resourceId` | string | Optional Azure resource ID for user-assigned identities. |
| `isolationScope` | `'Regional' \| 'None'` | Optional user-assigned identity assignment scope metadata. Defaults to `None` for new nodes. |
| `assignedToId` | string | Optional system-assigned documentation link to a VM, VMSS, AKS, App Service, or Functions resource. |

Identity-capable source resources use:

- `enableManagedIdentity?: boolean` for system-assigned identity enablement.
- `userAssignedIdentityIds?: string[]` for one or more user-assigned identity node references.

### Form Behavior (`IdentityForm.vue`)

- New managed identity nodes default to `UserAssigned` with `isolationScope: 'None'`.
- User-assigned mode shows `Resource ID` and `Isolation Scope`.
- System-assigned mode shows `Assigned To`, filtered to identity-capable source resources only.
- `clientId`, `principalId`, and `tenantId` are optional documentation fields and warn on malformed GUIDs.

### Validation (`validateIdentity`)

- Error if `identityType` is not `SystemAssigned` or `UserAssigned`.
- System-assigned nodes warn when `assignedToId` is missing, missing from the diagram, not identity-capable, or points to a resource without `enableManagedIdentity: true`.
- User-assigned nodes warn when they are not referenced by any resource through `userAssignedIdentityIds[]`.
- User-assigned `resourceId` warns when it does not match the Azure managed identity resource ID shape.
- `isolationScope` warns when set to anything other than `Regional` or `None`.

### Integration Points

- **VM, VMSS, AKS, App Service, Functions:** Can enable system-assigned identity and assign one or more user-assigned identities at the same time.
- **Application Gateway:** Key Vault certificate integration uses a user-assigned managed identity (`keyVaultManagedIdentityId`) rather than a system-assigned identity.
- **Compute forms:** User-assigned identity selectors list only `MANAGED_IDENTITY` nodes with `identityType === 'UserAssigned'`.
- **Validators:** `userAssignedIdentityIds[]` references warn if missing, error if the target is not a managed identity, and error if the target is system-assigned.
- **Graph/test/challenge traversal:** `assignedToId` and `userAssignedIdentityIds[]` both participate in relationship graphs.
- **Key Vault, Storage, SQL, etc.:** Managed identities can be documented as principals for secure access, but RBAC and access policy effects are not computed in v1.

### Azure Alignment

- User-assigned identities are standalone resources with independent lifecycle and can be reused across multiple resources.
- System-assigned identities are created on a single resource and are deleted with that resource.
- A supported Azure resource can have both a system-assigned identity and user-assigned identities.
- Each managed identity is backed by a service principal in Microsoft Entra ID.
- Least-privilege RBAC assignment and cleanup of unused user-assigned identities remain documented best practices, not modeled behavior.

### Future Enhancements

- First-class Azure role assignment/RBAC modeling.
- Federated identity credentials.
- Cleanup analysis for unused user-assigned identities and stale role assignments.
