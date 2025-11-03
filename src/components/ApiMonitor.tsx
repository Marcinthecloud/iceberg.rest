import { useState, memo } from 'react'
import { Clock, CheckCircle, XCircle, X } from 'lucide-react'
import { useCatalog } from '@/lib/context/CatalogContext'
import { cn } from '@/lib/utils/cn'

function getReadableAction(endpoint: string): string {
  // Remove UUID prefix pattern like /v1/{uuid}/
  const cleanPath = endpoint.replace(/\/v1\/[a-f0-9-]+\//, '/')

  if (cleanPath === '/v1/config') return 'Load config'
  if (cleanPath.match(/^\/namespaces$/)) return 'List namespaces'
  if (cleanPath.match(/^\/namespaces\/[^/]+$/)) return 'Get namespace'
  if (cleanPath.match(/^\/namespaces\/[^/]+\/tables$/)) return 'List tables'
  if (cleanPath.match(/^\/namespaces\/[^/]+\/tables\/[^/]+$/)) return 'Load table'

  // Fallback to cleaned path
  return cleanPath
}

const ApiMonitorComponent = () => {
  const { apiCalls } = useCatalog()
  const [isDismissed, setIsDismissed] = useState(false)

  if (apiCalls.length === 0 || isDismissed) {
    return null
  }

  const latestCall = apiCalls[0]
  const action = getReadableAction(latestCall.endpoint)

  return (
    <div className="fixed top-4 right-4 z-40 max-w-sm">
      <div
        style={{ willChange: 'opacity' }}
        className={cn(
          'bg-white border rounded-lg shadow-lg p-3 text-sm transition-opacity duration-300',
          latestCall.status === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
        )}
      >
        <div className="flex items-start gap-2">
          {latestCall.status === 'success' ? (
            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-foreground">{action}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3" />
              <span>{latestCall.duration}ms</span>
            </div>
          </div>
          <button
            onClick={() => setIsDismissed(true)}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export const ApiMonitor = memo(ApiMonitorComponent)
