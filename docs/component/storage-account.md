## Azure Storage Account & Blob Storage Component Specification

**Overview:**  
Azure Storage Account is Microsoft's cloud object storage solution for storing massive amounts of unstructured data (blobs, files, queues, tables). This simulator models Storage Accounts and Blob Storage components with focus on security best practices (HTTPS, TLS, shared key controls, data protection) and Well-Architected Framework alignment (Reliability: soft delete; Security: firewall rules; Cost Optimization: access tier selection).

**Core Data Model Alignment:**
StorageV2 (default, recommended) supports all replication types (LRS, GRS, RAGRS, ZRS, GZRS, RAGZRS), all access tiers (Hot, Cool, Archive), and all security features. BlockBlobStorage provides premium performance (LRS/ZRS only). Legacy kinds (BlobStorage, Storage, FileStorage) retained for backward compatibility with deprecation warnings.

**Security Best Practices:**
HTTPS-only (enableHttpsOnly: true) prevents unencrypted data transmission. TLS 1.2+ (minTlsVersion: TLS1_2) removes deprecated protocols. Shared key access (allowSharedKeyAccess: false recommended) aligns with Azure security baseline that recommends Microsoft Entra ID/RBAC over shared keys. Public endpoint (allowPublicEndpoint: false) combined with firewall rules (networkDefaultAction: Deny) restricts access to specific subnets/IPs.

**Data Protection:**
Soft delete (enableSoftDelete: true) with 7+ day retention allows recovery of accidentally deleted containers/blobs, addressing Reliability pillar. Required field validation enforces that soft delete retention days (1-365) is set when soft delete enabled, with HTTPS+TLS requirement to protect recovery operations.

**Network Security:**
Virtual network rules (max 400) restrict access to specified subnets. IP rules (max 400) allow specific CIDR blocks/addresses. networkDefaultAction 'Deny' implements firewall-by-default security posture per Well-Architected recommendations.

**Redundancy & SLA:**
LRS (11 nines, 99.9% SLA) for non-critical. ZRS (12 nines, 99.99% SLA) for zone resilience. GZRS (16 nines, 99.99% SLA) combines zones + geo-replication for maximum durability. Proper replication selection directly impacts reliability targets (RTO/RPO).

**Access Tier Cost Optimization:**
Hot tier: Frequent access; highest storage cost, lowest access cost. Cool tier: Infrequent (30+ days); mid-range costs. Archive tier: Long-term (180+ days); lowest storage cost, highest rehydration cost. Simulator models tier selection for cost awareness; lifecycle management rules (auto-transition) deferred to v2.

**Validation Enforcement:**
accountKind + replication compatibility validated per Azure constraints (e.g., BlockBlobStorage rejects GRS). Soft delete retention (1-365 days) enforced with 7-day warning. Legacy account kinds trigger warnings (not errors) to maintain backward compatibility. Shared key access warning aligns with Azure security baseline. Public endpoint + Allow default action warning flags commonly misconfigured security posture.

**Form Sections:**
Basic Configuration: Storage type, account kind, replication, access tier. Security Settings (new): Shared key access, public endpoint toggles with warning messages. Data Protection (new): Soft delete toggle + conditional retention days field (1-365). Network firewall section remains: default action, virtual network rules, IP rules. TLS and HTTPS sections unchanged.

**Integration with Functions:**
Functions storageAccountId must reference STORAGE_ACCOUNT node; validator warns if BlobStorage (blob-only) is used for host storage, guiding users to StorageV2 (recommended). This integration ensures Functions deployments use appropriate storage account type for reliable host storage.

**Layer Classification:**
Storage accounts always classified as private layer (never public-facing in v1). Access mediated through NICs (Functions, VMs) or virtual network rules. Future private endpoint support will further restrict access to private-only deployments.

**Well-Architected Framework:**
Reliability: Zone-redundant storage options (ZRS, GZRS) for 99.99% SLA; soft delete for data recovery. Security: HTTPS-only, TLS 1.2+, firewall rules, shared key controls. Cost Optimization: Access tier selection per workload access patterns. Operational Excellence: Soft delete supports backup/disaster recovery planning. Performance: Account type selection (Standard vs Premium) and data locality via replication.

**Out of Scope (v1):**
RBAC/Microsoft Entra ID full authorization modeling (allowSharedKeyAccess field documents constraint; full implementation deferred). Versioning and point-in-time restore (soft delete sufficient for v1; versioning deferred to v2 as more complex feature). Lifecycle management rules (automated tier transitions; Cost Optimization feature; deferred). Blob inventory reports, customer-managed encryption keys, Azure Backup integration (advanced/separate services; deferred).

**Critical Constraints:**
Soft delete retention 1-365 days, minimum 7 recommended. Replication type must match account kind per Azure support matrix. HTTPS-only and TLS 1.2+ non-negotiable when soft delete enabled (recovery operation security). Shared key access should trigger warning (security best practice alignment). Account kind Storage/BlobStorage triggers deprecation warning (backward compatibility preserved, not error).

**Do NOT:**
Support account kinds outside the documented 5 types. Allow unsupported replication types per account kind. Remove soft delete or relax retention validation (data protection foundational). Skip HTTPS/TLS validation when soft delete enabled. Allow shared key access without warning. Support versioning or point-in-time restore in v1 (defer to v2 with soft delete as prerequisite).
