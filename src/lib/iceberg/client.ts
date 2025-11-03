import type {
  IcebergConfig,
  Namespace,
  TableIdentifier,
  LoadTableResult,
} from '@/types/iceberg'

type ApiCallCallback = (call: { method: string; endpoint: string; duration: number; status: 'success' | 'error' }) => void

export class IcebergClient {
  private sessionId: string
  private prefix?: string
  private warehouse?: string
  private configPromise?: Promise<void>
  private onApiCall?: ApiCallCallback

  constructor(sessionId: string, warehouse?: string, onApiCall?: ApiCallCallback) {
    this.sessionId = sessionId
    this.warehouse = warehouse
    this.onApiCall = onApiCall

    console.log('[Iceberg Client] Initialized with:', {
      hasSessionId: !!this.sessionId,
      warehouse: this.warehouse,
    })
  }

  private async ensureConfigLoaded(): Promise<void> {
    if (this.prefix) return // Already loaded

    if (!this.configPromise) {
      this.configPromise = this.loadConfig()
    }

    await this.configPromise
  }

  private async loadConfig(): Promise<void> {
    try {
      const configPath = '/v1/config' + (this.warehouse ? `?warehouse=${this.warehouse}` : '')
      console.log('[Iceberg Client] Loading config from:', configPath, 'warehouse:', this.warehouse)
      const config = await this.fetchRaw<IcebergConfig>(configPath)

      console.log('[Iceberg Client] Config loaded:', config)

      // Extract prefix from the config if it exists (check both overrides and defaults)
      let prefix = config.overrides?.prefix || config.defaults?.prefix
      if (prefix) {
        // Decode the prefix if it's URL-encoded
        this.prefix = decodeURIComponent(prefix)
        console.log('[Iceberg Client] Using prefix:', this.prefix)
      } else {
        console.warn('[Iceberg Client] No prefix found in config')
      }
    } catch (error) {
      console.error('[Iceberg Client] Failed to load config:', error)
      // Continue without prefix - some catalogs don't use it
    }
  }

  private buildUrl(path: string): string {
    // If we have a prefix and the path starts with /v1/, inject the prefix
    // BUT: Don't inject the prefix if it matches the warehouse (e.g., S3 Tables uses ARN as both)
    if (this.prefix && path.startsWith('/v1/') && this.prefix !== this.warehouse) {
      path = `/v1/${this.prefix}${path.substring(3)}`
    }

    // Add warehouse parameter if provided
    if (this.warehouse) {
      const separator = path.includes('?') ? '&' : '?'
      path = `${path}${separator}warehouse=${this.warehouse}`
    }

    return path
  }

  private async fetchRaw<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `/api/iceberg${path}`
    const startTime = performance.now()

    const headers: HeadersInit = {
      'X-Session-ID': this.sessionId,
      'Content-Type': 'application/json',
    }

    console.log('[Iceberg Client] Request:', {
      url,
      path,
      hasSessionId: !!this.sessionId,
    })

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...(options?.headers as Record<string, string>),
        },
      })

      const duration = Math.round(performance.now() - startTime)

      console.log('[Iceberg Client] Response:', {
        status: response.status,
        ok: response.ok,
        url: response.url,
        duration: `${duration}ms`,
      })

      if (!response.ok) {
        const errorText = await response.text()

        // Record failed API call
        if (this.onApiCall) {
          this.onApiCall({
            method: options?.method || 'GET',
            endpoint: path,
            duration,
            status: 'error',
          })
        }

        // Special handling for 401 - session expired
        if (response.status === 401) {
          sessionStorage.clear()
          window.location.href = '/'
          throw new Error('Session expired. Please log in again.')
        }

        // Special handling for 403 - authentication failed
        if (response.status === 403) {
          throw new Error(
            'Authentication failed (403 Forbidden). Your credentials are not valid or do not have access to this resource. ' +
            'Please check your credentials and try logging in again.'
          )
        }

        // Special handling for 404 - likely means Worker isn't running
        if (response.status === 404) {
          throw new Error(
            `Cannot reach proxy server. Make sure you're running 'npm run dev:worker' in a separate terminal. ` +
            `Original error: ${response.status} ${errorText}`
          )
        }

        throw new Error(`Iceberg API error (${response.status}): ${errorText}`)
      }

      // Record successful API call
      if (this.onApiCall) {
        this.onApiCall({
          method: options?.method || 'GET',
          endpoint: path,
          duration,
          status: 'success',
        })
      }

      return response.json()
    } catch (error) {
      const duration = Math.round(performance.now() - startTime)

      // Record error if not already recorded
      if (this.onApiCall && !(error instanceof Error && error.message.includes('Session expired'))) {
        this.onApiCall({
          method: options?.method || 'GET',
          endpoint: path,
          duration,
          status: 'error',
        })
      }

      throw error
    }
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    // Load config first to get prefix (if needed)
    await this.ensureConfigLoaded()

    // Build URL with prefix and warehouse parameter
    const fullPath = this.buildUrl(path)

    return this.fetchRaw<T>(fullPath, options)
  }

  async getConfig(): Promise<IcebergConfig> {
    return this.fetchRaw<IcebergConfig>('/v1/config' + (this.warehouse ? `?warehouse=${this.warehouse}` : ''))
  }

  async listNamespaces(parent?: string[]): Promise<{ namespaces: string[][] }> {
    const params = new URLSearchParams()
    if (parent) {
      params.set('parent', parent.join('.'))
    }
    const query = params.toString() ? `?${params.toString()}` : ''
    return this.fetch<{ namespaces: string[][] }>(`/v1/namespaces${query}`)
  }

  async getNamespace(namespace: string[]): Promise<Namespace> {
    const namespacePath = namespace.join('\u001f') // Use ASCII unit separator
    return this.fetch<Namespace>(`/v1/namespaces/${namespacePath}`)
  }

  async listTables(namespace: string[]): Promise<{ identifiers: TableIdentifier[] }> {
    const namespacePath = namespace.join('\u001f')
    return this.fetch<{ identifiers: TableIdentifier[] }>(
      `/v1/namespaces/${namespacePath}/tables`
    )
  }

  async loadTable(namespace: string[], table: string): Promise<LoadTableResult> {
    const namespacePath = namespace.join('\u001f')
    // Use GET to load table metadata (POST is for committing updates)
    return this.fetch<LoadTableResult>(
      `/v1/namespaces/${namespacePath}/tables/${table}`
    )
  }

  async fetchMetadataFile(metadataLocation: string): Promise<any> {
    // Fetch metadata JSON from object storage
    // Note: This may require different auth depending on the storage backend
    const response = await fetch(metadataLocation)
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status}`)
    }
    return response.json()
  }
}

export function getClient(onApiCall?: ApiCallCallback): IcebergClient {
  const sessionId = sessionStorage.getItem('iceberg-session-id')
  const warehouse = sessionStorage.getItem('iceberg-warehouse') || undefined

  if (!sessionId) {
    throw new Error('Not authenticated')
  }

  return new IcebergClient(sessionId, warehouse, onApiCall)
}
