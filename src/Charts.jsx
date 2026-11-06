import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { categories, colors } from './domain.js'
echarts.use([LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])
function Chart({ option, label }) {
  const element = useRef(null)
  useEffect(() => {
    const chart = echarts.init(element.current)
    chart.setOption(option)
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(element.current)
    return () => { observer.disconnect(); chart.dispose() }
  }, [option])
  return <div className="chart" ref={element} role="img" aria-label={label} />
}
export default function Charts({ stats }) {
  const days = Object.keys(stats.byDay).sort()
  const base = { textStyle: { fontFamily: 'system-ui', color: '#77716b', fontSize: 16 }, tooltip: { trigger: 'axis', valueFormatter: (v) => `¥${Number(v).toFixed(2)}` }, grid: { left: 55, right: 22, top: 24, bottom: 30 } }
  return <div className="charts-grid">
    <section className="panel"><div className="panel-title"><h2>每日消费趋势</h2></div>{days.length ? <Chart label="每日净消费折线图" option={{ ...base, xAxis: { type: 'category', data: days.map((d) => d.slice(5)), boundaryGap: false, axisTick: { show: false }, axisLine: { lineStyle: { color: '#e6eae6' } } }, yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef0eb', type: 'dashed' } } }, series: [{ type: 'line', data: days.map((d) => stats.byDay[d] / 100), smooth: true, symbolSize: 7, itemStyle: { color: '#35322f' }, lineStyle: { width: 3 }, areaStyle: { color: '#35322f', opacity: .08 } }] }} /> : <div className="chart-empty">暂无消费数据</div>}</section>
    <section className="panel"><div className="panel-title"><h2>分类占比</h2></div>{Object.values(stats.byCategory).some((v) => v > 0) ? <Chart label="正净支出分类占比环形图" option={{ textStyle: base.textStyle, tooltip: { trigger: 'item', formatter: '{b}：¥{c}（{d}%）' }, legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8 }, color: colors, series: [{ type: 'pie', radius: ['42%', '68%'], center: ['50%', '43%'], label: { show: false }, data: categories.map((name, index) => ({ name, value: Math.max(0, stats.byCategory[name] || 0) / 100, itemStyle: { color: colors[index] } })).filter((d) => d.value > 0) }] }} /> : <div className="chart-empty">暂时没有正净支出</div>}</section>
  </div>
}

