import { Server, Globe, Wifi, Clock, History as HistoryIcon, Trash2, Pencil } from 'lucide-react'
import StatusPulse from './StatusPulse.jsx'
import HistoryBars from './HistoryBars.jsx'

function timeAgo(iso) {
  if (!iso) return 'never'
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

const PROTO_STYLES = {
  tcp: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400',
  udp: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400',
  http: 'bg-purple-50 dark:bg-purple-500/10 text-purple-500 dark:text-purple-400',
  https: 'bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400',
  icmp: 'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400',
}

function targetIcon(protocol) {
  if (protocol === 'icmp') return Wifi
  if (protocol === 'https') return Globe
  return Server
}

function latencyColor(ms) {
  if (ms == null) return 'text-slate-300 dark:text-slate-600'
  if (ms > 100) return 'text-rose-500 dark:text-rose-400'
  if (ms > 20) return 'text-amber-500 dark:text-amber-400'
  return 'text-slate-600 dark:text-slate-300'
}

function uptimeTone(pct) {
  if (pct >= 95) return { text: 'text-emerald-500 dark:text-emerald-400', bar: 'bg-emerald-500' }
  if (pct >= 80) return { text: 'text-amber-500 dark:text-amber-400', bar: 'bg-amber-500' }
  return { text: 'text-rose-500 dark:text-rose-400', bar: 'bg-rose-500' }
}

export default function TargetRow({ target, onRemove, onShowHistory, onEdit }) {
  const hostPort = target.port ? `${target.host}:${target.port}` : target.host
  const statusLabel =
    target.is_up === true ? 'Up' : target.is_up === false ? 'Down' : 'Pending'
  const statusColor =
    target.is_up === true
      ? 'text-emerald-600 dark:text-emerald-400'
      : target.is_up === false
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-400 dark:text-slate-500'

  const Icon = targetIcon(target.protocol)
  const iconTone =
    target.is_up === false
      ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400'
      : 'bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400'
  const uptime = uptimeTone(target.uptime_percentage ?? 0)

  return (
    <div className="grid grid-cols-12 items-center gap-4 px-5 py-4 border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
      <div className="col-span-3 flex items-center gap-3 min-w-0">
        <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${iconTone}`}>
          <Icon size={16} strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{target.name}</p>
          <p className="text-xs font-mono text-slate-400 dark:text-slate-500 truncate">{hostPort}</p>
        </div>
      </div>

      <div className="col-span-1">
        <span
          className={`text-[10px] uppercase tracking-wider font-semibold rounded-full px-2 py-0.5 ${
            PROTO_STYLES[target.protocol] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
          }`}
        >
          {target.protocol}
        </span>
      </div>

      <div className={`col-span-1 flex items-center gap-1.5 text-sm font-medium ${statusColor}`}>
        <StatusPulse isUp={target.is_up} size="sm" />
        {statusLabel}
      </div>

      <div className={`col-span-1 text-sm font-medium ${latencyColor(target.last_response_time_ms)}`}>
        {target.last_response_time_ms != null ? `${target.last_response_time_ms}ms` : '—'}
      </div>

      <div className="col-span-1">
        <p className={`text-sm font-semibold ${uptime.text}`}>{target.uptime_percentage}%</p>
        <div className="mt-1 h-[3px] w-10 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full ${uptime.bar}`}
            style={{ width: `${Math.min(100, Math.max(0, target.uptime_percentage ?? 0))}%` }}
          />
        </div>
      </div>

      <div className="col-span-3">
        <HistoryBars history={target.recent_history} />
      </div>

      <div className="col-span-1 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
        <Clock size={12} />
        {timeAgo(target.last_check)}
      </div>

      <div className="col-span-1 flex items-center justify-end gap-3">
        <button
          onClick={() => onShowHistory(target.name)}
          title="View history"
          className="text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <HistoryIcon size={15} />
        </button>
        {onEdit && (
          <button
            onClick={() => onEdit(target)}
            title="Edit target"
            className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-opacity"
          >
            <Pencil size={15} />
          </button>
        )}
        {onRemove && (
          <button
            onClick={() => onRemove(target.name)}
            title="Remove target"
            className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-opacity"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
