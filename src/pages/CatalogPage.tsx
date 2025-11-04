import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Folder, Table2 } from 'lucide-react'
import { LoadingScreen } from '@/components/catalog/LoadingScreen'
import { useCatalog, type NamespaceNode } from '@/lib/context/CatalogContext'
import { getClient } from '@/lib/iceberg/client'
import { formatBytes, formatNumber } from '@/lib/iceberg/metrics'

export function CatalogPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { namespaces, setNamespaces, isLoaded, setIsLoaded, tableMetrics, addApiCall } = useCatalog()
  const [isLoading, setIsLoading] = useState(!isLoaded)
  const [error, setError] = useState('')

  // Get selected namespace from URL
  const selectedNamespace = searchParams.get('namespace')

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog')
      if (err instanceof Error && err.message.includes('Not authenticated')) {
        navigate('/')
      }
      setIsLoading(false)
    }
  }

  const handleTableClick = (namespace: string[], tableName: string) => {
    const path = `/table/${namespace.join('.')}/${tableName}`
    navigate(path)
  }

  if (isLoading) {
    return <LoadingScreen progress={loadProgress} />
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-600">Error: {error}</div>
      </div>
    )
  }

  // Get tables for selected namespace
  const selectedNs = selectedNamespace
    ? namespaces.find(ns => ns.displayName === selectedNamespace)
    : null

  const tablesToShow = selectedNs?.tables || []

  return (
    <div className="flex flex-col h-full overflow-hidden">
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
  )
}
