<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-vm" /></div>
    <div class="field"><label>Type</label>
      <Select v-model="model.type" :options="computeTypes" option-label="label" option-value="value" class="w-full" />
    </div>

    <!-- VM fields -->
    <template v-if="isVM">
      <div class="field"><label>VM Size</label>
        <div :class="{ 'has-error': getError('size') }" class="input-wrapper">
          <InputText v-model="model.size" class="w-full" placeholder="Standard_D2s_v3" />
        </div>
        <small v-if="getError('size')" class="error-text">{{ getError('size') }}</small>
      </div>
      <div class="field"><label>OS</label><SelectButton v-model="model.os" :options="['Windows','Linux']" /></div>
      <div class="field"><label>Image Publisher</label><InputText v-model="model.imagePublisher" class="w-full" placeholder="Canonical" /></div>
      <div class="field"><label>Image Offer</label><InputText v-model="model.imageOffer" class="w-full" placeholder="UbuntuServer" /></div>
      <div class="field"><label>Image SKU</label><InputText v-model="model.imageSku" class="w-full" placeholder="18.04-LTS" /></div>
      <div class="field"><label>Disk Type</label>
        <Select v-model="model.diskType" :options="['Standard_LRS','StandardSSD_LRS','Premium_LRS']" class="w-full" />
      </div>
      <div class="field"><label>Subnet</label>
        <div :class="{ 'has-error': getError('subnetId') }" class="input-wrapper">
          <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select subnet" />
        </div>
        <small v-if="getError('subnetId')" class="error-text">{{ getError('subnetId') }}</small>
      </div>
      <div class="field"><label>Availability Zone</label>
        <Select v-model="model.availabilityZone" :options="['1','2','3','No zone']" class="w-full" />
      </div>

      <div class="form-section-header">Identity</div>
      <div class="field checkbox-field"><label>Enable Managed Identity</label><ToggleSwitch v-model="model.enableManagedIdentity" />
        <small class="help-text">System-assigned managed identity scoped to this VM. Can be used together with user-assigned identities.</small>
      </div>
      <div class="field"><label>User-Assigned Managed Identities</label>
        <MultiSelect v-model="model.userAssignedIdentityIds" :options="managedIdentityOptions" option-label="label" option-value="value" class="w-full" placeholder="Select identities (optional)" />
        <small class="help-text">Standalone identities that can be assigned to one or more resources.</small>
        <small v-if="getError('userAssignedIdentityIds')" class="error-text">{{ getError('userAssignedIdentityIds') }}</small>
        <small v-if="getWarning('userAssignedIdentityIds')" class="warning-text">{{ getWarning('userAssignedIdentityIds') }}</small>
      </div>
    </template>

    <!-- VMSS fields -->
    <template v-if="isVMSS">
      <div class="field"><label>SKU (VM Size)</label>
        <div :class="{ 'has-error': getError('sku') }" class="input-wrapper">
          <InputText v-model="model.sku" class="w-full" placeholder="Standard_D2s_v3" />
        </div>
        <small v-if="getError('sku')" class="error-text">{{ getError('sku') }}</small>
      </div>
      <div class="field"><label>OS</label><SelectButton v-model="model.os" :options="['Windows','Linux']" /></div>
      <div class="field"><label>Image Publisher</label><InputText v-model="model.imagePublisher" class="w-full" placeholder="Canonical" /></div>
      <div class="field"><label>Image Offer</label><InputText v-model="model.imageOffer" class="w-full" placeholder="UbuntuServer" /></div>
      <div class="field"><label>Image SKU</label><InputText v-model="model.imageSku" class="w-full" placeholder="18.04-LTS" /></div>
      <div class="field"><label>Initial Capacity</label><InputNumber v-model="model.capacity" :min="1" :max="1000" class="w-full" /></div>
      <div class="field"><label>Upgrade Policy</label>
        <Select v-model="model.upgradePolicy" :options="['Automatic','Manual','Rolling']" class="w-full" />
      </div>
      <div class="field checkbox-field"><label>Autoscale Enabled</label><ToggleSwitch v-model="model.autoscaleEnabled" /></div>
      <template v-if="model.autoscaleEnabled">
        <div class="field"><label>Min Capacity</label><InputNumber v-model="model.minCapacity" :min="1" :max="1000" class="w-full" /></div>
        <div class="field"><label>Max Capacity</label><InputNumber v-model="model.maxCapacity" :min="1" :max="1000" class="w-full" /></div>
      </template>
      <div class="field"><label>Subnet</label>
        <div :class="{ 'has-error': getError('subnetId') }" class="input-wrapper">
          <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select subnet" />
        </div>
        <small v-if="getError('subnetId')" class="error-text">{{ getError('subnetId') }}</small>
      </div>

      <div class="form-section-header">Identity</div>
      <div class="field checkbox-field"><label>Enable Managed Identity</label><ToggleSwitch v-model="model.enableManagedIdentity" />
        <small class="help-text">System-assigned managed identity scoped to this scale set. Can be used together with user-assigned identities.</small>
      </div>
      <div class="field"><label>User-Assigned Managed Identities</label>
        <MultiSelect v-model="model.userAssignedIdentityIds" :options="managedIdentityOptions" option-label="label" option-value="value" class="w-full" placeholder="Select identities (optional)" />
        <small class="help-text">Standalone identities that can be shared by replicated workloads.</small>
        <small v-if="getError('userAssignedIdentityIds')" class="error-text">{{ getError('userAssignedIdentityIds') }}</small>
        <small v-if="getWarning('userAssignedIdentityIds')" class="warning-text">{{ getWarning('userAssignedIdentityIds') }}</small>
      </div>
    </template>

    <!-- AKS fields -->
    <template v-if="isAKS">
      <!-- Basic Configuration -->
      <div class="section-title">Basic Configuration</div>
      <div class="field"><label>Kubernetes Version *</label>
        <div :class="{ 'has-error': getError('kubernetesVersion') }" class="input-wrapper">
          <Select v-model="model.kubernetesVersion" :options="['1.35','1.34','1.33','1.32','1.31','1.30','1.29','1.28']" class="w-full" placeholder="Select version (N-2 support)" />
        </div>
        <small v-if="getError('kubernetesVersion')" class="error-text">{{ getError('kubernetesVersion') }}</small>
        <small class="help-text">Azure supports N-2 Kubernetes versions (current: 1.28-1.35)</small>
      </div>
      <div class="field"><label>Pricing Tier</label>
        <SelectButton v-model="model.pricingTier" :options="['Free','Standard','Premium']" class="w-full" />
        <small class="help-text">Free: dev/test only (no SLA) | Standard: production recommended | Premium: advanced SLA</small>
      </div>

      <!-- Cluster Networking -->
      <div class="section-title" style="margin-top: 1.5rem">Cluster Networking</div>
      <div class="field"><label>Network Plugin</label>
        <div :class="{ 'has-error': getError('networkPlugin') }" class="input-wrapper">
          <Select v-model="model.networkPlugin" :options="['azure','azure-overlay','kubenet']" class="w-full" />
        </div>
        <small v-if="getError('networkPlugin')" class="error-text">{{ getError('networkPlugin') }}</small>
        <small class="help-text">Azure CNI (azure/overlay) recommended for production; kubenet for simple Linux networking</small>
      </div>
      <div class="field"><label>API Server Access</label><SelectButton v-model="model.apiServerAccess" :options="['Public','Private']" /></div>
      <div class="field"><label>Subnet *</label>
        <div :class="{ 'has-error': getError('subnetId') }" class="input-wrapper">
          <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select subnet" />
        </div>
        <small v-if="getError('subnetId')" class="error-text">{{ getError('subnetId') }}</small>
      </div>

      <!-- Node Pools -->
      <div class="section-title" style="margin-top: 1.5rem">Node Pools</div>
      <fieldset class="fieldset-box">
        <legend>System Node Pool</legend>
        <div class="field"><label>Size (Nodes)</label>
          <div :class="{ 'has-error': getError('systemNodePoolSize') }" class="input-wrapper">
            <InputNumber v-model="model.systemNodePoolSize" :min="1" :max="1000" class="w-full" placeholder="3" />
          </div>
          <small v-if="getError('systemNodePoolSize')" class="error-text">{{ getError('systemNodePoolSize') }}</small>
          <small class="help-text">Minimum 3 nodes recommended for production to run cluster system components</small>
        </div>
        <div class="field"><label>VM SKU</label>
          <InputText v-model="model.systemNodePoolVmSku" class="w-full" placeholder="Standard_D2d_v5" />
          <small class="help-text">Cost-effective VM size for system components (e.g., D2d_v5)</small>
        </div>
      </fieldset>

      <fieldset class="fieldset-box" style="margin-top: 1rem">
        <legend>User Node Pool</legend>
        <div class="field"><label>Initial Node Count</label>
          <div :class="{ 'has-error': getError('nodeCount') }" class="input-wrapper">
            <InputNumber v-model="model.nodeCount" :min="1" :max="1000" class="w-full" />
          </div>
          <small v-if="getError('nodeCount')" class="error-text">{{ getError('nodeCount') }}</small>
          <small class="help-text">Minimum 2 nodes recommended for application workloads; ≥3 for production</small>
        </div>
        <div class="field"><label>VM Size</label>
          <div :class="{ 'has-error': getError('nodeVmSize') }" class="input-wrapper">
            <InputText v-model="model.nodeVmSize" class="w-full" placeholder="Standard_D4s_v5" />
          </div>
          <small v-if="getError('nodeVmSize')" class="error-text">{{ getError('nodeVmSize') }}</small>
          <small class="help-text">Recommended: D4s_v5 or larger (4GB+ RAM per node)</small>
        </div>
      </fieldset>

      <!-- Autoscaling & Scaling -->
      <div class="section-title" style="margin-top: 1.5rem">Autoscaling & Scaling</div>
      <div class="field checkbox-field"><label>Enable Cluster Autoscaler</label><ToggleSwitch v-model="model.enableClusterAutoscaler" /></div>
      <div v-if="model.enableClusterAutoscaler" class="subfield-group">
        <div class="field"><label>Min Nodes</label>
          <div :class="{ 'has-error': getError('minNodeCount') }" class="input-wrapper">
            <InputNumber v-model="model.minNodeCount" :min="1" :max="1000" class="w-full" />
          </div>
          <small v-if="getError('minNodeCount')" class="error-text">{{ getError('minNodeCount') }}</small>
        </div>
        <div class="field"><label>Max Nodes</label>
          <div :class="{ 'has-error': getError('maxNodeCount') }" class="input-wrapper">
            <InputNumber v-model="model.maxNodeCount" :min="1" :max="1000" class="w-full" />
          </div>
          <small v-if="getError('maxNodeCount')" class="error-text">{{ getError('maxNodeCount') }}</small>
          <small class="help-text">Autoscaler scales between min/max based on resource requests</small>
        </div>
      </div>

      <!-- Availability & Resilience -->
      <div class="section-title" style="margin-top: 1.5rem">Availability & Resilience</div>
      <div class="field"><label>Availability Zones</label>
        <InputText v-model="availabilityZonesStr" class="w-full" placeholder="1,2,3" />
        <small v-if="getError('availabilityZones')" class="error-text">{{ getError('availabilityZones') }}</small>
        <small class="help-text">Comma-separated (1,2,3): 2+ zones for 99.99% SLA; empty = 99.95% SLA (single zone)</small>
      </div>

      <!-- Security & Policies -->
      <div class="section-title" style="margin-top: 1.5rem">Security & Policies</div>
      <div class="field checkbox-field"><label>Enable RBAC (mandatory)</label><ToggleSwitch v-model="model.enableRbac" /></div>
      <div class="field checkbox-field"><label>Private Cluster</label><ToggleSwitch v-model="model.enablePrivateCluster" /></div>
      <div class="field checkbox-field"><label>Enable Network Policies</label><ToggleSwitch v-model="model.enableNetworkPolicy" /></div>
      <div v-if="model.enableNetworkPolicy" class="field">
        <label>Network Policy Provider</label>
        <Select v-model="model.networkPolicyProvider" :options="['azure','calico']" class="w-full" />
        <small class="help-text">Azure NPM (default) or Calico for microsegmentation</small>
      </div>
      <div class="field"><label>API Server Authorized IP Ranges (optional)</label>
        <InputText v-model="apiServerIpsStr" class="w-full" placeholder="203.0.113.0/24, 198.51.100.0/24" />
        <small class="help-text">Comma-separated CIDR blocks for public API server access restriction</small>
      </div>

      <!-- OS & Image Configuration -->
      <div class="section-title" style="margin-top: 1.5rem">OS & Image</div>
      <div class="field"><label>OS SKU</label>
        <Select v-model="model.osSku" :options="['Ubuntu','AzureLinux','Windows2022']" class="w-full" showClear />
        <small class="help-text">Default: Ubuntu 22.04 LTS; AzureLinux optimized for Azure</small>
      </div>
      <div class="field"><label>OS Version</label>
        <InputText v-model="model.osVersion" class="w-full" placeholder="22.04 (Ubuntu), 2404 (AzureLinux)" />
      </div>

      <!-- Monitoring & Operations -->
      <div class="section-title" style="margin-top: 1.5rem">Monitoring & Operations</div>
      <div class="field checkbox-field"><label>Enable Monitoring</label><ToggleSwitch v-model="model.enableMonitoring" /></div>
      <div v-if="model.enableMonitoring" class="field">
        <label>Monitoring Workspace ID (optional)</label>
        <InputText v-model="model.monitoringWorkspaceId" class="w-full" placeholder="/subscriptions/.../resourceGroups/.../providers/Microsoft.OperationalInsights/workspaces/..." />
        <small class="help-text">Log Analytics workspace for Container Insights</small>
      </div>
      <div class="form-section-header">Identity</div>
      <div class="field checkbox-field"><label>Enable Managed Identity</label><ToggleSwitch v-model="model.enableManagedIdentity" />
        <small class="help-text">System-assigned managed identity for cluster-to-Azure authentication. Can be used together with user-assigned identities.</small>
      </div>
      <div class="field"><label>User-Assigned Managed Identities</label>
        <MultiSelect v-model="model.userAssignedIdentityIds" :options="managedIdentityOptions" option-label="label" option-value="value" class="w-full" placeholder="Select identities (optional)" />
        <small class="help-text">Reusable identities for shared cluster access to Azure resources.</small>
        <small v-if="getError('userAssignedIdentityIds')" class="error-text">{{ getError('userAssignedIdentityIds') }}</small>
        <small v-if="getWarning('userAssignedIdentityIds')" class="warning-text">{{ getWarning('userAssignedIdentityIds') }}</small>
      </div>

      <!-- Advanced Configuration (Collapsible) -->
      <div style="margin-top: 1.5rem">
        <button @click="expandedAdvanced = !expandedAdvanced" type="button" class="advanced-toggle">
          {{ expandedAdvanced ? '▼' : '▶' }} Advanced Configuration
        </button>
        <div v-if="expandedAdvanced" class="advanced-section" style="margin-top: 1rem">
          <div class="field"><label>Outbound Traffic Type</label>
            <Select v-model="model.outboundType" :options="['loadBalancer','userDefinedRouting','managedNAT']" class="w-full" showClear />
            <small class="help-text">How cluster egress traffic is routed (default: loadBalancer)</small>
          </div>
          <div class="field"><label>Load Balancer SKU</label>
            <Select v-model="model.loadBalancerSku" :options="['Standard','Basic']" class="w-full" showClear />
            <small class="help-text">Standard recommended; Basic deprecated (default: Standard)</small>
          </div>
          <div class="field"><label>DNS Prefix (optional)</label>
            <InputText v-model="model.dnsPrefix" class="w-full" placeholder="my-aks-cluster" />
            <small class="help-text">For Azure-managed DNS FQDN: {prefix}.{region}.cloudapp.azure.com</small>
          </div>
          <div class="field"><label>Service CIDR (optional)</label>
            <InputText v-model="model.serviceCidr" class="w-full" placeholder="10.0.0.0/16" />
            <small class="help-text">Kubernetes service IP range (must not overlap with node subnet)</small>
          </div>
          <div class="field"><label>DNS Service IP (optional)</label>
            <InputText v-model="model.dnsServiceIp" class="w-full" placeholder="10.0.0.10" />
            <small class="help-text">Must be within service CIDR range</small>
          </div>
          <div class="field"><label>Docker Bridge CIDR (optional)</label>
            <InputText v-model="model.dockerBridgeCidr" class="w-full" placeholder="172.17.0.1/16" />
            <small class="help-text">For Docker bridge network on nodes</small>
          </div>
        </div>
      </div>
    </template>

    <!-- App Service fields -->
    <template v-if="isAppService">
      <!-- Basic Configuration -->
      <div class="form-section-header">Basic Configuration</div>
      <div class="field"><label>Tier *</label>
        <Select v-model="model.tier" :options="appServiceTiers" class="w-full" />
        <small class="help-text">Free/Shared: Shared VMs, dev/test only. Basic+: Dedicated VMs. PremiumV2/V3/V4: Advanced features, high-density. IsolatedV2: Dedicated VNet, maximum isolation.</small>
      </div>
      <div class="field"><label>SKU *</label>
        <Select v-model="model.sku" :options="appServiceSkusByTier" class="w-full" placeholder="Select a tier first" />
        <small v-if="getError('sku')" class="error-text">{{ getError('sku') }}</small>
      </div>
      <div class="field"><label>OS *</label><SelectButton v-model="model.os" :options="['Windows','Linux']" /></div>
      <div class="field"><label>Runtime Stack</label>
        <Select v-model="model.runtimeStack" :options="runtimeStacksByOs" class="w-full" placeholder="Select OS first" />
        <small class="help-text">Runtime and version (e.g., DOTNET|8.0, NODE|20-lts, PYTHON|3.11, JAVA|21-java21)</small>
        <small v-if="getWarning('runtimeStack')" class="warning-text">{{ getWarning('runtimeStack') }}</small>
      </div>

      <!-- Networking & Security -->
      <div class="form-section-header">Networking & Security</div>
      <div class="field"><label>VNet Integration Subnet</label>
        <Select v-model="model.vnetIntegrationSubnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="None (public)" showClear />
        <small class="help-text">Enable secure outbound access to VNet resources. Leave empty for public internet access.</small>
      </div>
      <div class="field checkbox-field"><label>Enable Private Endpoint</label><ToggleSwitch v-model="model.enablePrivateEndpoint" />
        <small class="help-text">Eliminate public internet exposure via Azure Private Link</small>
      </div>
      <div v-if="model.enablePrivateEndpoint" class="field"><label>Private Endpoint ID</label>
        <InputText v-model="model.privateEndpointId" class="w-full" placeholder="Reference to private endpoint resource" />
      </div>
      <div class="field"><label>Custom Domain</label>
        <InputText v-model="model.customDomain" class="w-full" placeholder="myapp.example.com" />
        <small v-if="getWarning('customDomain')" class="warning-text">{{ getWarning('customDomain') }}</small>
      </div>

      <!-- Minimum TLS Version & HTTPS -->
      <div class="field"><label>Minimum TLS Version</label>
        <Select v-model="model.minTlsVersion" :options="['1.0','1.1','1.2','1.3']" class="w-full" placeholder="Default: 1.2" />
        <small class="help-text">Use TLS 1.2 or higher for security (Azure recommends 1.2+)</small>
        <small v-if="getWarning('minTlsVersion')" class="warning-text">{{ getWarning('minTlsVersion') }}</small>
      </div>
      <div class="field checkbox-field"><label>HTTPS Only</label><ToggleSwitch v-model="model.enableHttps" />
        <small class="help-text">Redirect HTTP traffic to HTTPS</small>
      </div>

      <!-- Identity & Authentication -->
      <div class="form-section-header">Identity & Authentication</div>
      <div class="field checkbox-field"><label>Enable Managed Identity</label><ToggleSwitch v-model="model.enableManagedIdentity" />
        <small class="help-text">System-assigned managed identity (scoped to this resource, deleted with resource). Can be used together with user-assigned identities.</small>
      </div>
      <div class="field"><label>User-Assigned Managed Identities</label>
        <MultiSelect v-model="model.userAssignedIdentityIds" :options="managedIdentityOptions" option-label="label" option-value="value" class="w-full" placeholder="Select identities (optional)" />
        <small class="help-text">User-assigned managed identities (standalone, reusable, assignable to multiple resources). Both system-assigned and user-assigned can be enabled at the same time.</small>
        <small v-if="getError('userAssignedIdentityIds')" class="error-text">{{ getError('userAssignedIdentityIds') }}</small>
        <small v-if="getWarning('userAssignedIdentityIds')" class="warning-text">{{ getWarning('userAssignedIdentityIds') }}</small>
      </div>
      <div class="field checkbox-field"><label>Enable Easy Auth</label><ToggleSwitch v-model="model.enableEasyAuth" />
        <small class="help-text">Built-in authentication/authorization with multiple providers</small>
      </div>
      <div v-if="model.enableEasyAuth" class="field"><label>Easy Auth Provider</label>
        <Select v-model="model.easyAuthProvider" :options="['AzureAD','Microsoft','Google','Facebook','X']" class="w-full" />
      </div>

      <!-- Monitoring & Diagnostics -->
      <div class="form-section-header">Monitoring & Diagnostics</div>
      <div class="field checkbox-field"><label>Enable Diagnostic Logging</label><ToggleSwitch v-model="model.enableDiagnosticLogging" />
        <small class="help-text">Track application errors, web server logs, and failed requests</small>
      </div>
      <div class="field"><label>Application Insights Resource</label>
        <InputText v-model="model.applicationInsightsResourceId" class="w-full" placeholder="App Insights resource ID or Log Analytics workspace" />
        <small class="help-text">Enable performance monitoring and usage analytics</small>
      </div>
      <div class="field checkbox-field"><label>Enable Health Check</label><ToggleSwitch v-model="model.enableHealthCheck" /></div>
      <div v-if="model.enableHealthCheck" class="field"><label>Health Check Path</label>
        <InputText v-model="model.healthCheckPath" class="w-full" placeholder="/health" />
        <small class="help-text">Path for health check probe (e.g., /health, /status)</small>
      </div>

      <!-- Key Vault Integration -->
      <div class="form-section-header">Key Vault Integration</div>
      <div class="field"><label>Key Vault</label>
        <Select v-model="model.keyVaultId" :options="keyVaultOptions" option-label="label" option-value="value" class="w-full" placeholder="Select Key Vault" showClear />
        <small v-if="getWarning('keyVaultId')" class="warning-text">{{ getWarning('keyVaultId') }}</small>
      </div>
      <div class="field"><label>Secret Name</label>
        <InputText v-model="model.keyVaultSecretName" class="w-full" placeholder="db-connection-string" />
        <small class="help-text">Use a Key Vault secret name, not a diagram node ID.</small>
        <small v-if="getError('keyVaultSecretName')" class="error-text">{{ getError('keyVaultSecretName') }}</small>
      </div>
      <div class="field"><label>Secret Version</label>
        <InputText v-model="model.keyVaultSecretVersion" class="w-full" placeholder="Optional 32-character Key Vault version" />
        <small v-if="getWarning('keyVaultSecretVersion')" class="warning-text">{{ getWarning('keyVaultSecretVersion') }}</small>
      </div>
      <div class="field">
        <label>Secret URI Preview</label>
        <InputText :model-value="keyVaultSecretUriPreview" class="w-full" readonly />
        <small class="help-text">App setting references use `@Microsoft.KeyVault(SecretUri=...)` over this data-plane URI.</small>
        <small v-if="getWarning('keyVaultSecretUri')" class="warning-text">{{ getWarning('keyVaultSecretUri') }}</small>
      </div>
    </template>

    <!-- Azure Functions fields -->
    <template v-if="isFunctions">
      <!-- Basic Configuration -->
      <div class="form-section-header">Basic Configuration</div>
      <div class="field"><label>Hosting Option *</label>
        <Select v-model="model.hostingOption" :options="functionsHostingOptions" class="w-full" />
        <small class="help-text">Flex Consumption is recommended for new serverless apps. Consumption is legacy.</small>
        <small v-if="getError('hostingOption')" class="error-text">{{ getError('hostingOption') }}</small>
        <small v-if="getWarning('hostingOption')" class="warning-text">{{ getWarning('hostingOption') }}</small>
      </div>
      <div v-if="functionsPlanSkusByHosting.length > 0" class="field"><label>Plan SKU *</label>
        <Select v-model="model.planSku" :options="functionsPlanSkusByHosting" class="w-full" placeholder="Select plan SKU" />
        <small class="help-text">Plan SKU requirements vary by hosting option.</small>
        <small v-if="getError('planSku')" class="error-text">{{ getError('planSku') }}</small>
        <small v-if="getWarning('planSku')" class="warning-text">{{ getWarning('planSku') }}</small>
      </div>
      <div v-else class="field">
        <small class="help-text">No App Service plan SKU is required for this hosting option.</small>
      </div>
      <div class="field"><label>OS</label><SelectButton v-model="model.os" :options="['Windows','Linux']" /></div>
      <div class="field" v-if="getError('os') || getWarning('os')">
        <small v-if="getError('os')" class="error-text">{{ getError('os') }}</small>
        <small v-if="getWarning('os')" class="warning-text">{{ getWarning('os') }}</small>
      </div>
      <div class="field"><label>Runtime Stack *</label>
        <Select v-model="model.runtimeStack" :options="['dotnet','node','python','java','powershell']" class="w-full" />
        <small v-if="getError('runtimeStack')" class="error-text">{{ getError('runtimeStack') }}</small>
      </div>
      <div class="field"><label>Runtime Version *</label>
        <InputText v-model="model.runtimeVersion" class="w-full" placeholder="8.0 / 20 / 3.11 / 21 / 7.4" />
        <small v-if="getError('runtimeVersion')" class="error-text">{{ getError('runtimeVersion') }}</small>
      </div>
      <div class="field"><label>Storage Account *</label>
        <Select v-model="model.storageAccountId" :options="storageOptions" option-label="label" option-value="value" class="w-full" placeholder="Select storage account" />
        <small class="help-text">Required: holds function code and state</small>
        <small v-if="getError('storageAccountId')" class="error-text">{{ getError('storageAccountId') }}</small>
      </div>

      <!-- Networking & Security -->
      <div class="form-section-header">Networking & Security</div>
      <div class="field"><label>VNet Integration Subnet</label>
        <Select v-model="model.vnetIntegrationSubnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="None (public)" showClear />
        <small class="help-text">Enable secure outbound access to VNet resources</small>
        <small v-if="getWarning('vnetIntegrationSubnetId')" class="warning-text">{{ getWarning('vnetIntegrationSubnetId') }}</small>
      </div>
      <div class="field checkbox-field"><label>Enable Private Endpoint</label><ToggleSwitch v-model="model.enablePrivateEndpoint" />
        <small class="help-text">Eliminate public internet exposure via Azure Private Link</small>
        <small v-if="getWarning('enablePrivateEndpoint')" class="warning-text">{{ getWarning('enablePrivateEndpoint') }}</small>
      </div>
      <div v-if="model.enablePrivateEndpoint" class="field"><label>Private Endpoint ID</label>
        <InputText v-model="model.privateEndpointId" class="w-full" placeholder="Reference to private endpoint resource" />
        <small v-if="getWarning('privateEndpointId')" class="warning-text">{{ getWarning('privateEndpointId') }}</small>
      </div>

      <!-- TLS & HTTPS -->
      <div class="field"><label>Minimum TLS Version</label>
        <Select v-model="model.minTlsVersion" :options="['1.0','1.1','1.2','1.3']" class="w-full" placeholder="Default: 1.2" />
        <small class="help-text">Use TLS 1.2 or higher for security</small>
        <small v-if="getWarning('minTlsVersion')" class="warning-text">{{ getWarning('minTlsVersion') }}</small>
      </div>
      <div class="field checkbox-field"><label>HTTPS Only</label><ToggleSwitch v-model="model.enableHttps" />
        <small class="help-text">Redirect HTTP traffic to HTTPS</small>
      </div>

      <!-- Identity & Authentication -->
      <div class="form-section-header">Identity & Authentication</div>
      <div class="field checkbox-field"><label>Enable Managed Identity</label><ToggleSwitch v-model="model.enableManagedIdentity" />
        <small class="help-text">System-assigned managed identity for secure authentication</small>
      </div>
      <div class="field"><label>User-Assigned Managed Identities</label>
        <MultiSelect v-model="model.userAssignedIdentityIds" :options="managedIdentityOptions" option-label="label" option-value="value" class="w-full" placeholder="Select identities (optional)" />
        <small class="help-text">User-assigned identities can be used together with the system-assigned identity.</small>
        <small v-if="getError('userAssignedIdentityIds')" class="error-text">{{ getError('userAssignedIdentityIds') }}</small>
        <small v-if="getWarning('userAssignedIdentityIds')" class="warning-text">{{ getWarning('userAssignedIdentityIds') }}</small>
      </div>

      <!-- Monitoring & Diagnostics -->
      <div class="form-section-header">Monitoring & Diagnostics</div>
      <div class="field checkbox-field"><label>Enable Diagnostic Logging</label><ToggleSwitch v-model="model.enableDiagnosticLogging" />
        <small class="help-text">Track function execution logs and errors</small>
      </div>
      <div class="field"><label>Application Insights Resource</label>
        <InputText v-model="model.applicationInsightsResourceId" class="w-full" placeholder="App Insights or Log Analytics resource ID" />
        <small class="help-text">Enable performance monitoring and usage analytics</small>
      </div>

      <!-- Key Vault Integration -->
      <div class="form-section-header">Key Vault Integration</div>
      <div class="field"><label>Key Vault</label>
        <Select v-model="model.keyVaultId" :options="keyVaultOptions" option-label="label" option-value="value" class="w-full" placeholder="Select Key Vault" showClear />
        <small v-if="getWarning('keyVaultId')" class="warning-text">{{ getWarning('keyVaultId') }}</small>
      </div>
      <div class="field"><label>Secret Name</label>
        <InputText v-model="model.keyVaultSecretName" class="w-full" placeholder="function-app-secret" />
        <small class="help-text">Use a Key Vault secret name, not a diagram node ID.</small>
        <small v-if="getError('keyVaultSecretName')" class="error-text">{{ getError('keyVaultSecretName') }}</small>
      </div>
      <div class="field"><label>Secret Version</label>
        <InputText v-model="model.keyVaultSecretVersion" class="w-full" placeholder="Optional 32-character Key Vault version" />
        <small v-if="getWarning('keyVaultSecretVersion')" class="warning-text">{{ getWarning('keyVaultSecretVersion') }}</small>
      </div>
      <div class="field">
        <label>Secret URI Preview</label>
        <InputText :model-value="keyVaultSecretUriPreview" class="w-full" readonly />
        <small class="help-text">Azure Functions can consume Key Vault references through managed identity-backed app settings.</small>
        <small v-if="getWarning('keyVaultSecretUri')" class="warning-text">{{ getWarning('keyVaultSecretUri') }}</small>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { NetworkComponentType } from '~/types/network'
import { getValidator } from '~/lib/componentValidators'
import { buildKeyVaultObjectUri, normalizeComponentKeyVaultReferences } from '~/lib/keyVault'
import type { FieldError } from '~/types/validation'

const props = defineProps<{ modelValue: any; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })

const validationErrors = computed(() => {
  const validator = getValidator(model.value.type!)
  if (!validator) return []
  return validator(model.value, props.nodes || []).errors
})

function getError(fieldName: string): string | undefined {
  return validationErrors.value.find((e: FieldError) => e.fieldName === fieldName && e.severity === 'error')?.message
}

function getWarning(fieldName: string): string | undefined {
  return validationErrors.value.find((e: FieldError) => e.fieldName === fieldName && e.severity === 'warning')?.message
}

const subnetOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.SUBNET).map(n => ({ label: n.data.name, value: n.id })))
const storageOptions = computed(() => (props.nodes || []).filter(n => [NetworkComponentType.STORAGE_ACCOUNT, NetworkComponentType.BLOB_STORAGE].includes(n.data?.type)).map(n => ({ label: n.data.name, value: n.id })))
const keyVaultOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.KEY_VAULT).map(n => ({ label: n.data.name, value: n.id })))
const managedIdentityOptions = computed(() => (props.nodes || [])
  .filter(n => n.data?.type === NetworkComponentType.MANAGED_IDENTITY && n.data?.identityType === 'UserAssigned')
  .map(n => ({ label: n.data.name, value: n.id })))

const computeTypes = [
  { label: 'Virtual Machine', value: NetworkComponentType.VM },
  { label: 'VM Scale Set', value: NetworkComponentType.VMSS },
  { label: 'AKS Cluster', value: NetworkComponentType.AKS },
  { label: 'App Service', value: NetworkComponentType.APP_SERVICE },
  { label: 'Azure Functions', value: NetworkComponentType.FUNCTIONS },
]
const isVM = computed(() => model.value.type === NetworkComponentType.VM)
const isVMSS = computed(() => model.value.type === NetworkComponentType.VMSS)
const isAKS = computed(() => model.value.type === NetworkComponentType.AKS)
const isAppService = computed(() => model.value.type === NetworkComponentType.APP_SERVICE)
const isFunctions = computed(() => model.value.type === NetworkComponentType.FUNCTIONS)

watchEffect(() => {
  if (!isAppService.value && !isFunctions.value) return
  const normalized = normalizeComponentKeyVaultReferences(model.value, props.nodes || [])
  const fields = ['keyVaultId', 'keyVaultSecretName', 'keyVaultSecretVersion', 'keyVaultSecretUri']
  const changed = fields.some(field => normalized[field] !== model.value[field])
  if (changed) {
    model.value = { ...model.value, ...Object.fromEntries(fields.map(field => [field, normalized[field]])) }
  }
})

const keyVaultSecretUriPreview = computed(() => {
  if (!model.value.keyVaultId || !model.value.keyVaultSecretName) return ''
  const vaultNode = (props.nodes || []).find(node => node.id === model.value.keyVaultId && node.data?.type === NetworkComponentType.KEY_VAULT)
  const vaultName = vaultNode?.data?.name
  if (!vaultName) return ''
  return buildKeyVaultObjectUri(vaultName, 'secrets', model.value.keyVaultSecretName, model.value.keyVaultSecretVersion)
})

// App Service & Functions computed properties
const appServiceTiers = ['Free', 'Shared', 'Basic', 'Standard', 'Premium', 'PremiumV2', 'PremiumV3', 'PremiumV4', 'Isolated', 'IsolatedV2']

const skuTierMap: Record<string, string> = {
  'F1': 'Free',
  'D1': 'Shared',
  'B1': 'Basic', 'B2': 'Basic', 'B3': 'Basic',
  'S1': 'Standard', 'S2': 'Standard', 'S3': 'Standard',
  'P1v2': 'Premium', 'P2v2': 'Premium', 'P3v2': 'Premium',
  'P1v3': 'PremiumV3', 'P2v3': 'PremiumV3', 'P3v3': 'PremiumV3',
  'P1v4': 'PremiumV4', 'P2v4': 'PremiumV4', 'P3v4': 'PremiumV4',
  'P1': 'Premium',
  'I1v2': 'IsolatedV2', 'I2v2': 'IsolatedV2', 'I3v2': 'IsolatedV2',
}

const appServiceSkusByTier = computed(() => {
  const tierToSkus: Record<string, string[]> = {
    'Free': ['F1'],
    'Shared': ['D1'],
    'Basic': ['B1', 'B2', 'B3'],
    'Standard': ['S1', 'S2', 'S3'],
    'Premium': ['P1', 'P1v2', 'P2v2', 'P3v2'],
    'PremiumV3': ['P1v3', 'P2v3', 'P3v3'],
    'PremiumV4': ['P1v4', 'P2v4', 'P3v4'],
    'Isolated': ['I1', 'I2', 'I3'],
    'IsolatedV2': ['I1v2', 'I2v2', 'I3v2'],
  }
  return tierToSkus[model.value.tier] || []
})

const runtimeStacksByOs = computed(() => {
  const stacks: Record<string, string[]> = {
    'Windows': ['DOTNET|8.0', 'DOTNET|7.0', 'DOTNET|6.0', 'DOTNET|Framework|4.8', 'NODE|20-lts', 'NODE|18-lts', 'PHP|8.3', 'JAVA|21-java21', 'JAVA|11-java11', 'PYTHON|3.11'],
    'Linux': ['DOTNET|8.0', 'DOTNET|7.0', 'NODE|20-lts', 'NODE|18-lts', 'PYTHON|3.11', 'PYTHON|3.10', 'JAVA|21-java21', 'JAVA|11-java11', 'RUBY|3.2', 'GO|1.20', 'PHP|8.3'],
  }
  return stacks[model.value.os] || []
})

const functionsHostingOptions = ['FlexConsumption', 'Premium', 'Dedicated', 'ContainerApps', 'Consumption']

const functionsPlanSkusByHosting = computed(() => {
  const skuMap: Record<string, string[]> = {
    FlexConsumption: ['FC1'],
    Premium: ['EP1', 'EP2', 'EP3'],
    Dedicated: [
      'B1', 'B2', 'B3',
      'S1', 'S2', 'S3',
      'P1v2', 'P2v2', 'P3v2',
      'P1v3', 'P2v3', 'P3v3',
      'P1v4', 'P2v4', 'P3v4',
      'I1v2', 'I2v2', 'I3v2',
    ],
    ContainerApps: [],
    Consumption: ['Y1'],
  }

  return skuMap[model.value.hostingOption] || []
})

watchEffect(() => {
  if (!isFunctions.value) return

  if (!model.value.hostingOption) {
    const legacySku = model.value.hostingPlanSku
    const legacyTier = model.value.tier

    if (legacySku) {
      if (legacySku === 'Y1') model.value.hostingOption = 'Consumption'
      else if (String(legacySku).startsWith('EP')) model.value.hostingOption = 'Premium'
      else model.value.hostingOption = 'Dedicated'
    } else if (legacyTier) {
      if (legacyTier === 'Free' || legacyTier === 'Shared') model.value.hostingOption = 'Consumption'
      else if (String(legacyTier).startsWith('Premium')) model.value.hostingOption = 'Premium'
      else model.value.hostingOption = 'Dedicated'
    }
  }

  if (!model.value.planSku && model.value.hostingPlanSku) {
    model.value.planSku = model.value.hostingPlanSku
  }

  if (model.value.planSku) {
    model.value.hostingPlanSku = model.value.planSku
  }

  if (!model.value.os && (model.value.hostingOption === 'FlexConsumption' || model.value.hostingOption === 'ContainerApps')) {
    model.value.os = 'Linux'
  }
})

// AKS computed properties for string parsing
const expandedAdvanced = ref(false)
const availabilityZonesStr = computed({
  get: () => model.value.availabilityZones?.join(',') || '',
  set: (v: string) => {
    model.value.availabilityZones = v ? v.split(',').map(z => z.trim()).filter(z => z) : undefined
  }
})
const apiServerIpsStr = computed({
  get: () => model.value.apiServerAuthorizedIpRanges?.join(', ') || '',
  set: (v: string) => {
    model.value.apiServerAuthorizedIpRanges = v ? v.split(',').map(ip => ip.trim()).filter(ip => ip) : undefined
  }
})
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
.input-wrapper { position: relative; }
.input-wrapper.has-error :deep(input),
.input-wrapper.has-error :deep(.p-select),
.input-wrapper.has-error :deep(.p-select-trigger),
.input-wrapper.has-error :deep(.p-inputnumber-input) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}

/* AKS form enhancements */
.section-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-color);
  padding: 0.5rem 0 0.3rem 0;
  border-bottom: 1px solid var(--surface-border);
  margin-top: 1.5rem;
}
.section-title:first-child { margin-top: 0; }

/* App Service & Functions form sections */
.form-section-header {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-color);
  padding: 0.75rem 0 0.5rem 0;
  border-bottom: 2px solid var(--primary-color);
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
}
.form-section-header:first-of-type { margin-top: 0; }

.error-text {
  font-size: 0.75rem;
  color: var(--red-500);
  font-weight: 500;
}

.warning-text {
  font-size: 0.75rem;
  color: var(--orange-500);
  font-weight: 500;
}

.help-text {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  font-style: italic;
}

.fieldset-box {
  border: 1px solid var(--surface-border);
  border-radius: 0.3rem;
  padding: 0.75rem;
  margin: 0;
}
.fieldset-box legend {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-color-secondary);
  padding: 0 0.3rem;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.radio-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}
.badge-warning {
  font-size: 0.7rem;
  background-color: var(--orange-100);
  color: var(--orange-700);
  padding: 0.15rem 0.4rem;
  border-radius: 0.2rem;
  margin-left: auto;
}
.badge-info {
  font-size: 0.7rem;
  background-color: var(--blue-100);
  color: var(--blue-700);
  padding: 0.15rem 0.4rem;
  border-radius: 0.2rem;
  margin-left: auto;
}

.subfield-group {
  margin-left: 1rem;
  padding-left: 1rem;
  border-left: 2px solid var(--surface-border);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.advanced-toggle {
  background: none;
  border: none;
  color: var(--text-color-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0;
  cursor: pointer;
  transition: color 0.2s;
}
.advanced-toggle:hover {
  color: var(--text-color);
}

.advanced-section {
  padding: 1rem;
  background-color: var(--surface-50);
  border: 1px solid var(--surface-border);
  border-radius: 0.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.help-text {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  font-style: italic;
}

.error-text {
  color: var(--red-500);
  font-size: 0.75rem;
}
</style>
