import { useMemo } from 'react'
import type { WeeklyUtilization } from '../types'

/**
 * AllocationFunnel - Gráfico estilo funil horizontal orgânico
 * Estágios conectados fluidamente com curvas em laranja claro
 */

interface AllocationFunnelProps {
  data: WeeklyUtilization[]
}

// Paleta laranja do mais escuro ao mais claro
const FUNNEL_COLORS = ['#ea580c', '#f97316', '#fb923c', '#fdba74']

const AllocationFunnel = ({ data }: AllocationFunnelProps) => {
  const stages = useMemo(() => {
    if (!data || data.length === 0) return []
    
    return data.map((week, index) => ({
      label: week.week_label,
      value: week.utilization_pct,
      count: week.allocated_count,
      total: week.total_consultants,
      color: FUNNEL_COLORS[index] || FUNNEL_COLORS[3],
    }))
  }, [data])

  if (stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
        Sem dados de utilização
      </div>
    )
  }

  // Dimensões do SVG
  const svgWidth = 800
  const svgHeight = 170
  const centerY = 80
  const maxBarHeight = 110
  const labelY = 16
  const valueY = svgHeight - 6

  // Larguras: barras bem largas, conexões finas
  const numStages = stages.length
  const barWidth = svgWidth / (numStages * 1.12) // barras ocupam ~89% do espaço
  const gapWidth = (svgWidth - barWidth * numStages) / (numStages - 1) // emendas estreitas

  const getBarHeight = (pct: number) => {
    const minHeight = maxBarHeight * 0.18
    return Math.max(minHeight, (pct / 100) * maxBarHeight)
  }

  // Calcular posição X de cada barra
  const getBarX = (i: number) => i * (barWidth + gapWidth)

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
        style={{ maxHeight: '175px' }}
      >
        <defs>
          {stages.map((stage, i) => (
            <linearGradient key={`grad-${i}`} id={`funnel-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stage.color} stopOpacity="0.95" />
              <stop offset="100%" stopColor={stage.color} stopOpacity="0.7" />
            </linearGradient>
          ))}
          {/* Gradients para conexões — laranja claro */}
          {stages.map((stage, i) => {
            if (i >= stages.length - 1) return null
            const nextStage = stages[i + 1]
            return (
              <linearGradient key={`conn-grad-${i}`} id={`conn-grad-${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={stage.color} stopOpacity="0.35" />
                <stop offset="50%" stopColor={stage.color} stopOpacity="0.2" />
                <stop offset="100%" stopColor={nextStage.color} stopOpacity="0.35" />
              </linearGradient>
            )
          })}
        </defs>

        {/* Conexões orgânicas entre estágios (renderizar ANTES das barras) */}
        {stages.map((stage, i) => {
          if (i >= stages.length - 1) return null
          
          const nextStage = stages[i + 1]
          const leftH = getBarHeight(stage.value)
          const rightH = getBarHeight(nextStage.value)
          
          // Ponto de saída: borda direita da barra atual
          const leftX = getBarX(i) + barWidth
          // Ponto de entrada: borda esquerda da próxima barra
          const rightX = getBarX(i + 1)
          
          const leftTop = centerY - leftH / 2
          const leftBottom = centerY + leftH / 2
          const rightTop = centerY - rightH / 2
          const rightBottom = centerY + rightH / 2
          
          // Curvas Bézier suaves
          const cp1X = leftX + (rightX - leftX) * 0.4
          const cp2X = leftX + (rightX - leftX) * 0.6

          return (
            <path
              key={`conn-${i}`}
              d={`
                M ${leftX} ${leftTop}
                C ${cp1X} ${leftTop}, ${cp2X} ${rightTop}, ${rightX} ${rightTop}
                L ${rightX} ${rightBottom}
                C ${cp2X} ${rightBottom}, ${cp1X} ${leftBottom}, ${leftX} ${leftBottom}
                Z
              `}
              fill={`url(#conn-grad-${i})`}
            />
          )
        })}

        {/* Barras dos estágios */}
        {stages.map((stage, i) => {
          const barH = getBarHeight(stage.value)
          const barX = getBarX(i)
          const barY = centerY - barH / 2
          const isFirst = i === 0
          const isLast = i === stages.length - 1

          return (
            <g key={`stage-${i}`}>
              {/* Barra com cantos arredondados apenas nas extremidades externas */}
              <rect
                x={barX}
                y={barY}
                width={barWidth}
                height={barH}
                rx={isFirst || isLast ? 10 : 6}
                ry={isFirst || isLast ? 10 : 6}
                fill={`url(#funnel-grad-${i})`}
              />
              
              {/* Label no topo */}
              <text
                x={barX + barWidth / 2}
                y={labelY}
                textAnchor="middle"
                className="fill-gray-500 dark:fill-gray-400"
                fontSize="11"
                fontWeight="500"
              >
                {stage.label}
              </text>

              {/* Valor % centralizado na barra */}
              <text
                x={barX + barWidth / 2}
                y={centerY + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="22"
                fontWeight="700"
              >
                {stage.value.toFixed(0)}%
              </text>

              {/* Contagem abaixo da barra */}
              <text
                x={barX + barWidth / 2}
                y={valueY}
                textAnchor="middle"
                className="fill-gray-400 dark:fill-gray-500"
                fontSize="10"
                fontWeight="400"
              >
                {stage.count}/{stage.total} consultores
              </text>
            </g>
          )
        })}

        {/* Pills de variação entre estágios */}
        {stages.map((stage, i) => {
          if (i >= stages.length - 1) return null
          const nextStage = stages[i + 1]
          const diff = nextStage.value - stage.value
          const diffText = diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`
          const isPositive = diff >= 0
          
          const pillX = getBarX(i) + barWidth + gapWidth / 2
          const pillY = centerY + maxBarHeight / 2 + 14
          const pillWidth = 52
          const pillHeight = 18

          return (
            <g key={`diff-${i}`}>
              <rect
                x={pillX - pillWidth / 2}
                y={pillY - pillHeight / 2}
                width={pillWidth}
                height={pillHeight}
                rx={9}
                fill={isPositive ? '#dcfce7' : '#fee2e2'}
                stroke={isPositive ? '#bbf7d0' : '#fecaca'}
                strokeWidth={0.5}
              />
              <text
                x={pillX}
                y={pillY + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="9"
                fontWeight="600"
                fill={isPositive ? '#16a34a' : '#dc2626'}
              >
                {diffText} →
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default AllocationFunnel
