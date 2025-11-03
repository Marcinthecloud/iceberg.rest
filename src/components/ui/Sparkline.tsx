interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  fillOpacity?: number
}

export function Sparkline({
  data,
  width = 200,
  height = 40,
  color = '#5B4B8A',
  fillOpacity = 0.2
}: SparklineProps) {
  if (data.length === 0) {
    return <div style={{ width, height }} className="flex items-center justify-center text-xs text-muted-foreground">No data</div>
  }

  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1

  const barWidth = width / data.length
  const padding = 2

  return (
    <svg width={width} height={height} className="overflow-visible">
      {data.map((value, index) => {
        const barHeight = ((value - min) / range) * height
        const x = index * barWidth
        const y = height - barHeight

        return (
          <rect
            key={index}
            x={x + padding / 2}
            y={y}
            width={barWidth - padding}
            height={barHeight}
            fill={color}
            opacity={fillOpacity + 0.5}
            className="hover:opacity-100 transition-opacity"
          />
        )
      })}
    </svg>
  )
}
