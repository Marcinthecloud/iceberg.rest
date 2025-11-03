import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Database, FileText, GitBranch, Info, BarChart3, AlertCircle, CheckCircle, Folder, ChevronRight, LogOut, Search, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { ConnectTab } from '@/components/table/ConnectTab'
import { ApiMonitor } from '@/components/ApiMonitor'
import { getClient } from '@/lib/iceberg/client'
import {
  extractTableMetrics,
  formatBytes,
  formatNumber,
  formatDate,
  formatRelativeTime,
  getPartitionStrategy,
  getFileFormat,
  isCompactionSnapshot,
  needsCompaction,
  getLastCompaction,
  getAverageFileSize,
} from '@/lib/iceberg/metrics'
import { useCatalog } from '@/lib/context/CatalogContext'
import { cn } from '@/lib/utils/cn'
import type { LoadTableResult } from '@/types/iceberg'

export function TablePage() {
  const { namespace, table } = useParams<{ namespace: string; table: string }>()
  const navigate = useNavigate()
  const { setTableMetric, namespaces, setIsLoaded, addApiCall } = useCatalog()
  const [tableData, setTableData] = useState<LoadTableResult | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'schema' | 'snapshots' | 'properties' | 'connect'>('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [snapshotSortOrder, setSnapshotSortOrder] = useState<'desc' | 'asc'>('desc')
  const [hoveredBar, setHoveredBar] = useState<{ date: string; count: number; x: number; y: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSchemaId, setSelectedSchemaId] = useState<number | null>(null)


  useEffect(() => {
    if (namespace && table) {
      loadTable()
    }
  }, [namespace, table])

  const loadTable = async () => {
    if (!namespace || !table) return

    try {
      const client = getClient(addApiCall)
      const namespaceArray = namespace.split('.')
      const result = await client.loadTable(namespaceArray, table)
      setTableData(result)

      // Extract and cache metrics
      const metrics = extractTableMetrics(result.metadata)
      if (metrics) {
        const tableKey = `${namespace}.${table}`
        setTableMetric(tableKey, metrics)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table')
    } finally {
      setIsLoading(false)
    }
  }

  const formatTimestamp = (ms: number): string => {
    return new Date(ms).toLocaleString()
  }

  const handleLogout = async () => {
    const sessionId = sessionStorage.getItem('iceberg-session-id')

    try {
      // Call logout endpoint to delete session
      if (sessionId) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'X-Session-ID': sessionId,
          },
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      sessionStorage.clear()
      navigate('/')
    }
  }

  const handleRefresh = () => {
    setIsLoaded(false)
    navigate('/catalog')
  }

  const handleNamespaceClick = () => {
    navigate('/catalog')
  }

  // Compare two schemas to detect changes
  const compareSchemas = (oldSchema: any, newSchema: any) => {
    const changes = {
      added: [] as any[],
      removed: [] as any[],
      modified: [] as any[],
    }

    const oldFields = new Map(oldSchema.fields.map((f: any) => [f.id, f]))
    const newFields = new Map(newSchema.fields.map((f: any) => [f.id, f]))

    // Find added fields
    newFields.forEach((field: any, id) => {
      if (!oldFields.has(id)) {
        changes.added.push(field)
      }
    })

    // Find removed fields
    oldFields.forEach((field: any, id) => {
      if (!newFields.has(id)) {
        changes.removed.push(field)
      }
    })

    // Find modified fields (type or required changed)
    newFields.forEach((newField: any, id) => {
      const oldField: any = oldFields.get(id)
      if (oldField) {
        const typeChanged = JSON.stringify(oldField.type) !== JSON.stringify(newField.type)
        const requiredChanged = oldField.required !== newField.required
        if (typeChanged || requiredChanged) {
          changes.modified.push({
            field: newField,
            oldType: oldField.type,
            oldRequired: oldField.required,
            typeChanged,
            requiredChanged,
          })
        }
      }
    })

    return changes
  }

  const groupSnapshotsByDay = (snapshots: typeof metadata.snapshots, days: number = 7) => {
    if (!snapshots || snapshots.length === 0) return []

    // Find the most recent snapshot timestamp
    const maxTimestamp = Math.max(...snapshots.map(s => s['timestamp-ms']))
    const endDate = new Date(maxTimestamp)

    // Calculate start date as N-1 days before end date (to include end date)
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - (days - 1))
    startDate.setHours(0, 0, 0, 0)

    // Initialize all days with 0
    const dailyData: { date: string; count: number }[] = []
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0]
      dailyData.push({ date: dateKey, count: 0 })
    }

    // Count snapshots per day
    snapshots.forEach(snapshot => {
      const date = new Date(snapshot['timestamp-ms'])
      if (date >= startDate && date <= endDate) {
        const dateKey = date.toISOString().split('T')[0]
        const dayData = dailyData.find(d => d.date === dateKey)
        if (dayData) dayData.count++
      }
    })

    return dailyData
  }


  const filteredNamespaces = namespaces.filter((ns) =>
    ns.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex items-center justify-center h-full flex-1">
          <div className="text-muted-foreground">Loading table...</div>
        </div>
      </div>
    )
  }

  if (error || !tableData) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex items-center justify-center h-full flex-1">
          <div className="text-red-600">Error: {error || 'Table not found'}</div>
        </div>
      </div>
    )
  }

  const metadata = tableData.metadata
  const currentSchema = metadata.schemas.find((s) => s['schema-id'] === metadata['current-schema-id'])
  const currentSnapshot = metadata.snapshots?.find(
    (s) => s['snapshot-id'] === metadata['current-snapshot-id']
  )
  const tableMetrics = extractTableMetrics(metadata)
  const compactionNeeded = needsCompaction(metadata)
  const lastCompaction = getLastCompaction(metadata)
  const isLastOpCompaction = isCompactionSnapshot(metadata)

  // Get selected schema or default to current
  const displayedSchemaId = selectedSchemaId ?? metadata['current-schema-id']
  const displayedSchema = metadata.schemas.find((s) => s['schema-id'] === displayedSchemaId)

  // Find previous schema for comparison
  const schemaIndex = metadata.schemas.findIndex((s) => s['schema-id'] === displayedSchemaId)
  const previousSchema = schemaIndex > 0 ? metadata.schemas[schemaIndex - 1] : null
  const schemaChanges = previousSchema && displayedSchema ? compareSchemas(previousSchema, displayedSchema) : null

  return (
    <div className="flex h-screen bg-background">
      <ApiMonitor />
      {/* Left Sidebar - Logo, Namespaces Explorer, Logout */}
      <div className="w-64 border-r bg-white flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b">
          <img
            src="/logo.png"
            alt="Iceberg.rest Logo"
            className="w-3/5 h-auto mx-auto cursor-pointer"
            onClick={() => navigate('/catalog')}
          />
        </div>

        {/* Explorer Header */}
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center justify-between">
            EXPLORER
            <Button
              onClick={handleRefresh}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </h2>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 h-8 text-sm"
            />
          </div>
        </div>

        {/* Namespaces List */}
        <div className="flex-1 overflow-auto">
          <div className="p-2">
            <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">Namespaces</div>
            {filteredNamespaces.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {searchQuery ? 'No namespaces found' : 'No namespaces'}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredNamespaces.map((ns) => {
                  const isSelected = namespace === ns.displayName
                  return (
                    <button
                      key={ns.displayName}
                      onClick={handleNamespaceClick}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors',
                        isSelected
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-accent text-foreground'
                      )}
                    >
                      <Folder className={cn('h-4 w-4 flex-shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="truncate">{ns.displayName}</span>
                      <ChevronRight className="h-3 w-3 ml-auto flex-shrink-0 text-muted-foreground" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Logout Button */}
        <div className="p-4 border-t">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b bg-white p-4">
          <div className="max-w-7xl mx-auto">
            <Button variant="ghost" onClick={() => navigate('/catalog')} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Catalog
            </Button>

            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Database className="h-4 w-4" />
                  <span>{namespace}</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-foreground font-medium">{table}</span>
                </div>
                <h1 className="text-2xl font-semibold text-foreground">{namespace}.{table}</h1>
              </div>
            </div>

            {/* Stat Cards */}
            {tableMetrics && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="border rounded-lg p-4 bg-white">
                  <div className="text-xs font-medium text-muted-foreground mb-1">TOTAL ROWS</div>
                  <div className="text-2xl font-semibold">{formatNumber(tableMetrics.totalRows)}</div>
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <div className="text-xs font-medium text-muted-foreground mb-1">TOTAL SIZE</div>
                  <div className="text-2xl font-semibold">{formatBytes(tableMetrics.totalSizeBytes)}</div>
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <div className="text-xs font-medium text-muted-foreground mb-1">LAST COMMIT</div>
                  <div className="text-2xl font-semibold">{formatRelativeTime(tableMetrics.lastUpdatedMs)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{formatDate(tableMetrics.lastUpdatedMs)}</div>
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <div className="text-xs font-medium text-muted-foreground mb-1">SNAPSHOTS</div>
                  <div className="text-2xl font-semibold">{tableMetrics.snapshotCount}</div>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-4 border-b">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'schema', label: 'Schema' },
                { id: 'snapshots', label: 'Snapshots' },
                { id: 'connect', label: 'Connect' },
                { id: 'properties', label: 'Properties' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    'px-4 py-2 font-medium text-sm transition-colors border-b-2',
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-light flex items-center gap-2">
                      <Info className="h-5 w-5" />
                      Table Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Format Version</div>
                      <div className="font-medium">{metadata['format-version']}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Location</div>
                      <div className="font-mono text-sm break-all">{metadata.location}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Last Updated</div>
                      <div className="font-medium">{formatTimestamp(metadata['last-updated-ms'])}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Partition Strategy</div>
                      <div className="font-medium text-sm">{getPartitionStrategy(metadata)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">File Format</div>
                      <div className="font-medium">{getFileFormat(metadata)}</div>
                    </div>
                  </CardContent>
                </Card>

                {tableMetrics && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg font-light flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Table Metrics
                      </CardTitle>
                      <CardDescription>Statistics from current snapshot</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Total Rows</div>
                        <div className="font-semibold text-lg">{formatNumber(tableMetrics.totalRows)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Total Size</div>
                        <div className="font-semibold text-lg">{formatBytes(tableMetrics.totalSizeBytes)}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-sm text-muted-foreground">Data Files</div>
                          <div className="font-medium">{formatNumber(tableMetrics.totalDataFiles)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Delete Files</div>
                          <div className="font-medium">{formatNumber(tableMetrics.totalDeleteFiles)}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Snapshots</div>
                        <div className="font-medium">{tableMetrics.snapshotCount} total</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Last Modified</div>
                        <div className="font-medium">{formatRelativeTime(tableMetrics.lastUpdatedMs)}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(tableMetrics.lastUpdatedMs)}</div>
                      </div>
                      {tableMetrics.operation && (
                        <div>
                          <div className="text-sm text-muted-foreground">Last Operation</div>
                          <div className="font-medium capitalize">{tableMetrics.operation}</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card className={cn(
                  'border-2',
                  tableMetrics && tableMetrics.totalRows > 0 && tableMetrics.totalSizeBytes > 0 ? (
                    compactionNeeded.insufficientData ? 'border-gray-200 bg-gray-50/50' :
                    compactionNeeded.needsCompaction && compactionNeeded.severity === 'high' ? 'border-red-200 bg-red-50/50' :
                    compactionNeeded.needsCompaction && compactionNeeded.severity === 'medium' ? 'border-yellow-200 bg-yellow-50/50' :
                    compactionNeeded.needsCompaction ? 'border-orange-200 bg-orange-50/50' :
                    'border-green-200 bg-green-50/50'
                  ) : 'border-gray-200 bg-gray-50/50'
                )}>
                  <CardHeader>
                    <CardTitle className="text-lg font-light flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Compaction Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!tableMetrics || tableMetrics.totalRows === 0 || tableMetrics.totalSizeBytes === 0 ? (
                      <div className="flex items-start gap-2 p-3 rounded-md bg-gray-100 text-gray-700">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-sm">Metrics Not Available</div>
                          <div className="text-sm mt-1">
                            Cannot compute compaction recommendations without row counts and size metrics.
                            Ensure your writes are properly tracking metrics in snapshot summaries.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {isLastOpCompaction && (
                          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-100 px-3 py-2 rounded-md">
                            <CheckCircle className="h-4 w-4" />
                            <span className="font-medium">Last operation was compaction</span>
                          </div>
                        )}

                        {lastCompaction && (
                          <div>
                            <div className="text-sm text-muted-foreground">Last Compacted</div>
                            <div className="font-medium">{formatRelativeTime(lastCompaction)}</div>
                            <div className="text-xs text-muted-foreground">{formatDate(lastCompaction)}</div>
                          </div>
                        )}

                        <div>
                          <div className="text-sm text-muted-foreground">Average File Size</div>
                          <div className="font-medium">{formatBytes(getAverageFileSize(tableMetrics))}</div>
                        </div>

                        {compactionNeeded.insufficientData ? (
                          <div className="flex items-start gap-2 p-3 rounded-md bg-gray-100 text-gray-700">
                            <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
                            <div>
                              <div className="font-semibold text-sm">Table Too Small for Analysis</div>
                              <div className="text-sm mt-1">{compactionNeeded.reason}</div>
                            </div>
                          </div>
                        ) : compactionNeeded.needsCompaction ? (
                          <div className={cn(
                            'flex items-start gap-2 p-3 rounded-md',
                            compactionNeeded.severity === 'high' ? 'bg-red-100 text-red-800' :
                            compactionNeeded.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-orange-100 text-orange-800'
                          )}>
                            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                            <div>
                              <div className="font-semibold text-sm">Compaction Recommended</div>
                              <div className="text-sm mt-1">{compactionNeeded.reason}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 p-3 rounded-md bg-green-100 text-green-800">
                            <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                            <div>
                              <div className="font-semibold text-sm">Table is well optimized</div>
                              <div className="text-sm mt-1">
                                File sizes and counts are within optimal ranges.
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-light flex items-center gap-2">
                      <GitBranch className="h-5 w-5" />
                      Current Snapshot
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {currentSnapshot ? (
                      <>
                        <div>
                          <div className="text-sm text-muted-foreground">Snapshot ID</div>
                          <div className="font-medium">{currentSnapshot['snapshot-id']}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Timestamp</div>
                          <div className="font-medium">
                            {formatTimestamp(currentSnapshot['timestamp-ms'])}
                          </div>
                        </div>
                        {currentSnapshot.summary && (
                          <div>
                            <div className="text-sm text-muted-foreground">Added Records</div>
                            <div className="font-medium">
                              {currentSnapshot.summary['added-records'] || 'N/A'}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-muted-foreground">No current snapshot</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-light flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Schema
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Current Schema ID</div>
                      <div className="font-medium">{metadata['current-schema-id']}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Total Schemas</div>
                      <div className="font-medium">{metadata.schemas.length}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Fields</div>
                      <div className="font-medium">{currentSchema?.fields.length || 0}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-light flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      History
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Total Snapshots</div>
                      <div className="font-medium">{metadata.snapshots?.length || 0}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Partition Specs</div>
                      <div className="font-medium">{metadata['partition-specs'].length}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'schema' && displayedSchema && (
              <div className="space-y-4">
                {/* Schema Version Selector */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="font-light">Schema Evolution</CardTitle>
                        <CardDescription>
                          {metadata.schemas.length} version{metadata.schemas.length !== 1 ? 's' : ''} available
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-muted-foreground">Version:</label>
                        <select
                          value={displayedSchemaId}
                          onChange={(e) => setSelectedSchemaId(Number(e.target.value))}
                          className="border rounded px-3 py-1.5 text-sm"
                        >
                          {[...metadata.schemas]
                            .sort((a, b) => b['schema-id'] - a['schema-id'])
                            .slice(0, 10)
                            .map((schema) => (
                              <option key={schema['schema-id']} value={schema['schema-id']}>
                                Schema {schema['schema-id']}
                                {schema['schema-id'] === metadata['current-schema-id'] ? ' (Current)' : ''}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {schemaChanges && (schemaChanges.added.length > 0 || schemaChanges.removed.length > 0 || schemaChanges.modified.length > 0) ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 text-sm">
                          {schemaChanges.added.length > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="w-3 h-3 rounded-full bg-green-500"></span>
                              <span className="text-muted-foreground">{schemaChanges.added.length} added</span>
                            </div>
                          )}
                          {schemaChanges.removed.length > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="w-3 h-3 rounded-full bg-red-500"></span>
                              <span className="text-muted-foreground">{schemaChanges.removed.length} removed</span>
                            </div>
                          )}
                          {schemaChanges.modified.length > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                              <span className="text-muted-foreground">{schemaChanges.modified.length} modified</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Changes from Schema {previousSchema?.['schema-id']} → Schema {displayedSchemaId}
                        </p>
                      </div>
                    ) : schemaIndex > 0 ? (
                      <p className="text-sm text-muted-foreground">No changes from previous version</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">This is the first schema version</p>
                    )}
                  </CardContent>
                </Card>

                {/* Schema Fields Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="font-light">Schema Fields (ID: {displayedSchema['schema-id']})</CardTitle>
                    <CardDescription>{displayedSchema.fields.length} fields</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b">
                          <tr className="text-left">
                            <th className="py-2 px-4 font-medium">ID</th>
                            <th className="py-2 px-4 font-medium">Name</th>
                            <th className="py-2 px-4 font-medium">Type</th>
                            <th className="py-2 px-4 font-medium">Required</th>
                            <th className="py-2 px-4 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedSchema.fields.map((field) => {
                            const isAdded = schemaChanges?.added.some(f => f.id === field.id)
                            const isRemoved = schemaChanges?.removed.some(f => f.id === field.id)
                            const modification = schemaChanges?.modified.find(m => m.field.id === field.id)

                            return (
                              <tr
                                key={field.id}
                                className={cn(
                                  'border-b last:border-b-0',
                                  isAdded && 'bg-green-50',
                                  isRemoved && 'bg-red-50',
                                  modification && 'bg-yellow-50'
                                )}
                              >
                                <td className="py-2 px-4 text-muted-foreground">{field.id}</td>
                                <td className="py-2 px-4 font-medium">{field.name}</td>
                                <td className="py-2 px-4 font-mono text-xs">
                                  {modification && modification.typeChanged ? (
                                    <div className="space-y-1">
                                      <div className="text-red-600 line-through">
                                        {typeof modification.oldType === 'string' ? modification.oldType : JSON.stringify(modification.oldType)}
                                      </div>
                                      <div className="text-green-600">
                                        {typeof field.type === 'string' ? field.type : JSON.stringify(field.type)}
                                      </div>
                                    </div>
                                  ) : (
                                    typeof field.type === 'string' ? field.type : JSON.stringify(field.type)
                                  )}
                                </td>
                                <td className="py-2 px-4">
                                  {modification && modification.requiredChanged ? (
                                    <div className="space-y-1">
                                      <div className="text-red-600 line-through text-xs">
                                        {modification.oldRequired ? 'Yes' : 'No'}
                                      </div>
                                      <div className="text-green-600 text-xs">
                                        {field.required ? 'Yes' : 'No'}
                                      </div>
                                    </div>
                                  ) : field.required ? (
                                    <span className="text-green-600">Yes</span>
                                  ) : (
                                    <span className="text-muted-foreground">No</span>
                                  )}
                                </td>
                                <td className="py-2 px-4">
                                  {isAdded && (
                                    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                      Added
                                    </span>
                                  )}
                                  {isRemoved && (
                                    <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                      Removed
                                    </span>
                                  )}
                                  {modification && (
                                    <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                                      <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                      Modified
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'snapshots' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="font-light">Snapshot History</CardTitle>
                      <CardDescription>
                        {metadata.snapshots?.length || 0} snapshots
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSnapshotSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      {snapshotSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {metadata.snapshots && metadata.snapshots.length > 0 ? (
                    <div className="space-y-6">
                      {/* Time Series Chart - Last 7 Days */}
                      {(() => {
                        const dailyData = groupSnapshotsByDay(metadata.snapshots, 7)
                        if (dailyData.length === 0) return null

                        const maxCount = Math.max(...dailyData.map(d => d.count), 1)
                        const chartHeight = 200
                        const yAxisWidth = 60
                        const chartWidth = 700
                        const barWidth = chartWidth / dailyData.length
                        const topPadding = 15

                        // Calculate Y-axis ticks
                        const yTicks = maxCount <= 5
                          ? Array.from({ length: maxCount + 1 }, (_, i) => i)
                          : [0, Math.ceil(maxCount / 4), Math.ceil(maxCount / 2), Math.ceil((3 * maxCount) / 4), maxCount]

                        return (
                          <div className="border rounded-lg p-6 bg-white">
                            <div className="text-sm font-medium mb-4">Snapshot Activity (Last 7 Days)</div>
                            <div className="overflow-x-auto">
                              <svg
                                width={yAxisWidth + chartWidth + 10}
                                height={chartHeight + 40 + topPadding}
                                className="mx-auto"
                                onMouseLeave={() => setHoveredBar(null)}
                              >
                                <g transform={`translate(0, ${topPadding})`}>
                                {/* Y-axis */}
                                <g>
                                  <line
                                    x1={yAxisWidth}
                                    y1={0}
                                    x2={yAxisWidth}
                                    y2={chartHeight}
                                    stroke="#ddd"
                                    strokeWidth="1"
                                  />
                                  {yTicks.map((tick) => {
                                    const tickY = chartHeight - (tick / maxCount) * chartHeight
                                    return (
                                      <g key={tick}>
                                        <line
                                          x1={yAxisWidth - 4}
                                          y1={tickY}
                                          x2={yAxisWidth}
                                          y2={tickY}
                                          stroke="#ddd"
                                          strokeWidth="1"
                                        />
                                        <text
                                          x={yAxisWidth - 8}
                                          y={tickY}
                                          textAnchor="end"
                                          alignmentBaseline="middle"
                                          fontSize="10"
                                          fill="#666"
                                        >
                                          {tick}
                                        </text>
                                      </g>
                                    )
                                  })}
                                </g>

                                {/* Bars */}
                                {dailyData.map((item, index) => {
                                  const barHeight = maxCount > 0 ? (item.count / maxCount) * chartHeight : 0
                                  const x = yAxisWidth + index * barWidth
                                  const y = chartHeight - barHeight

                                  return (
                                    <g
                                      key={item.date}
                                      style={{ cursor: 'pointer' }}
                                      onMouseEnter={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect()
                                        setHoveredBar({
                                          date: item.date,
                                          count: item.count,
                                          x: rect.left + rect.width / 2,
                                          y: rect.top
                                        })
                                      }}
                                      onMouseLeave={() => setHoveredBar(null)}
                                    >
                                      <rect
                                        x={x + 4}
                                        y={y}
                                        width={barWidth - 8}
                                        height={Math.max(barHeight, 2)}
                                        fill="#5B4B8A"
                                        rx="2"
                                        className="hover:opacity-80 transition-opacity"
                                      />
                                      <text
                                        x={x + barWidth / 2}
                                        y={chartHeight + 15}
                                        textAnchor="middle"
                                        fontSize="10"
                                        fill="#999"
                                        style={{ pointerEvents: 'none' }}
                                      >
                                        {new Date(item.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                                      </text>
                                    </g>
                                  )
                                })}
                                </g>
                              </svg>

                              {/* Custom Tooltip */}
                              {hoveredBar && (
                                <div
                                  className="fixed z-50 bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg pointer-events-none"
                                  style={{
                                    left: `${hoveredBar.x}px`,
                                    top: `${hoveredBar.y - 40}px`,
                                    transform: 'translateX(-50%)',
                                  }}
                                >
                                  <div className="font-medium">
                                    {new Date(hoveredBar.date).toLocaleDateString('en-US', {
                                      weekday: 'short',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </div>
                                  <div className="text-gray-300">
                                    {hoveredBar.count} snapshot{hoveredBar.count !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}

                      {/* Snapshot List */}
                      {[...metadata.snapshots]
                        .sort((a, b) => {
                          const diff = b['timestamp-ms'] - a['timestamp-ms']
                          return snapshotSortOrder === 'desc' ? diff : -diff
                        })
                        .map((snapshot) => {
                          const snapshotId = snapshot['snapshot-id']

                          return (
                            <div
                              key={snapshotId}
                              className="border rounded-lg p-4 transition-colors"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="font-medium">
                                    Snapshot {snapshotId}
                                    {snapshotId === metadata['current-snapshot-id'] && (
                                      <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                                        Current
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {formatTimestamp(snapshot['timestamp-ms'])}
                                  </div>
                                </div>
                              </div>

                              {snapshot.summary && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-sm">
                                  {Object.entries(snapshot.summary).map(([key, value]) => (
                                    <div key={key}>
                                      <div className="text-muted-foreground text-xs">{key}</div>
                                      <div className="font-medium">{value}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No snapshots available
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'connect' && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-light">Connect to Table</CardTitle>
                  <CardDescription>
                    Copy connection code for your preferred query engine
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ConnectTab
                    namespace={namespace!}
                    table={table!}
                    catalogUrl={sessionStorage.getItem('iceberg-endpoint') || ''}
                    warehouse={sessionStorage.getItem('iceberg-warehouse') || undefined}
                    authType={(sessionStorage.getItem('iceberg-auth-type') as 'bearer' | 'oauth2' | 'sigv4') || 'bearer'}
                    awsRegion={sessionStorage.getItem('iceberg-aws-region') || undefined}
                  />
                </CardContent>
              </Card>
            )}

            {activeTab === 'properties' && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-light">Table Properties</CardTitle>
                </CardHeader>
                <CardContent>
                  {metadata.properties && Object.keys(metadata.properties).length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b">
                          <tr className="text-left">
                            <th className="py-2 px-4 font-medium">Property</th>
                            <th className="py-2 px-4 font-medium">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(metadata.properties).map(([key, value]) => (
                            <tr key={key} className="border-b last:border-b-0">
                              <td className="py-2 px-4 font-medium">{key}</td>
                              <td className="py-2 px-4 font-mono text-xs break-all">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No properties defined
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
