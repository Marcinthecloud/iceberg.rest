import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { MainLayout } from '@/components/layout/MainLayout'
import { LoadingScreen } from '@/components/catalog/LoadingScreen'
import { useCatalog } from '@/lib/context/CatalogContext'
import { getClient } from '@/lib/iceberg/client'
import { aggregateMetrics, formatBytes, formatNumber } from '@/lib/iceberg/metrics'

function MapPageContent() {
  const navigate = useNavigate()
  const reactFlow = useReactFlow()
  const { namespaces, setNamespaces, isLoaded, setIsLoaded, tableMetrics } = useCatalog()
  const [isLoading, setIsLoading] = useState(!isLoaded)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedNamespaces, setExpandedNamespaces] = useState<Set<string>>(new Set())
  const [loadProgress, setLoadProgress] = useState({
    current: 0,
    total: 0,
    message: 'Initializing...',
  })
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[])

  useEffect(() => {
    if (!isLoaded) {
      loadCatalog()
    } else {
      buildFlowDiagram()
    }
  }, [isLoaded, namespaces, tableMetrics, expandedNamespaces])

  const toggleNamespace = useCallback((nsDisplayName: string) => {
    setExpandedNamespaces((prev) => {
      const next = new Set(prev)
      if (next.has(nsDisplayName)) {
        next.delete(nsDisplayName)
      } else {
        next.add(nsDisplayName)
      }
      return next
    })
  }, [])

  const loadCatalog = async () => {
    try {
      const client = getClient()

      setLoadProgress({ current: 0, total: 1, message: 'Loading namespaces...' })
      const namespacesResult = await client.listNamespaces()
      const totalNamespaces = namespacesResult.namespaces.length

      setLoadProgress({
        current: 1,
        total: totalNamespaces + 1,
        message: `Found ${totalNamespaces} namespaces`,
      })

      const nodes: Array<{
        namespace: string[]
        displayName: string
        tables: any[]
        isExpanded: boolean
      }> = []

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
      buildFlowDiagram()
    } catch (err) {
      console.error('Failed to load catalog:', err)
      if (err instanceof Error && err.message.includes('Not authenticated')) {
        navigate('/')
      }
      setIsLoading(false)
    }
  }

  const buildFlowDiagram = () => {
    if (namespaces.length === 0) return

    const flowNodes: Node[] = []
    const flowEdges: Edge[] = []

    // Calculate dimensions for better layout
    const namespacesPerRow = Math.min(5, namespaces.length) // Max 5 per row
    const namespaceSpacingX = 350 // More horizontal space
    const namespaceSpacingY = 300 // More vertical space between namespace levels
    const tableSpacingY = 120 // Space for tables below namespace

    // Center offset
    const startX = 100

    // Catalog root node
    flowNodes.push({
      id: 'catalog',
      type: 'input',
      data: {
        label: (
          <div className="flex items-center gap-2 px-2">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <div className="text-left">
              <div className="font-semibold text-sm">Catalog</div>
              <div className="text-xs opacity-80">{namespaces.length} namespaces</div>
            </div>
          </div>
        ),
      },
      position: { x: startX + (namespacesPerRow * namespaceSpacingX) / 2 - 100, y: 50 },
      style: {
        background: 'linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        padding: '12px 16px',
        width: 200,
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      },
    })

    // Add namespace nodes with better layout
    namespaces.forEach((ns, nsIndex) => {
      const row = Math.floor(nsIndex / namespacesPerRow)
      const col = nsIndex % namespacesPerRow
      const colsInThisRow = Math.min(namespacesPerRow, namespaces.length - row * namespacesPerRow)
      const rowOffsetX = ((namespacesPerRow - colsInThisRow) * namespaceSpacingX) / 2

      const nsId = `ns-${ns.displayName}`
      const nsX = startX + col * namespaceSpacingX + rowOffsetX
      const nsY = 200 + row * (namespaceSpacingY + tableSpacingY)

      // Calculate namespace metrics
      const tableMetricsList = ns.tables.map((table) => {
        const tableKey = `${ns.displayName}.${table.name}`
        return tableMetrics.get(tableKey) || null
      })
      const nsMetrics = aggregateMetrics(tableMetricsList)
      const hasMetrics = tableMetricsList.some((m) => m !== null)
      const isExpanded = expandedNamespaces.has(ns.displayName)

      flowNodes.push({
        id: nsId,
        data: {
          label: (
            <div className="flex items-center gap-2 px-2 cursor-pointer">
              {/* Expand/collapse indicator */}
              <svg
                className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <svg className="h-4 w-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
              <div className="text-left flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{ns.displayName}</div>
                <div className="text-xs text-gray-500">
                  {ns.tables.length} {ns.tables.length === 1 ? 'table' : 'tables'} {isExpanded && '(expanded)'}
                </div>
                {hasMetrics && (
                  <div className="text-xs text-gray-600 mt-0.5 truncate">
                    {formatNumber(nsMetrics.totalRows)} rows · {formatBytes(nsMetrics.totalSizeBytes)}
                  </div>
                )}
              </div>
            </div>
          ),
        },
        position: { x: nsX, y: nsY },
        style: {
          background: 'white',
          border: `2px solid ${isExpanded ? '#7B6BAA' : '#5B4B8A'}`,
          borderRadius: '8px',
          padding: '10px 12px',
          width: 280,
          boxShadow: isExpanded ? '0 4px 8px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
          cursor: 'pointer',
        },
      })

      // Edge from catalog to namespace
      flowEdges.push({
        id: `catalog-${nsId}`,
        source: 'catalog',
        target: nsId,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#5B4B8A', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#5B4B8A',
        },
      })

      // Only add table nodes if namespace is expanded
      if (isExpanded) {
        const maxTablesToShow = 4 // Show 4 tables per namespace
        const tablesToShow = ns.tables.slice(0, maxTablesToShow)
        const tableWidth = 140
        const tableGap = 20

        tablesToShow.forEach((table, tableIndex) => {
        const tableId = `table-${ns.displayName}-${table.name}`
        const tableX = nsX + (tableIndex - (tablesToShow.length - 1) / 2) * (tableWidth + tableGap)
        const tableY = nsY + 100

        const tableKey = `${ns.displayName}.${table.name}`
        const tableMetric = tableMetrics.get(tableKey)

        flowNodes.push({
          id: tableId,
          type: 'output',
          data: {
            label: (
              <div className="flex flex-col gap-1 px-2 py-1">
                <div className="flex items-center gap-1.5">
                  <svg className="h-3 w-3 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="text-xs font-medium truncate">{table.name}</div>
                </div>
                {tableMetric && (
                  <div className="text-xs text-gray-500 truncate pl-4">
                    {formatNumber(tableMetric.totalRows)} rows
                  </div>
                )}
              </div>
            ),
          },
          position: { x: tableX, y: tableY },
          style: {
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
            border: '1.5px solid #dee2e6',
            borderRadius: '6px',
            padding: tableMetric ? '6px 8px' : '8px 10px',
            width: tableWidth,
            cursor: 'pointer',
            transition: 'all 0.2s',
          },
        })

        flowEdges.push({
          id: `${nsId}-${tableId}`,
          source: nsId,
          target: tableId,
          type: 'smoothstep',
          style: { stroke: '#999', strokeWidth: 1 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#999',
          },
        })
      })

      // Add "..." node if there are more tables
      if (ns.tables.length > maxTablesToShow) {
        const moreId = `more-${ns.displayName}`
        const moreX = nsX + (maxTablesToShow * (tableWidth + tableGap)) / 2
        const moreY = nsY + 100

        flowNodes.push({
          id: moreId,
          data: {
            label: (
              <div className="text-xs text-gray-600 font-medium">
                +{ns.tables.length - maxTablesToShow} more
              </div>
            ),
          },
          position: { x: moreX, y: moreY },
          style: {
            background: 'white',
            border: '1.5px dashed #adb5bd',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '11px',
          },
        })

        flowEdges.push({
          id: `${nsId}-${moreId}`,
          source: nsId,
          target: moreId,
          type: 'smoothstep',
          style: { stroke: '#dee2e6', strokeWidth: 1.5, strokeDasharray: '5,5' },
        })
        }
      } // End of if (isExpanded)
    })

    setNodes(flowNodes)
    setEdges(flowEdges)

    // Zoom to fit after a short delay to allow layout to settle
    setTimeout(() => {
      reactFlow.fitView({ padding: 0.2, duration: 400 })
    }, 50)
  }

  // Filter and zoom on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      // No search - rebuild without filter
      buildFlowDiagram()
      return
    }

    const query = searchQuery.toLowerCase()

    // Find matching namespaces and tables
    const matchingNamespaces = new Set<string>()
    namespaces.forEach((ns) => {
      if (ns.displayName.toLowerCase().includes(query)) {
        matchingNamespaces.add(ns.displayName)
      } else {
        // Check if any tables match
        const hasMatchingTable = ns.tables.some((table) =>
          table.name.toLowerCase().includes(query)
        )
        if (hasMatchingTable) {
          matchingNamespaces.add(ns.displayName)
        }
      }
    })

    // Auto-expand matching namespaces
    setExpandedNamespaces(new Set(matchingNamespaces))

    // Wait for diagram to rebuild, then zoom to fit
    setTimeout(() => {
      reactFlow.fitView({ padding: 0.3, duration: 600, maxZoom: 1.5 })
    }, 100)
  }, [searchQuery])

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.id.startsWith('ns-')) {
        // Toggle namespace expansion
        const nsDisplayName = node.id.replace('ns-', '')
        toggleNamespace(nsDisplayName)
      } else if (node.id.startsWith('table-')) {
        // Extract namespace and table name from the node id
        const parts = node.id.replace('table-', '').split('-')
        const tableName = parts[parts.length - 1]
        const namespace = parts.slice(0, -1).join('.')
        navigate(`/table/${namespace}/${tableName}`)
      }
    },
    [navigate, toggleNamespace]
  )

  if (isLoading) {
    return <LoadingScreen progress={loadProgress} />
  }

  return (
    <MainLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b bg-white p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-2xl font-light text-foreground">Catalog Map</h1>
                <p className="text-sm text-muted-foreground">
                  Visual overview of your Iceberg catalog structure
                </p>
              </div>
            </div>
            {/* Search Bar */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search namespaces and tables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Flow Diagram */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            attributionPosition="bottom-left"
          >
            <Background />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                if (node.id === 'catalog') return '#5B4B8A'
                if (node.id.startsWith('ns-')) return '#fff'
                return '#f0f0f0'
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
          </ReactFlow>
        </div>
      </div>
    </MainLayout>
  )
}

export function MapPage() {
  return (
    <ReactFlowProvider>
      <MapPageContent />
    </ReactFlowProvider>
  )
}
