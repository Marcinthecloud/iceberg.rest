// Iceberg REST API types based on the specification

export interface IcebergConfig {
  overrides?: Record<string, string>
  defaults?: Record<string, string>
}

export interface Namespace {
  namespace: string[]
  properties?: Record<string, string>
}

export interface TableIdentifier {
  namespace: string[]
  name: string
}

export interface Schema {
  type: 'struct'
  'schema-id': number
  fields: SchemaField[]
}

export interface SchemaField {
  id: number
  name: string
  required: boolean
  type: string | NestedType
  doc?: string
}

export interface NestedType {
  type: 'struct' | 'list' | 'map'
  fields?: SchemaField[]
  element?: string | NestedType
  'element-id'?: number
  'element-required'?: boolean
  key?: string | NestedType
  'key-id'?: number
  value?: string | NestedType
  'value-id'?: number
  'value-required'?: boolean
}

export interface PartitionSpec {
  'spec-id': number
  fields: PartitionField[]
}

export interface PartitionField {
  'source-id': number
  'field-id': number
  name: string
  transform: string
}

export interface Snapshot {
  'snapshot-id': number
  'parent-snapshot-id'?: number
  'sequence-number': number
  'timestamp-ms': number
  'manifest-list': string
  summary?: Record<string, string>
  'schema-id'?: number
}

export interface TableMetadata {
  'format-version': number
  'table-uuid': string
  location: string
  'last-updated-ms': number
  'last-column-id': number
  schemas: Schema[]
  'current-schema-id': number
  'partition-specs': PartitionSpec[]
  'default-spec-id': number
  'last-partition-id': number
  properties?: Record<string, string>
  'current-snapshot-id'?: number
  snapshots?: Snapshot[]
  'snapshot-log'?: Array<{
    'snapshot-id': number
    'timestamp-ms': number
  }>
  'metadata-log'?: Array<{
    'metadata-file': string
    'timestamp-ms': number
  }>
  'sort-orders'?: Array<{
    'order-id': number
    fields: Array<{
      transform: string
      'source-id': number
      direction: 'asc' | 'desc'
      'null-order': 'nulls-first' | 'nulls-last'
    }>
  }>
  'default-sort-order-id'?: number
}

export interface LoadTableResult {
  'metadata-location'?: string
  metadata: TableMetadata
  config?: Record<string, string>
}

export interface CatalogSession {
  endpoint: string
  token: string
  oauthEndpoint?: string
}
