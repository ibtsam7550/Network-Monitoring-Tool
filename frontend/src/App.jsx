import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Activity,
  Bell,
  Download,
  Plus,
  Search,
  Clock,
  TrendingUp,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sun,
  Moon,
  Settings,
} from 'lucide-react'
import { api } from './api.js'
import StatCard from './components/StatCard.jsx'
import TargetRow from './components/TargetRow.jsx'
import AddTargetPanel from './components/AddTargetPanel.jsx'
import HistoryModal from './components/HistoryModal.jsx'
import ConfigModal from './components/ConfigModal.jsx'
import { useServerClock } from './hooks/useServerClock.js'
import { useDownAlerts } from './hooks/useDownAlerts.js'
import { useTheme } from './hooks/useTheme.js'

const POLL_MS = 10000
const PAGE_SIZE = 9

function timeAgo(date) {
  if (!date) return null
  const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  return `${m}m ago`
}

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [showConfig, setShowConfig] = useState(false)
  const [historyTarget, setHistoryTarget] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await api.getStatus()
      setData(res)
      setError('')
      setLastUpdated(new Date())
    } catch (err) {
      setError('Cannot reach the monitoring API. Retrying…')
    }
  }, [])

  const { now, secondsToNextCheck } = useServerClock(data?.server_time, data?.next_check_at)
  const { enabled: alertsEnabled, toggle: toggleAlerts } = useDownAlerts(
    data ? Object.values(data.targets) : null,
  )

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  const allTargets = useMemo(() => {
    if (!data) return []
    let list = Object.values(data.targets)
    if (filter === 'up') list = list.filter((t) => t.is_up === true)
    if (filter === 'down') list = list.filter((t) => t.is_up === false)
    if (filter === 'unknown') list = list.filter((t) => t.is_up === null)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (t) => t.name.toLowerCase().includes(q) || t.host.toLowerCase().includes(q),
      )
    }
    return list.sort((a, b) => {
      if (a.is_up === b.is_up) return a.name.localeCompare(b.name)
      if (a.is_up === false) return -1
      if (b.is_up === false) return 1
      return 0
    })
  }, [data, filter, query])

  useEffect(() => setPage(1), [filter, query])

  const pageCount = Math.max(1, Math.ceil(allTargets.length / PAGE_SIZE))
  const targets = allTargets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const avgUptime = useMemo(() => {
    if (!data) return null
    const list = Object.values(data.targets)
    if (!list.length) return null
    return list.reduce((sum, t) => sum + (t.uptime_percentage ?? 0), 0) / list.length
  }, [data])

  const handleAdd = async (target) => {
    await api.addTarget(target)
    await load()
  }

  const handleEdit = async (originalName, target) => {
    await api.updateTarget(originalName, target)
    await load()
  }

  const handleRemove = async (name) => {
    if (!confirm(`Remove "${name}" from monitoring?`)) return
    try {
      await api.removeTarget(name)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  const summary = data?.summary

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-100 font-body">
      <header className="max-w-7xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-500/30">
            <Activity size={19} className="text-white" strokeWidth={2.25} />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold leading-none text-slate-800 dark:text-slate-100">
              Network Monitor
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1">
              <RefreshCw size={11} />
              {lastUpdated ? `Synced ${lastUpdated.toLocaleTimeString()}` : 'Connecting…'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-display text-lg font-bold text-slate-800 dark:text-slate-100 leading-none tabular-nums">
              {now.toLocaleTimeString(undefined, { hour12: false })}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
              {secondsToNextCheck != null
                ? `Next check in ${secondsToNextCheck}s`
                : 'Awaiting first check'}
            </p>
          </div>

          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="h-10 w-10 rounded-full bg-white dark:bg-slate-900 shadow-sm shadow-slate-200/70 dark:shadow-black/20 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <button
            onClick={() => setShowConfig(true)}
            title="Configuration"
            className="h-10 w-10 rounded-full bg-white dark:bg-slate-900 shadow-sm shadow-slate-200/70 dark:shadow-black/20 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Settings size={17} />
          </button>

          <button
            onClick={toggleAlerts}
            title={alertsEnabled ? 'Alerts on — click to mute' : 'Alerts muted — click to enable'}
            className="relative h-10 w-10 rounded-full bg-white dark:bg-slate-900 shadow-sm shadow-slate-200/70 dark:shadow-black/20 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Bell size={17} />
            {alertsEnabled && summary?.down > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>

          <a
            href={api.fullExportUrl()}
            className="rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-semibold pl-3.5 pr-4 py-2.5 flex items-center gap-1.5 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
          >
            <Download size={15} />
            Export CSV
          </a>

          <button
            onClick={() => setShowAdd(true)}
            className="rounded-full bg-blue-600 text-white text-sm font-semibold pl-3.5 pr-4 py-2.5 flex items-center gap-1.5 hover:bg-blue-700 shadow-sm shadow-blue-600/30 transition-colors"
          >
            <Plus size={15} />
            Add target
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-10">
        {error && (
          <div className="mb-6 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total targets"
            value={summary?.total ?? '—'}
            icon={Layers}
            iconGradient="from-indigo-500 to-purple-500"
            valueColor="text-indigo-600"
            blobColor="bg-purple-100"
          />
          <StatCard
            label="Online"
            value={summary?.up ?? '—'}
            icon={CheckCircle2}
            iconGradient="from-teal-400 to-emerald-500"
            valueColor="text-emerald-500"
            blobColor="bg-emerald-100"
          />
          <StatCard
            label="Offline"
            value={summary?.down ?? '—'}
            icon={AlertCircle}
            iconGradient="from-rose-500 to-orange-500"
            valueColor="text-rose-500"
            blobColor="bg-rose-100"
          />
          <StatCard
            label="Pending"
            value={summary?.unknown ?? '—'}
            icon={RefreshCw}
            iconGradient="from-amber-400 to-orange-500"
            valueColor="text-amber-500"
            blobColor="bg-amber-100"
          />
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm shadow-slate-200/60 dark:shadow-black/20 px-6 py-4 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 shrink-0">
            <TrendingUp size={16} className="text-emerald-500" />
            Average uptime
          </div>
          <div className="flex-1 min-w-[160px] h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-400"
              style={{ width: `${avgUptime != null ? Math.min(100, avgUptime) : 0}%` }}
            />
          </div>
          <div className="text-sm font-bold text-blue-600 dark:text-blue-400 shrink-0">
            {avgUptime != null ? `${avgUptime.toFixed(2)}%` : '—'}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 shrink-0">
            <Clock size={12} />
            {lastUpdated ? `Last check ${timeAgo(lastUpdated)}` : 'Awaiting first check'}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1 rounded-xl bg-white dark:bg-slate-900 shadow-sm shadow-slate-200/60 dark:shadow-black/20 p-1">
            {[
              ['all', 'All'],
              ['up', 'Up'],
              ['down', 'Down'],
              ['unknown', 'Pending'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or host…"
              className="rounded-xl bg-white dark:bg-slate-900 shadow-sm shadow-slate-200/60 dark:shadow-black/20 pl-9 pr-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/30 outline-none w-64"
            />
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm shadow-slate-200/60 dark:shadow-black/20 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-slate-100 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
            <div className="col-span-3">Target</div>
            <div className="col-span-1">Proto</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Latency</div>
            <div className="col-span-1">Uptime</div>
            <div className="col-span-3">History</div>
            <div className="col-span-1">Checked</div>
            <div className="col-span-1"></div>
          </div>

          {!data && !error && (
            <div className="px-5 py-16 text-center text-slate-400 dark:text-slate-500 text-sm">
              Loading targets…
            </div>
          )}

          {data && targets.length === 0 && (
            <div className="px-5 py-16 text-center">
              <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">No targets match.</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                Adjust your filter or add a new target to monitor.
              </p>
            </div>
          )}

          {targets.map((t) => (
            <TargetRow
              key={t.name}
              target={t}
              onRemove={handleRemove}
              onShowHistory={setHistoryTarget}
              onEdit={setEditTarget}
            />
          ))}

          {data && allTargets.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Showing {targets.length} of {allTargets.length} targets
              </p>
              {pageCount > 1 && (
                <div className="flex items-center gap-1">
                  {Array.from({ length: pageCount }, (_, i) => i + 1)
                    .slice(0, 5)
                    .map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`h-7 w-7 rounded-full text-xs font-semibold transition-colors ${
                          page === p
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  {pageCount > 5 && <span className="text-slate-300 dark:text-slate-600 px-1">···</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {showAdd && (
        <AddTargetPanel onAdd={handleAdd} onClose={() => setShowAdd(false)} />
      )}

      {editTarget && (
        <AddTargetPanel
          initial={editTarget}
          onEdit={handleEdit}
          onClose={() => setEditTarget(null)}
        />
      )}

      {historyTarget && (
        <HistoryModal name={historyTarget} onClose={() => setHistoryTarget(null)} theme={theme} />
      )}

      {showConfig && <ConfigModal onClose={() => setShowConfig(false)} />}
    </div>
  )
}
