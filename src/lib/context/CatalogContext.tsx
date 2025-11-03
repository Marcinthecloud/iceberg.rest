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

interface CatalogContextType {
  namespaces: NamespaceNode[]
  setNamespaces: (namespaces: NamespaceNode[]) => void
  isLoaded: boolean
  setIsLoaded: (loaded: boolean) => void
  tableMetrics: Map<string, TableMetrics>
  setTableMetric: (tableKey: string, metrics: TableMetrics) => void
  apiCalls: ApiCall[]
  addApiCall: (call: Omit<ApiCall, 'id' | 'timestamp'>) => void
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined)

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
    setApiCalls((prev) => [newCall, ...prev].slice(0, 10)) // Keep last 10 calls
  }, [])

  const value = useMemo(
    () => ({ namespaces, setNamespaces, isLoaded, setIsLoaded, tableMetrics, setTableMetric, apiCalls, addApiCall }),
    [namespaces, isLoaded, tableMetrics, apiCalls, setTableMetric, addApiCall]
  )

  return (
    <CatalogContext.Provider value={value}>
      {children}
    </CatalogContext.Provider>
  )
}

export function useCatalog() {
  const context = useContext(CatalogContext)
  if (context === undefined) {
    throw new Error('useCatalog must be used within a CatalogProvider')
  }
  return context
}
