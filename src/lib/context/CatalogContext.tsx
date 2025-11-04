import { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react'
import type { TableIdentifier } from '@/types/iceberg'
import type { TableMetrics } from '@/lib/iceberg/metrics'

export interface NamespaceNode {
  namespace: string[]
  displayName: string
  tables: TableIdentifier[]
  isExpanded: boolean
}

export interface ApiCall {
  id: string
  method: string
  endpoint: string
  duration: number
  timestamp: number
  status: 'success' | 'error'
}

// Split contexts to prevent unnecessary re-renders
interface CatalogDataContextType {
  namespaces: NamespaceNode[]
  setNamespaces: (namespaces: NamespaceNode[]) => void
  isLoaded: boolean
  setIsLoaded: (loaded: boolean) => void
  tableMetrics: Map<string, TableMetrics>
  setTableMetric: (tableKey: string, metrics: TableMetrics) => void
}

interface ApiMonitorContextType {
  apiCalls: ApiCall[]
  addApiCall: (call: Omit<ApiCall, 'id' | 'timestamp'>) => void
}

const CatalogDataContext = createContext<CatalogDataContextType | undefined>(undefined)
const ApiMonitorContext = createContext<ApiMonitorContextType | undefined>(undefined)

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [namespaces, setNamespaces] = useState<NamespaceNode[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [tableMetrics, setTableMetrics] = useState<Map<string, TableMetrics>>(new Map())
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([])

  const setTableMetric = useCallback((tableKey: string, metrics: TableMetrics) => {
    setTableMetrics((prev) => new Map(prev).set(tableKey, metrics))
  }, [])

  const addApiCall = useCallback((call: Omit<ApiCall, 'id' | 'timestamp'>) => {
    const newCall: ApiCall = {
      ...call,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
    }

    // Batch updates using requestAnimationFrame to reduce re-renders
    requestAnimationFrame(() => {
      setApiCalls((prev) => [newCall, ...prev].slice(0, 10)) // Keep last 10 calls
    })
  }, [])

  // Separate context values - data context only updates when catalog data changes
  const dataValue = useMemo(
    () => ({ namespaces, setNamespaces, isLoaded, setIsLoaded, tableMetrics, setTableMetric }),
    [namespaces, isLoaded, tableMetrics, setTableMetric]
  )

  // API monitor context can update frequently without affecting other components
  const apiValue = useMemo(
    () => ({ apiCalls, addApiCall }),
    [apiCalls, addApiCall]
  )

  return (
    <CatalogDataContext.Provider value={dataValue}>
      <ApiMonitorContext.Provider value={apiValue}>
        {children}
      </ApiMonitorContext.Provider>
    </CatalogDataContext.Provider>
  )
}

export function useCatalog() {
  const dataContext = useContext(CatalogDataContext)
  const apiContext = useContext(ApiMonitorContext)

  if (dataContext === undefined || apiContext === undefined) {
    throw new Error('useCatalog must be used within a CatalogProvider')
  }

  // Combine both contexts for backwards compatibility
  return { ...dataContext, ...apiContext }
}

// New hook for components that only need API monitoring (like ApiMonitor component)
export function useApiMonitor() {
  const context = useContext(ApiMonitorContext)
  if (context === undefined) {
    throw new Error('useApiMonitor must be used within a CatalogProvider')
  }
  return context
}
