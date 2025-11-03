import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Folder, Table2, Search, RefreshCw, LogOut } from 'lucide-react'
import { LoadingScreen } from '@/components/catalog/LoadingScreen'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ApiMonitor } from '@/components/ApiMonitor'
import { useCatalog, type NamespaceNode } from '@/lib/context/CatalogContext'
import { getClient } from '@/lib/iceberg/client'
import { formatBytes, formatNumber } from '@/lib/iceberg/metrics'
import { cn } from '@/lib/utils/cn'

export function CatalogPage() {
  const navigate = useNavigate()
  const { namespaces, setNamespaces, isLoaded, setIsLoaded, tableMetrics, addApiCall } = useCatalog()
  const [isLoading, setIsLoading] = useState(!isLoaded)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null)
  const [loadProgress, setLoadProgress] = useState({
    current: 0,
    total: 0,
    message: 'Initializing...',
  })

  useEffect(() => {
    if (!isLoaded) {
      loadCatalogRecursively()
    } else {
      setIsLoading(false)
    }
  }, [isLoaded])

  const loadCatalogRecursively = async () => {
    try {
      const client = getClient(addApiCall)

      // Step 1: Load all namespaces
      setLoadProgress({ current: 0, total: 1, message: 'Loading namespaces...' })
      const namespacesResult = await client.listNamespaces()
      const totalNamespaces = namespacesResult.namespaces.length

      setLoadProgress({
        current: 1,
        total: totalNamespaces + 1,
        message: `Found ${totalNamespaces} namespaces`,
      })

      // Step 2: Load tables for each namespace
      const nodes: NamespaceNode[] = []

      for (let i = 0; i < namespacesResult.namespaces.length; i++) {
        const ns = namespacesResult.namespaces[i]
        const displayName = ns.join('.')

        setLoadProgress({
          current: i + 1,
          total: totalNamespaces + 1,
          message: `Loading tables from ${displayName}...`,
        })

        try {
          const tablesResult = await client.listTables(ns)
          nodes.push({
            namespace: ns,
            displayName,
            tables: tablesResult.identifiers,
            isExpanded: false,
          })
        } catch (err) {
          console.error(`Failed to load tables for ${displayName}:`, err)
          // Still add the namespace even if tables failed to load
          nodes.push({
            namespace: ns,
            displayName,
            tables: [],
            isExpanded: false,
          })
        }
      }

      setLoadProgress({
        current: totalNamespaces + 1,
        total: totalNamespaces + 1,
        message: 'Complete!',
      })

      setNamespaces(nodes)
      setIsLoaded(true)
      setIsLoading(false)
      setIsRefreshing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog')
      if (err instanceof Error && err.message.includes('Not authenticated')) {
        navigate('/')
      }
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    setIsLoaded(false)
    loadCatalogRecursively()
  }

  const handleTableClick = (namespace: string[], tableName: string) => {
    const path = `/table/${namespace.join('.')}/${tableName}`
    navigate(path)
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

  const filteredNamespaces = namespaces.filter((ns) =>
    ns.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (isLoading) {
    return <LoadingScreen progress={loadProgress} />
  }

  if (error) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex items-center justify-center h-full flex-1">
          <div className="text-red-600">Error: {error}</div>
        </div>
      </div>
    )
  }

  // Get tables for selected namespace
  const selectedNs = selectedNamespace
    ? namespaces.find(ns => ns.displayName === selectedNamespace)
    : null

  const tablesToShow = selectedNs?.tables || []

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
            className="w-3/5 h-auto mx-auto"
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
              disabled={isRefreshing}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
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
                {filteredNamespaces.map((namespace) => {
                  const isSelected = selectedNamespace === namespace.displayName
                  return (
                    <button
                      key={namespace.displayName}
                      onClick={() => setSelectedNamespace(namespace.displayName)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors',
                        isSelected
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-accent text-foreground'
                      )}
                    >
                      <Folder className={cn('h-4 w-4 flex-shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="truncate">{namespace.displayName}</span>
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

      {/* Main Content - Tables */}
      <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedNamespace ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Folder className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p>Select a namespace to view tables</p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b bg-white p-4">
                <h1 className="text-2xl font-light text-foreground">
                  {selectedNamespace}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {tablesToShow.length} {tablesToShow.length === 1 ? 'table' : 'tables'}
                </p>
              </div>

              <div className="flex-1 overflow-auto p-6 bg-accent/20">
                {tablesToShow.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No tables in this namespace
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl">
                    {tablesToShow.map((table) => {
                      const tableKey = `${selectedNamespace}.${table.name}`
                      const tableMetric = tableMetrics.get(tableKey)
                      return (
                        <button
                          key={`${table.namespace.join('.')}.${table.name}`}
                          onClick={() => handleTableClick(table.namespace, table.name)}
                          className="bg-white border rounded-lg p-4 hover:shadow-md hover:border-primary/50 transition-all text-left"
                        >
                          <div className="flex items-start gap-3 mb-3">
                            <Table2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-foreground truncate">{table.name}</div>
                            </div>
                          </div>
                          {tableMetric && (
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Rows</span>
                                <span className="font-medium">{formatNumber(tableMetric.totalRows)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Size</span>
                                <span className="font-medium">{formatBytes(tableMetric.totalSizeBytes)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Data Files</span>
                                <span className="font-medium">{formatNumber(tableMetric.totalDataFiles)}</span>
                              </div>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
      </div>
    </div>
  )
}
