import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Shield, Lock, Eye, FileSearch, Heart, X, Database, FileText, GitBranch, BarChart3, Info } from 'lucide-react'

type AuthType = 'bearer' | 'oauth2' | 'sigv4'

export function LoginPage() {
  const navigate = useNavigate()
  const [endpoint, setEndpoint] = useState('')
  const [authType, setAuthType] = useState<AuthType>('bearer')

  // Bearer token auth
  const [token, setToken] = useState('')

  // OAuth2 auth
  const [oauthEndpoint, setOauthEndpoint] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [oauthScope, setOauthScope] = useState('')

  // SigV4 auth (AWS)
  const [awsAccessKey, setAwsAccessKey] = useState('')
  const [awsSecretKey, setAwsSecretKey] = useState('')
  const [awsRegion, setAwsRegion] = useState('us-east-1')
  const [awsService, setAwsService] = useState<'s3tables' | 'glue'>('glue')

  const [warehouse, setWarehouse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [showFeaturesModal, setShowFeaturesModal] = useState(false)
  const [showWarehouseModal, setShowWarehouseModal] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Validate endpoint
      if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
        throw new Error('Endpoint must start with http:// or https://')
      }

      // Validate auth fields based on type
      if (authType === 'bearer' && !token) {
        throw new Error('Bearer token is required')
      }
      if (authType === 'oauth2' && (!clientId || !clientSecret)) {
        throw new Error('OAuth2 client ID and client secret are required')
      }
      if (authType === 'sigv4') {
        if (!awsAccessKey || !awsSecretKey || !awsRegion) {
          throw new Error('AWS access key, secret key, and region are required')
        }
        if (!warehouse) {
          throw new Error('Warehouse (AWS Account ID) is required for AWS Glue')
        }
      }

      // Build auth payload based on type
      const authPayload: any = {
        endpoint,
        authType,
        warehouse: warehouse || null,
      }

      if (authType === 'bearer') {
        authPayload.token = token
      } else if (authType === 'oauth2') {
        authPayload.oauthEndpoint = oauthEndpoint
        authPayload.clientId = clientId
        authPayload.clientSecret = clientSecret
        authPayload.oauthScope = oauthScope || 'PRINCIPAL_ROLE:ALL'
      } else if (authType === 'sigv4') {
        authPayload.awsAccessKey = awsAccessKey
        authPayload.awsSecretKey = awsSecretKey
        authPayload.awsRegion = awsRegion
        authPayload.awsService = awsService
      }

      // Call login endpoint to create secure session
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authPayload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Login failed')
      }

      const { sessionId } = await response.json()

      // Store session ID and connection details
      sessionStorage.setItem('iceberg-session-id', sessionId)
      sessionStorage.setItem('iceberg-endpoint', endpoint)
      sessionStorage.setItem('iceberg-auth-type', authType)
      if (warehouse) {
        sessionStorage.setItem('iceberg-warehouse', warehouse)
      }
      if (authType === 'sigv4' && awsRegion) {
        sessionStorage.setItem('iceberg-aws-region', awsRegion)
      }

      // Navigate to catalog explorer
      navigate('/catalog')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="iceberg.rest"
            className="w-64 h-auto mx-auto mb-2"
          />
          <p className="text-muted-foreground font-light">
            Explore your Apache Iceberg REST catalog and view metadata about your namespaces and tables -{' '}
            <button
              onClick={() => setShowFeaturesModal(true)}
              className="text-primary hover:underline font-medium"
            >
              click here
            </button>
            {' '}to see what I can show you
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-light">Connect to your catalog</CardTitle>
            <CardDescription>Enter your Apache Iceberg REST connection details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="endpoint">REST Catalog Endpoint *</Label>
                <Input
                  id="endpoint"
                  type="url"
                  placeholder="https://your-catalog.example.com"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="authType">Authentication Type *</Label>
                <select
                  id="authType"
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value as AuthType)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                  required
                >
                  <option value="bearer">Bearer Token (R2 Data Catalog, Unity Catalog)</option>
                  <option value="oauth2">OAuth2 (Snowflake, Confluent)</option>
                  <option value="sigv4">AWS SigV4 (Glue)</option>
                </select>
              </div>

              {/* Bearer Token Auth */}
              {authType === 'bearer' && (
                <div className="space-y-2">
                  <Label htmlFor="token">Authentication Token *</Label>
                  <Input
                    id="token"
                    type="password"
                    placeholder="Enter your token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* OAuth2 Auth */}
              {authType === 'oauth2' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="clientId">Client ID *</Label>
                    <Input
                      id="clientId"
                      type="text"
                      placeholder="Enter your OAuth2 client ID"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientSecret">Client Secret *</Label>
                    <Input
                      id="clientSecret"
                      type="password"
                      placeholder="Enter your OAuth2 client secret"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="oauthScope">OAuth2 Scope (Optional)</Label>
                    <Input
                      id="oauthScope"
                      type="text"
                      placeholder="PRINCIPAL_ROLE:ALL"
                      value={oauthScope}
                      onChange={(e) => setOauthScope(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Default: PRINCIPAL_ROLE:ALL (for Polaris/Snowflake Open Catalog)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="oauth">OAuth2 Token Endpoint (Optional)</Label>
                    <Input
                      id="oauth"
                      type="url"
                      placeholder="https://oauth.example.com/oauth/token"
                      value={oauthEndpoint}
                      onChange={(e) => setOauthEndpoint(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      If not specified, will use: {endpoint || '<catalog-endpoint>'}/v1/oauth/tokens
                    </p>
                  </div>
                </>
              )}

              {/* AWS SigV4 Auth */}
              {authType === 'sigv4' && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-900">
                    <strong>Note:</strong> For security reasons, browsers cannot access your AWS CLI credentials or default credential chain.
                    Please manually enter your AWS access key and secret key below.
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="awsService">AWS Service *</Label>
                    <select
                      id="awsService"
                      value={awsService}
                      onChange={(e) => setAwsService(e.target.value as 's3tables' | 'glue')}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                      required
                    >
                      <option value="glue">AWS Glue Data Catalog</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="awsAccessKey">AWS Access Key *</Label>
                    <Input
                      id="awsAccessKey"
                      type="text"
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                      value={awsAccessKey}
                      onChange={(e) => setAwsAccessKey(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="awsSecretKey">AWS Secret Key *</Label>
                    <Input
                      id="awsSecretKey"
                      type="password"
                      placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                      value={awsSecretKey}
                      onChange={(e) => setAwsSecretKey(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="awsRegion">AWS Region *</Label>
                    <Input
                      id="awsRegion"
                      type="text"
                      placeholder="us-east-1"
                      value={awsRegion}
                      onChange={(e) => setAwsRegion(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="warehouse">
                  Warehouse {authType === 'sigv4' ? '(Account ID) *' : '(Optional)'}
                </Label>
                <Input
                  id="warehouse"
                  type="text"
                  placeholder={
                    authType === 'sigv4'
                      ? '123456789012'
                      : authType === 'oauth2'
                      ? 'my_catalog_name'
                      : 'e.g., my_warehouse'
                  }
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  required={authType === 'sigv4'}
                />
                <p className="text-xs text-muted-foreground">
                  {authType === 'sigv4' ? (
                    'Your AWS Account ID (12-digit number, required for AWS Glue)'
                  ) : (
                    <>
                      Some catalogs require a warehouse parameter.{' '}
                      <button
                        type="button"
                        onClick={() => setShowWarehouseModal(true)}
                        className="text-primary hover:underline font-medium"
                      >
                        Click here for info about warehouse names
                      </button>
                    </>
                  )}
                </p>
              </div>

              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Load Catalog'}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-muted/50 rounded-md space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <FileSearch className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>We never read Parquet files. This app only reads metadata accessible from the IRC endpoint.</p>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>This UI will not modify any data or metadata.</p>
              </div>
              <div className="flex items-start gap-2">
                <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  Tokens are encrypted -{' '}
                  <button
                    type="button"
                    onClick={() => setShowSecurityModal(true)}
                    className="text-primary hover:underline font-medium"
                  >
                    learn more about security and privacy
                  </button>
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Eye className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>This app is designed to let anyone easily explore their Iceberg catalog.</p>
              </div>
              <div className="flex items-start gap-2">
                <Heart className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500" />
                <p>Built with love using Cloudflare Workers, Claude Code, and a tiny bit of Scotch</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trademark Notice */}
        <div className="text-center mt-6 text-xs text-muted-foreground max-w-md">
          <p className="mb-1">This project is not affiliated with or endorsed by the Apache Software Foundation.</p>
          <p>
            Apache®, Apache Iceberg™, Iceberg™, and the Apache feather logo are trademarks of The Apache Software Foundation.
          </p>
        </div>
      </div>

      {/* Features Modal */}
      {showFeaturesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowFeaturesModal(false)}>
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">What Can Iceberg.rest Show You?</h2>
              <button
                onClick={() => setShowFeaturesModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Catalog Explorer */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Catalog Explorer
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground ml-6">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">Browse all namespaces and tables</span> in your catalog with a hierarchical view</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">Search and filter</span> to quickly find specific namespaces or tables</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">View table metrics at a glance</span> - see row counts, data size, and last update time</span>
                  </li>
                </ul>
              </div>

              {/* Schema Management */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Schema Management
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground ml-6">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">View current schema</span> with all field names, types, and nullability</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">Track schema evolution</span> - browse up to 10 previous schema versions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">Visual change highlighting</span> - see added, removed, and modified fields at a glance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">Side-by-side comparison</span> - view old vs. new types when fields are modified</span>
                  </li>
                </ul>
              </div>

              {/* Snapshots & History */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-primary" />
                  Snapshots & History
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground ml-6">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">View all snapshots</span> with timestamps and operation summaries</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">7-day activity chart</span> - visualize snapshot creation patterns over time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">Snapshot metadata</span> - see records added, files added, and operation types</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">Sort by newest or oldest</span> to track changes chronologically</span>
                  </li>
                </ul>
              </div>

              {/* Table Analytics */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Table Analytics
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground ml-6">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">Compaction recommendations</span> - Get an idea if compaction should be run</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">File statistics</span> - see data files, delete files, and average file sizes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">Partition strategy</span> - understand how your data is partitioned</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">File format detection</span> - see if you're using Parquet, Avro, or ORC</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">Real-time API monitoring</span> - see response times for every catalog request</span>
                  </li>
                </ul>
              </div>

              {/* Connect Tab */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Query Engine Integration
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground ml-6">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">Copy-paste connection code</span> for DuckDB, Trino, PySpark, PyIceberg, and Snowflake</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">Pre-configured with your catalog</span> - code is customized with your endpoint and table paths</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">Sample queries included</span> - get started immediately with ready-to-run examples</span>
                  </li>
                </ul>
              </div>

              {/* Table Properties */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Table Properties & Metadata
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground ml-6">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">Format version</span> - see which Iceberg format version your table uses</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">Storage location</span> - view the full path to your table's data files</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span><span className="font-semibold text-foreground">Custom properties</span> - inspect all table-level metadata and configuration</span>
                  </li>
                </ul>
              </div>

              {/* Read-Only Promise */}
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm text-green-900 flex items-start gap-2">
                  <Shield className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <span className="font-semibold">100% Read-Only:</span> This app only reads metadata from your catalog. We never modify schemas, write data, or change table configurations.
                  </span>
                </p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4">
              <Button onClick={() => setShowFeaturesModal(false)} className="w-full">
                Got it, thanks!
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Warehouse Info Modal */}
      {showWarehouseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowWarehouseModal(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Warehouse Parameter Guide</h2>
              <button
                onClick={() => setShowWarehouseModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <p className="text-sm text-muted-foreground">
                Different Iceberg catalog implementations use the warehouse parameter in different ways. Here's what to use for each catalog:
              </p>

              {/* Microsoft OneLake */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Microsoft OneLake (Fabric)
                </h3>
                <div className="space-y-2 text-sm ml-6">
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">Format:</span> <code className="bg-muted px-1 py-0.5 rounded">{'{WorkspaceID}/{DataItemID}'}</code> or <code className="bg-muted px-1 py-0.5 rounded">{'{WorkspaceName}/{DataItemName}.{DataItemType}'}</code>
                  </p>
                  <div className="bg-muted/50 p-3 rounded-md">
                    <p className="font-medium text-foreground mb-1">Examples:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                      <li><code>12345678-1234-1234-1234-123456789012/98765432-9876-9876-9876-987654321098</code></li>
                      <li><code>MyWorkspace/MyLakehouse.Lakehouse</code></li>
                      <li><code>DataEngineering/SalesData.Warehouse</code></li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Snowflake Open Catalog */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Snowflake Open Catalog (OAuth2)
                </h3>
                <div className="space-y-2 text-sm ml-6">
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">Format:</span> Your Snowflake catalog name
                  </p>
                  <div className="bg-muted/50 p-3 rounded-md">
                    <p className="font-medium text-foreground mb-1">Example:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                      <li><code>my_iceberg_catalog</code></li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Polaris / Nessie / Unity Catalog */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Polaris, Nessie, Unity Catalog (Bearer Token)
                </h3>
                <div className="space-y-2 text-sm ml-6">
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">Format:</span> Warehouse name (usually optional)
                  </p>
                  <div className="bg-muted/50 p-3 rounded-md">
                    <p className="font-medium text-foreground mb-1">Examples:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                      <li><code>my_warehouse</code></li>
                      <li><code>prod</code></li>
                      <li>Leave empty if not required by your catalog</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* R2 Data Catalog */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Cloudflare R2 Data Catalog (Bearer Token)
                </h3>
                <div className="space-y-2 text-sm ml-6">
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">Format:</span> <code className="bg-muted px-1 py-0.5 rounded">{'{account_id}_{bucket_name}'}</code>
                  </p>
                  <div className="bg-muted/50 p-3 rounded-md">
                    <p className="font-medium text-foreground mb-1">Example:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                      <li><code>a1b2c3d4e5f6g7h8_my-iceberg-bucket</code></li>
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Note: Your Cloudflare account ID followed by underscore and R2 bucket name.
                  </p>
                </div>
              </div>

              {/* Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm text-blue-900 flex items-start gap-2">
                  <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <span className="font-semibold">Not sure?</span> Check your catalog's documentation or try leaving this field empty. Most catalogs will work without a warehouse parameter.
                  </span>
                </p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4">
              <Button onClick={() => setShowWarehouseModal(false)} className="w-full">
                Got it, thanks!
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Security Modal */}
      {showSecurityModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowSecurityModal(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Security & Privacy</h2>
              <button
                onClick={() => setShowSecurityModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Token Security */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  How We Keep Your Tokens Secure
                </h3>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="bg-muted/50 p-4 rounded-md">
                    <p className="font-medium text-foreground mb-2">🔐 AES-256-GCM Encryption</p>
                    <p>All authentication tokens are encrypted using industry-standard AES-256-GCM encryption before being stored. Your tokens are never stored in plain text.</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-md">
                    <p className="font-medium text-foreground mb-2">🎫 Session-Based Authentication</p>
                    <p>Your browser only stores a session ID, not your actual token. The encrypted token remains securely on our server and is decrypted only when needed to proxy requests to your catalog.</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-md">
                    <p className="font-medium text-foreground mb-2">⏰ Automatic Expiration</p>
                    <p>Sessions automatically expire after 24 hours and are deleted from our database. You can also manually logout at any time to immediately delete your session.</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-md">
                    <p className="font-medium text-foreground mb-2">🔒 Secure Key Storage</p>
                    <p>Encryption keys are stored separately in Cloudflare KV and are never exposed to the client.</p>
                  </div>
                </div>
              </div>

              {/* Data We Collect */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  What Data We Collect
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground mb-2">✅ We Store (Non-Sensitive):</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                      <li>Page views and feature usage (e.g., "user viewed schema tab")</li>
                      <li>Country and city (from Cloudflare headers)</li>
                      <li>Browser and OS information</li>
                      <li>Catalog endpoint domain (e.g., "catalog.example.com")</li>
                      <li>API response times and success rates</li>
                      <li>Session metadata (IP address, timestamps)</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-2">❌ We Never Store:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                      <li>Plain text authentication tokens</li>
                      <li>Full catalog URLs (only domain)</li>
                      <li>Query content or table data</li>
                      <li>Parquet file contents (we never read data files)</li>
                      <li>User identifiers beyond session ID</li>
                      <li>Email addresses or personal information</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Read-Only Access */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Read-Only by Design
                </h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>This application is designed to be <span className="font-semibold text-foreground">read-only</span>. We only make GET requests to your catalog's REST API endpoints to retrieve metadata.</p>
                  <p>We <span className="font-semibold text-foreground">never</span>:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Modify table schemas or metadata</li>
                    <li>Create, update, or delete tables</li>
                    <li>Write data to your catalog</li>
                    <li>Access Parquet data files</li>
                  </ul>
                </div>
              </div>

              {/* Infrastructure */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">Powered by Cloudflare Workers:</span> This application securely runs on Cloudflare's edge network. Data is stored in Cloudflare D1 (SQLite) and KV storage with encryption at rest.
                </p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4">
              <Button onClick={() => setShowSecurityModal(false)} className="w-full">
                Got it, thanks!
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
