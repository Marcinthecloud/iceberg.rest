import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import {
  getDuckDBExample,
  getTrinoExample,
  getSparkExample,
  getPyIcebergExample,
  getSnowflakeExample,
} from './connectionExamples'

interface ConnectTabProps {
  namespace: string
  table: string
  catalogUrl: string
  warehouse?: string
  authType: 'bearer' | 'oauth2' | 'sigv4'
  awsRegion?: string
}

type Engine = 'duckdb' | 'trino' | 'spark' | 'pyiceberg' | 'snowflake'

const engines: { id: Engine; name: string; logo: string }[] = [
  { id: 'duckdb', name: 'DuckDB', logo: '/duckdb.png' },
  { id: 'trino', name: 'Trino', logo: '/trino.png' },
  { id: 'spark', name: 'Spark', logo: '/pyspark.png' },
  { id: 'pyiceberg', name: 'PyIceberg', logo: '/pyiceberg.png' },
  { id: 'snowflake', name: 'Snowflake', logo: '/snowflake.png' },
]

function getConnectionCode(
  engine: Engine,
  namespace: string,
  table: string,
  catalogUrl: string,
  warehouse?: string,
  authType: 'bearer' | 'oauth2' | 'sigv4' = 'bearer',
  awsRegion?: string
): { title: string; code: string; language: string } {
  const fullTable = `${namespace}.${table}`
  const warehouseValue = warehouse || '<warehouse_name>'
  const region = awsRegion || 'us-east-1'

  switch (engine) {
    case 'duckdb':
      return getDuckDBExample(fullTable, catalogUrl, warehouseValue, authType, region)
    case 'trino':
      return getTrinoExample(fullTable, catalogUrl, warehouseValue, authType, region)
    case 'spark':
      return getSparkExample(fullTable, catalogUrl, warehouseValue, authType, region)
    case 'pyiceberg':
      return getPyIcebergExample(fullTable, catalogUrl, warehouseValue, authType, region)
    case 'snowflake':
      return getSnowflakeExample(fullTable, catalogUrl, warehouseValue, authType)
  }
}

export function ConnectTab({ namespace, table, catalogUrl, warehouse, authType, awsRegion }: ConnectTabProps) {
  const [selectedEngine, setSelectedEngine] = useState<Engine>('duckdb')
  const [copied, setCopied] = useState(false)

  const { title, code, language } = getConnectionCode(
    selectedEngine,
    namespace,
    table,
    catalogUrl,
    warehouse,
    authType,
    awsRegion
  )

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-3">Select Query Engine</h3>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {engines.map((engine) => (
            <button
              key={engine.id}
              onClick={() => setSelectedEngine(engine.id)}
              className={cn(
                'flex items-center justify-center p-6 rounded-lg border-2 transition-all aspect-square',
                selectedEngine === engine.id
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm'
              )}
            >
              <img
                src={engine.logo}
                alt={engine.name}
                className="w-full h-full object-contain"
              />
            </button>
          ))}
        </div>
      </div>

      <div className="border rounded-lg bg-gray-50 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
          <span className="text-sm font-medium">{title}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </>
            )}
          </Button>
        </div>
        <pre className="p-4 overflow-x-auto text-sm">
          <code className={`language-${language}`}>{code}</code>
        </pre>
      </div>

      <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded p-3">
        <strong>Note:</strong> Make sure you have the necessary credentials and permissions configured for your catalog endpoint.
      </div>
    </div>
  )
}
