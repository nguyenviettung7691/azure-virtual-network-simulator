## Azure Application Security Group (ASG) Component Specification

**Overview:**  
An Application Security Group (ASG) is a lightweight, logical container for grouping network interface cards (NICs) within a virtual network. ASGs simplify network security management by allowing administrators to apply NSG rules to groups of NICs rather than individual IP addresses. All NICs in an ASG must reside in the same virtual network and location. ASGs enable dynamic, scalable security policies where new NICs can be added to an ASG without modifying underlying NSG rules.

**Data Model** (`AsgComponent` in `types/network.ts`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | ASG name (recommended pattern: "{purpose}-asg") |
| `type` | `ASG` | ✓ | Enum value |
| `description` | string | — | Optional free-form text |
| `nicIds` | string[] | — | Optional array of NIC IDs that are members of this ASG (derived from NIC.asgIds references) |
| `tags` | object | — | Key-value metadata |
| `createdAt` | string | ✓ | ISO 8601 timestamp |

**Azure Alignment & Constraints:**

| Constraint | Azure Requirement | Implementation |
|---|---|---|
| **VNet Scoping** | All NICs in an ASG must exist in the same virtual network | ✓ Validated: if NIC added to ASG, must be in same VNet as other members |
| **Location Scoping** | All NICs in an ASG must be in the same region | ℹ️ Simulator treats single diagram as single region |
| **Per-NIC Limit** | Each NIC can belong to max 20 ASGs | ⚠️ Validated: warning if NIC referenced by 20+ ASGs |
| **Per-NSG Limit** | Max 100 ASGs can be referenced in all rules of an NSG | ℹ️ Informational; not strict validation in simulator |
| **Subscription Limit** | Max 3,000 ASGs per subscription | ℹ️ Not enforced in simulator (client-side only) |
| **Bidirectional NSG Refs** | If ASG used as both source AND destination in same NSG rule, both must be in same VNet | ✓ Validated: error if source ASG and dest ASG in different VNets |
| **No Explicit IPs** | ASGs do not hold IP addresses; NICs hold IPs and ASG memberships | ✓ Modeled: ASG is metadata container only |

**Form Fields & Validation:**

1. **Name** (required text)
   - Placeholder: `"web-servers-asg"` or `"app-tier-asg"`
   - **Validation Rules:**
     - Required, non-empty
     - Suggested pattern: lowercase alphanumeric + hyphens (Azure naming convention)

2. **Description** (optional textarea)
   - Placeholder: `"Holds all production web server NICs for rule simplification"`
   - **Validation Rules:**
     - Optional; if provided, recommended max 200 chars

3. **Virtual Network** (read-only display, NIC-dependent)
   - **Display Logic:**
     - If `nicIds` array is empty: Show placeholder text "(No NICs assigned; VNet will be determined when first NIC is added)"
     - If `nicIds` array has members: Show VNet name of first NIC (all NICs validated to be in same VNet)
   - **Behavior:** Cannot manually edit; derived from NIC membership
   - **Purpose:** Educate user about VNet scoping constraint

4. **Member NICs Count** (read-only display)
   - **Display:** "{count} NIC(s) in this group"
   - **Behavior:** Automatically updates as NICs are added/removed
   - **Visual Indicator:** If count = 0, show warning icon and text "No NICs assigned yet"

**Validation Logic** (`validateAsg()` in `lib/componentValidators.ts`):

```typescript
function validateAsg(data: Partial<AsgComponent>, nodes: DiagramNode[]): ValidationResult {
  const errors: any[] = []

  // 1. Name: required
  if (!data.name || data.name.trim() === '') {
    addError(errors, 'name', 'ASG name is required')
  }

  // 2. If nicIds populated, validate all NICs exist and are in same VNet
  if (data.nicIds && Array.isArray(data.nicIds) && data.nicIds.length > 0) {
    const vnetId = getVNetFromNic(data.nicIds[0], nodes) // Get VNet of first NIC
    for (const nicId of data.nicIds) {
      if (!nodeExists(nicId, nodes)) {
        addError(errors, 'nicIds', `Referenced NIC does not exist`, 'warning')
        break
      }
      const nicVnet = getVNetFromNic(nicId, nodes)
      if (nicVnet !== vnetId) {
        // Cross-VNet membership detected
        addError(
          errors,
          'nicIds',
          `Cannot add NICs from different VNets to same ASG. NIC is in different VNet.`,
          'error'
        )
        break
      }
    }
  }

  return { isValid: errors.filter(e => e.severity === 'error').length === 0, errors }
}
```

Helper function:
- `getVNetFromNic(nicId, nodes)` — walks NIC → Subnet → VNet to find VNet ID

**Integration with Other Components:**

- **Network Interface Cards (NICs):** NICs reference ASGs via `asgIds` array (bidirectional). Form shows multi-select checkboxes to add/remove NIC membership. Validation ensures all NICs in ASG are same VNet.
- **NSG Rules:** NSG rules can reference ASGs as source or destination via `sourceAsgId` and `destinationAsgId` fields. All NICs in a referenced ASG are affected by the rule. Validation ensures if both source and destination are ASGs, both ASGs are in same VNet.
- **VNet Context:** ASG's VNet is inferred from member NICs (first NIC's VNet determines scope). Cannot move ASG across VNets without removing all NICs and re-adding from new VNet.

**Auto-Layout Positioning:**

- **Layer:** `'policy'` (outside-VNet policy layer, alongside NSGs)
- **Positioning:** ASGs positioned near NSGs but without containment structure (metadata containers, not network topology)
- **Visual Indicator:** ASG nodes display with a distinct icon and NIC membership count badge

**Key Invariants:**

- ASG name should follow Azure naming convention (lowercase, hyphens, no underscores)
- All NICs in `nicIds` array must be in same VNet (enforced at validation time)
- Each NIC can belong to at most 20 ASGs (warning if exceeded)
- ASG is a metadata container only; does not hold IP addresses or security policies directly (policies applied via NSG rules)
- ASG membership is bidirectional: NIC.asgIds[] and ASG.nicIds[] must stay synchronized
- VNet cannot be manually set; determined by first NIC added to ASG
- Removing all NICs from ASG does not delete ASG (can remain empty until populated again)

**Future Enhancements (Out of Scope):**

- **ASG per-subscription quotas:** Would require global quota tracking
- **Multiple regions:** Simulator assumes single region; ASG region constraint not enforced
- **Effective ASG Rules Computation:** Computing all active NSG rules targeting an ASG (complex; deferred)
- **ASG tagging:** Advanced metadata beyond current tags field
- **Dynamic membership:** Rules-based auto-membership based on tag matching (advanced feature)
