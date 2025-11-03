import { TableMetadata, Snapshot } from '@/types/iceberg'

export interface TableMetrics {
  totalRows: number
  totalSizeBytes: number
  totalDataFiles: number
  totalDeleteFiles: number
  lastUpdatedMs: number
  snapshotCount: number
  operation?: string
}

/**
 * Extract metrics from a table's metadata
 */
export function extractTableMetrics(metadata: TableMetadata): TableMetrics | null {
  const currentSnapshot = getCurrentSnapshot(metadata)

  if (!currentSnapshot?.summary) {
    return null
  }

  const summary = currentSnapshot.summary

  return {
    totalRows: parseInt(summary['total-records'] || '0', 10),
    totalSizeBytes: parseInt(summary['total-files-size'] || '0', 10),
    totalDataFiles: parseInt(summary['total-data-files'] || '0', 10),
    totalDeleteFiles: parseInt(summary['total-delete-files'] || '0', 10),
    lastUpdatedMs: currentSnapshot['timestamp-ms'],
    snapshotCount: metadata.snapshots?.length || 0,
    operation: summary.operation,
  }
}

/**
 * Get the current snapshot from table metadata
 */
export function getCurrentSnapshot(metadata: TableMetadata): Snapshot | null {
  if (!metadata['current-snapshot-id'] || !metadata.snapshots) {
    return null
  }

  return (
    metadata.snapshots.find((s) => s['snapshot-id'] === metadata['current-snapshot-id']) || null
  )
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US')
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(timestampMs: number): string {
  const now = Date.now()
  const diff = now - timestampMs

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (years > 0) return `${years}y ago`
  if (months > 0) return `${months}mo ago`
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return `${seconds}s ago`
}

/**
 * Format timestamp to date string
 */
export function formatDate(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Get partition strategy description
 */
export function getPartitionStrategy(metadata: TableMetadata): string {
  const currentSpec = metadata['partition-specs'].find(
    (spec) => spec['spec-id'] === metadata['default-spec-id']
  )

  if (!currentSpec || currentSpec.fields.length === 0) {
    return 'Unpartitioned'
  }

  const fields = currentSpec.fields.map((f) => `${f.name} (${f.transform})`).join(', ')
  return fields
}

/**
 * Get file format from table properties
 */
export function getFileFormat(metadata: TableMetadata): string {
  return metadata.properties?.['write.format.default'] || 'Unknown'
}

/**
 * Calculate average file size
 */
export function getAverageFileSize(metrics: TableMetrics): number {
  if (metrics.totalDataFiles === 0) return 0
  return metrics.totalSizeBytes / metrics.totalDataFiles
}

/**
 * Aggregate metrics for multiple tables
 */
export function aggregateMetrics(metricsList: (TableMetrics | null)[]): TableMetrics {
  const validMetrics = metricsList.filter((m): m is TableMetrics => m !== null)

  if (validMetrics.length === 0) {
    return {
      totalRows: 0,
      totalSizeBytes: 0,
      totalDataFiles: 0,
      totalDeleteFiles: 0,
      lastUpdatedMs: 0,
      snapshotCount: 0,
    }
  }

  return {
    totalRows: validMetrics.reduce((sum, m) => sum + m.totalRows, 0),
    totalSizeBytes: validMetrics.reduce((sum, m) => sum + m.totalSizeBytes, 0),
    totalDataFiles: validMetrics.reduce((sum, m) => sum + m.totalDataFiles, 0),
    totalDeleteFiles: validMetrics.reduce((sum, m) => sum + m.totalDeleteFiles, 0),
    lastUpdatedMs: Math.max(...validMetrics.map((m) => m.lastUpdatedMs)),
    snapshotCount: validMetrics.reduce((sum, m) => sum + m.snapshotCount, 0),
  }
}

/**
 * Detect if the current snapshot was a compaction operation
 */
export function isCompactionSnapshot(metadata: TableMetadata): boolean {
  const currentSnapshot = getCurrentSnapshot(metadata)
  if (!currentSnapshot?.summary) return false

  const summary = currentSnapshot.summary
  const operation = summary.operation?.toLowerCase() || ''

  // Check for explicit compaction operations
  if (operation === 'replace' || operation === 'compaction' || operation === 'rewrite') {
    return true
  }

  // Check if files were deleted and added (typical compaction pattern)
  const addedFiles = parseInt(summary['added-data-files'] || '0', 10)
  const deletedFiles = parseInt(summary['deleted-data-files'] || '0', 10)
  const addedRecords = parseInt(summary['added-records'] || '0', 10)
  const deletedRecords = parseInt(summary['deleted-records'] || '0', 10)

  // Compaction: files were deleted and added, but net records change is small
  if (deletedFiles > 0 && addedFiles > 0) {
    const netRecordsChange = Math.abs(addedRecords - deletedRecords)
    const totalRecords = addedRecords + deletedRecords

    // If less than 1% net change in records, likely compaction
    if (totalRecords > 0 && netRecordsChange / totalRecords < 0.01) {
      return true
    }
  }

  return false
}

/**
 * Check if table might benefit from compaction
 */
export function needsCompaction(metadata: TableMetadata): {
  needsCompaction: boolean
  reason?: string
  severity?: 'low' | 'medium' | 'high'
  insufficientData?: boolean
} {
  const currentSnapshot = getCurrentSnapshot(metadata)
  if (!currentSnapshot?.summary) {
    return { needsCompaction: false }
  }

  const summary = currentSnapshot.summary
  const totalFiles = parseInt(summary['total-data-files'] || '0', 10)
  const totalSize = parseInt(summary['total-files-size'] || '0', 10)

  if (totalFiles === 0) {
    return { needsCompaction: false }
  }

  // Minimum thresholds for making recommendations
  const minFilesForRecommendation = 10
  const minSizeForRecommendation = 1024 * 1024 * 1024 // 1 GB

  // If table is too small or has too few files, don't make a recommendation
  if (totalFiles < minFilesForRecommendation || totalSize < minSizeForRecommendation) {
    return {
      needsCompaction: false,
      insufficientData: true,
      reason: `Table has ${totalFiles} file${totalFiles !== 1 ? 's' : ''} (${formatBytes(totalSize)}). Compaction recommendations are most useful for tables with 10+ files and 1+ GB of data.`,
    }
  }

  const avgFileSize = totalSize / totalFiles
  const smallFileThreshold = 100 * 1024 * 1024 // 100 MB

  // Check for small files
  if (avgFileSize < smallFileThreshold) {
    const severity = avgFileSize < 10 * 1024 * 1024 ? 'high' : avgFileSize < 50 * 1024 * 1024 ? 'medium' : 'low'
    return {
      needsCompaction: true,
      reason: `Small average file size: ${formatBytes(avgFileSize)}. Consider compaction to improve query performance.`,
      severity,
    }
  }

  // Check for too many files
  if (totalFiles > 1000) {
    const severity = totalFiles > 5000 ? 'high' : totalFiles > 2000 ? 'medium' : 'low'
    return {
      needsCompaction: true,
      reason: `Large number of files (${formatNumber(totalFiles)}). Compaction can reduce metadata overhead.`,
      severity,
    }
  }

  return { needsCompaction: false }
}

/**
 * Get last compaction timestamp from snapshots
 */
export function getLastCompaction(metadata: TableMetadata): number | null {
  if (!metadata.snapshots) return null

  // Check snapshots in reverse chronological order
  const sortedSnapshots = [...metadata.snapshots].sort((a, b) => b['timestamp-ms'] - a['timestamp-ms'])

  for (const snapshot of sortedSnapshots) {
    if (!snapshot.summary) continue

    const operation = snapshot.summary.operation?.toLowerCase() || ''
    if (operation === 'replace' || operation === 'compaction' || operation === 'rewrite') {
      return snapshot['timestamp-ms']
    }

    // Check for compaction pattern
    const addedFiles = parseInt(snapshot.summary['added-data-files'] || '0', 10)
    const deletedFiles = parseInt(snapshot.summary['deleted-data-files'] || '0', 10)
    const addedRecords = parseInt(snapshot.summary['added-records'] || '0', 10)
    const deletedRecords = parseInt(snapshot.summary['deleted-records'] || '0', 10)

    if (deletedFiles > 0 && addedFiles > 0) {
      const netRecordsChange = Math.abs(addedRecords - deletedRecords)
      const totalRecords = addedRecords + deletedRecords

      if (totalRecords > 0 && netRecordsChange / totalRecords < 0.01) {
        return snapshot['timestamp-ms']
      }
    }
  }

  return null
}
