## Azure App Service Component Specification

**Overview:**  
Azure App Service is a fully managed platform-as-a-service (PaaS) for building and hosting web apps, mobile backends, RESTful APIs, and automated business processes. It supports multiple runtime stacks (.NET, Node.js, Python, Java, PHP, Ruby, Go) on Windows and Linux, with automatic patching, load balancing, and autoscaling. App Service runs within an App Service plan (compute resource container) that defines the VM size, operating system, and pricing tier. App Service integrates with Azure Virtual Networks for secure inbound/outbound connectivity, supports managed identities for passwordless authentication, and provides built-in security features including TLS/SSL termination, authentication/authorization (Easy Auth), IP restrictions, and private endpoints for completely private access via Azure Private Link.

**Data Model** (`AppServiceComponent` in `types/network.ts`):

```typescript
export interface AppServiceComponent extends NetworkComponent {
  // Plan & Tier
  sku: 'F1' | 'D1' | 'B1' | 'B2' | 'B3' | 'S1' | 'S2' | 'S3' | 'P1v2' | 'P2v2' | 'P3v2' | 'P1v3' | 'P2v3' | 'P3v3' | 'P1v4' | 'P2v4' | 'P3v4' | 'I1v2' | 'I2v2' | 'I3v2'
  tier: 'Free' | 'Shared' | 'Basic' | 'Standard' | 'Premium' | 'PremiumV2' | 'PremiumV3' | 'PremiumV4' | 'Isolated' | 'IsolatedV2'
  os: 'Windows' | 'Linux'
  // Runtime & Workload
  runtimeStack?: string // e.g., DOTNET|8.0, NODE|20-lts, PYTHON|3.11
  // Networking
  vnetIntegrationSubnetId?: string
  enablePrivateEndpoint?: boolean
  privateEndpointId?: string
  ipRestrictions?: Array<{ ipAddress: string; priority?: number; action?: 'Allow' | 'Deny' }>
  customDomain?: string
  // Security & TLS
  enableHttps?: boolean
  minTlsVersion?: '1.0' | '1.1' | '1.2' | '1.3'
  enableManagedIdentity?: boolean
  userAssignedIdentityIds?: string[]
  // Authentication & Authorization
  enableEasyAuth?: boolean
  easyAuthProvider?: 'AzureAD' | 'Microsoft' | 'Google' | 'Facebook' | 'X'
  // Monitoring & Diagnostics
  enableDiagnosticLogging?: boolean
  applicationInsightsResourceId?: string
  enableHealthCheck?: boolean
  healthCheckPath?: string
  // Key Vault integration
  keyVaultSecretUri?: string
}
```

**Pricing Tiers & SKU Mapping:**

| Tier | SKU | Compute | Features | Use Case |
|---|---|---|---|---|
| **Free** | F1 | Shared (1 GB) | No custom domains, no SSL bindings, dev/test only | Learning, proof-of-concept |
| **Shared** | D1 | Shared (1 GB) | Custom domains, 50 MB storage, dev/test only | Light development workloads |
| **Basic** | B1, B2, B3 | Dedicated 1-4 vCPU | Custom domains, SSL bindings, autoscale (manual), 50-250 GB storage | Small to medium production apps |
| **Standard** | S1, S2, S3 | Dedicated 1-3 vCPU | Deployment slots, automatic backups, autoscale (schedule/metric-based), 50-250 GB storage | Standard production apps |
| **Premium** | P1, P1v2, P2v2, P3v2 | Dedicated 1-4 vCPU | Isolated network integration, service endpoints, traffic manager integration, up to 1 TB storage | Premium production apps |
| **PremiumV3** | P1v3, P2v3, P3v3 | Dedicated 2-8 vCPU (newer hardware) | Same as Premium with newer instances | Modern production apps |
| **PremiumV4** | P1v4, P2v4, P3v4 | Dedicated 2-8 vCPU (latest) | Same as PremiumV3 | Latest-gen production apps |
| **Isolated** | I1, I2, I3 | Dedicated VNet isolation | App Service Environment (ASE), complete network isolation, no public internet exposure possible | Highly regulated workloads (banking, healthcare) |
| **IsolatedV2** | I1v2, I2v2, I3v2 | Dedicated VNet isolation (latest) | Same as Isolated with newer hardware | Modern regulated workloads |

**Azure Best Practices Alignment:**

| Constraint | Implementation | Validation |
|---|---|---|
| **Tier Support** | All 9 tiers supported (Free, Shared, Basic, Standard, Premium, PremiumV2, PremiumV3, PremiumV4, IsolatedV2) | Form tier selector includes all; validator enforces valid tier |
| **SKU-to-Tier Mapping** | SKU must match tier (e.g., P1v3 only for PremiumV3) | Validator checks skuTierMap; form SKU dropdown is tier-specific |
| **OS Support** | Windows, Linux; affects available runtimes | Form OS selector; runtime stack dropdown is OS-dependent |
| **Runtime Stacks** | Windows: .NET 4.8/6/7/8, Node.js, PHP, Java. Linux: .NET 6/7/8, Node.js, Python, Java, Ruby, Go, PHP | Form runtime selector shows OS-specific options |
| **VNet Integration** | Secure outbound access to VNet resources; inbound still requires explicit rules | Optional vnetIntegrationSubnetId; validator warns if missing for private workloads |
| **Private Endpoints** | Eliminate public internet exposure via Azure Private Link; inbound access only from private networks | Optional enablePrivateEndpoint + privateEndpointId; validator warns if mismatch |
| **Managed Identity** | System-assigned or user-assigned for Azure service authentication; eliminate stored credentials | Optional enableManagedIdentity; validator errors if both system and user-assigned set |
| **TLS Enforcement** | Minimum TLS 1.2+ (Azure default); redirect HTTP to HTTPS | Optional minTlsVersion; validator warns if < 1.2; enableHttps forces redirect |
| **Custom Domains** | Not supported on Free/Shared tiers | Validator warns if custom domain on Free/Shared |
| **Key Vault Integration** | Store secrets (DB credentials, API keys) in Key Vault; app accesses via managed identity | Optional keyVaultSecretUri; validator warns if referenced vault doesn't exist |
| **Authentication/Authorization** | Built-in Easy Auth with Microsoft Entra ID, Microsoft, Google, Facebook, X | Optional enableEasyAuth + easyAuthProvider selector |
| **Diagnostic Logging** | Enable for app errors, web server logs, failed request traces | Optional enableDiagnosticLogging |
| **Application Insights** | Monitor performance, usage, exceptions, dependencies | Optional applicationInsightsResourceId |
| **Health Checks** | Monitor app health; autoscale uses health status | Optional enableHealthCheck + healthCheckPath |

**Form Behavior** (`ComputeForm.vue`):

Form sections organized into logical groups:

1. **Basic Configuration:**
   - Tier selector (all 9 tiers with descriptions)
   - SKU selector (tier-specific dropdown; options update when tier changes)
   - OS selector (Windows/Linux; runtime stack options update)
   - Runtime Stack selector (OS-specific options: .NET, Node.js, Python, Java, PHP, Ruby, Go)

2. **Networking & Security:**
   - VNet Integration Subnet selector (optional)
   - Private Endpoint toggle + optional endpoint ID field
   - Custom Domain input (free text)
   - Minimum TLS Version selector (1.0, 1.1, 1.2, 1.3)
   - HTTPS Only toggle

3. **Identity & Authentication:**
   - Managed Identity toggle (system-assigned)
   - User-Assigned Managed Identities MultiSelect
   - Easy Auth toggle + conditional provider selector

4. **Monitoring & Diagnostics:**
   - Diagnostic Logging toggle
   - Application Insights Resource input (optional)
   - Health Check toggle + conditional path field

5. **Key Vault Integration:**
   - Key Vault Secret URI input (optional)

**Validation Rules** (`validateAppService()` in `componentValidators.ts`):

- ❌ Error: `tier` must be one of supported tiers
- ❌ Error: `sku` must be valid for selected tier
- ❌ Error: `os` must be 'Windows' or 'Linux'
- ❌ Error: `minTlsVersion` must be 1.0, 1.1, 1.2, or 1.3
- ❌ Error: Cannot have both system-assigned and user-assigned managed identities enabled simultaneously
- ⚠️ Warning: Runtime stack recommended for deployment realism
- ⚠️ Warning: TLS < 1.2 is deprecated (use 1.2 or 1.3)
- ⚠️ Warning: Free/Shared tier doesn't support custom domains
- ⚠️ Warning: Free/Shared tier doesn't support VNet integration
- ⚠️ Warning: Free/Shared tier doesn't support managed identity (shared compute)
- ⚠️ Warning: VNet integration enabled but no subnet reference
- ⚠️ Warning: Private endpoint enabled but no endpoint ID
- ⚠️ Warning: Referenced Key Vault, Application Insights, or managed identity doesn't exist
- ⚠️ Warning: Easy Auth enabled but no provider specified

**Layer Classification:**

- **Public-facing:** No VNet integration AND no private endpoint enabled (default app.azurewebsites.net public domain)
- **Private:** VNet integration enabled (outbound access to VNet, but still publicly accessible on app.azurewebsites.net)
- **Private:** Private endpoint enabled (inbound access only from private networks; public access eliminated)

**Key Integration Points:**

- **Managed Identity:** System or user-assigned identity for accessing Key Vault, SQL Database, Storage, etc.
- **Key Vault References:** App settings and connection strings reference Key Vault secrets via managed identity
- **Application Insights:** Performance monitoring, custom metrics, dependency tracking
- **VNet Integration:** Secure outbound traffic to VNet-scoped resources (databases, caches, APIs in VNet)
- **Private Endpoints:** Completely private inbound connectivity from private networks
- **Easy Auth:** Built-in authentication reduces custom auth code; supports multiple providers

**Azure Alignment:**

- ✓ All 9 modern tiers with correct tier-to-SKU mapping
- ✓ Tier-specific feature matrix (Free/Shared limitations, Basic+ autoscaling, Premium advanced features, Isolated/IsolatedV2 complete isolation)
- ✓ OS-specific runtime stack options
- ✓ Managed identity support (system and user-assigned) with single-selection enforcement
- ✓ TLS version enforcement (1.0-1.3) with deprecation warnings
- ✓ VNet integration and private endpoint security features
- ✓ Custom domain support (with tier constraints)
- ✓ Easy Auth provider selection
- ✓ Diagnostic logging and Application Insights integration
- ✓ Well-Architected Framework: Security (TLS, managed identity, Key Vault), Reliability (health checks, Application Insights), Operational Excellence (logging, monitoring)

**Do NOT:**

- Remove modern tier support (PremiumV2, PremiumV3, PremiumV4, IsolatedV2 are current Azure standard)
- Allow SKU field as free text (must validate per tier)
- Skip tier-to-SKU validation in form and validator
- Remove managed identity fields (critical for passwordless auth)
- Remove TLS version minimum enforcement (security requirement)
- Allow tier-incompatible features (e.g., custom domains on Free)
- Skip Key Vault/Application Insights reference validation
- Merge App Service plan modeling (per-app plan metadata model is correct for v1)

**Future Enhancements (Out of Scope):**

- App Service Environment (ASE) as separate component (enterprise isolation; use Isolated tier for now)
- Deployment slots (staging environments; metadata-only feature)
- Traffic routing policies (geo-distribution, canary deployments)
- Autoscaling rules modeling (scale-out thresholds, schedule-based scaling)
- Custom certificate upload UI (Key Vault integration replaces this)
- Hybrid connections for on-premises resources
- App Service Domain registration integration
- Multi-region active-active replication

**Functions Component (`FunctionsComponent`) Alignment:**

Azure Functions use a Functions-native hosting model and maintain legacy compatibility:
- Hosting option: `FlexConsumption | Premium | Dedicated | ContainerApps | Consumption`
- Plan SKU: `FC1` (Flex), `EP1-EP3` (Premium), dedicated App Service SKUs for Dedicated, `Y1` for legacy Consumption
- OS metadata: `Windows | Linux` (Linux-only constraints apply to Flex Consumption and Container Apps)
- Legacy compatibility fields still accepted/read: `hostingPlanSku`, `tier`
- Required Storage Account (host storage) remains mandatory and must reference an existing Storage Account or Blob Storage resource; GPv2 is recommended for new deployments
- Similar networking (VNet integration, private endpoints), security (TLS/HTTPS, managed identity), and monitoring features remain supported

**Functions Validation Highlights** (`validateFunctions()` in `componentValidators.ts`):

- ❌ Error: `hostingOption` must be one of supported options
- ❌ Error: `planSku` must match selected hosting option where applicable
- ❌ Error: `runtimeStack` must be one of `dotnet|node|python|java|powershell`
- ❌ Error: `runtimeVersion` is required
- ❌ Error: `storageAccountId` is required and must reference an existing node
- ❌ Error: system-assigned and user-assigned managed identities cannot both be enabled
- ⚠️ Warning: Consumption hosting is legacy for new serverless workloads
- ⚠️ Warning: Linux Consumption retirement guidance surfaced when applicable
- ⚠️ Warning: Blob-only storage is not recommended for default host storage
- ⚠️ Warning: Private endpoint and VNet integration capability checks are surfaced per hosting option
- ⚠️ Warning: HTTPS-only and TLS 1.2+ are recommended
