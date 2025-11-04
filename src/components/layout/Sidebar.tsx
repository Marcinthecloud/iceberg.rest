import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Folder, Search, RefreshCw, LogOut, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useCatalog } from '@/lib/context/CatalogContext'
import { cn } from '@/lib/utils/cn'

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { namespaces, setIsLoaded } = useCatalog()
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Get current namespace from URL
  const getCurrentNamespace = () => {
    // Check if we're on a table page
    const tableMatch = location.pathname.match(/^\/table\/([^/]+)\//)
    if (tableMatch) {
      return tableMatch[1]
    }
    // Check if we're on catalog page with namespace param
    const params = new URLSearchParams(location.search)
    return params.get('namespace')
  }

  const currentNamespace = getCurrentNamespace()

  const handleRefresh = () => {
    setIsRefreshing(true)
    setIsLoaded(false)
    // If on table page, navigate to catalog with namespace
    if (location.pathname.startsWith('/table/')) {
      const namespace = getCurrentNamespace()
      navigate(namespace ? `/catalog?namespace=${namespace}` : '/catalog')
    }
    // CatalogPage will handle the actual refresh
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const handleNamespaceClick = (namespace: string) => {
    navigate(`/catalog?namespace=${namespace}`)
  }

  const handleLogout = async () => {
    const sessionId = sessionStorage.getItem('iceberg-session-id')

    try {
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

  return (
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
                const isSelected = currentNamespace === namespace.displayName
                return (
                  <button
                    key={namespace.displayName}
                    onClick={() => handleNamespaceClick(namespace.displayName)}
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
  )
}
