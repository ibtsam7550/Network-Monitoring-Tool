import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { X } from 'lucide-react'
import { api } from '../api.js'
import StatusPulse from './StatusPulse.jsx'

function formatDuration(seconds) {
  if (!seconds || seconds < 1) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const parts = []
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  if (!h && s) parts.push(`${s}s`)
  return parts.join(' ') || '0s'
}

function formatWhen(iso) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function HistoryModal({ name, onClose, theme = 'light' }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const isDark = theme === 'dark'

  useEffect(() => {
    let cancelled = false
    api
      .getHistory(name)
      .then((d) => !cancelled && setDetail(d))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [name])

  const chartData =
    detail?.history
      ?.filter((h) => h.response_time_ms != null)
      .map((h) => ({
        time: new Date(h.time).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        }),
        ms: h.response_time_ms,
        status: h.status,
      })) || []

  const timeline = detail?.downtime_events ? [...detail.downtime_events].reverse() : []

  const chartGrid = isDark ? '#1e293b' : '#e2e8f0'
  const chartAxisText = isDark ? '#64748b' : '#94a3b8'
  const chartTooltipBg = isDark ? '#0f172a' : '#ffffff'
  const chartTooltipBorder = isDark ? '#1e293b' : '#e2e8f0'
  const chartTooltipLabel = isDark ? '#94a3b8' : '#64748b'
  const chartLine = isDark ? '#60a5fa' : '#3b82f6'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-xl">
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <StatusPulse isUp={detail?.is_up} />
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                {name}
              </h2>
              <p className="text-xs font-mono text-slate-400 dark:text-slate-500 truncate">
                {detail ? (detail.port ? `${detail.host}:${detail.port}` : detail.host) : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        {!detail && !error && (
          <div className="px-6 py-16 text-center text-slate-400 dark:text-slate-500 text-sm">Loading history…</div>
        )}

        {detail && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">Last up</p>
                <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">{formatWhen(detail.last_up)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">Last down</p>
                <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">{formatWhen(detail.last_down)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">Incidents (24h / 7d)</p>
                <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                  {detail.incidents_24h} / {detail.incidents_7d}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">Total downtime</p>
                <p className="text-sm text-rose-500 dark:text-rose-400 mt-1">
                  {formatDuration(detail.total_downtime_seconds)}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-2">
                Response time
              </p>
              {chartData.length > 1 ? (
                <div className="h-40 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid stroke={chartGrid} strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: chartAxisText, fontSize: 10 }}
                        axisLine={{ stroke: chartGrid }}
                        tickLine={false}
                        minTickGap={30}
                      />
                      <YAxis
                        tick={{ fill: chartAxisText, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                        unit="ms"
                      />
                      <Tooltip
                        contentStyle={{
                          background: chartTooltipBg,
                          border: `1px solid ${chartTooltipBorder}`,
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: chartTooltipLabel }}
                      />
                      <Line
                        type="monotone"
                        dataKey="ms"
                        stroke={chartLine}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 px-1">
                  Not enough data yet — check back after a few monitoring cycles.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
                  Up / down timeline
                </p>
                <a
                  href={api.historyExportUrl(name)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors font-medium"
                >
                  Export CSV
                </a>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                {timeline.length === 0 && (
                  <p className="text-sm text-slate-400 dark:text-slate-500 px-3 py-4 text-center">
                    No status changes recorded yet.
                  </p>
                )}
                {timeline.map((e, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span
                      className={
                        e.event === 'DOWN'
                          ? 'text-rose-500 dark:text-rose-400 font-medium'
                          : 'text-emerald-500 dark:text-emerald-400 font-medium'
                      }
                    >
                      {e.event === 'DOWN' ? 'Went down' : 'Recovered'}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">
                      {formatWhen(e.time)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
