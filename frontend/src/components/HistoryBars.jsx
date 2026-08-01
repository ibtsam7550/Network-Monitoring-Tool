export default function HistoryBars({ history = [], slots = 20 }) {
  const padded = Array(Math.max(0, slots - history.length))
    .fill(null)
    .concat(history)
    .slice(-slots)

  return (
    <div className="flex items-end gap-[3px] h-6" aria-hidden="true">
      {padded.map((entry, i) => {
        if (!entry) {
          return <div key={i} className="w-1.5 h-2 rounded-sm bg-slate-200 dark:bg-slate-700" />
        }
        const up = entry.status === 'UP'
        return (
          <div
            key={i}
            title={`${entry.status} · ${entry.time}`}
            className={`w-1.5 rounded-sm transition-all ${
              up ? 'h-6 bg-blue-400 dark:bg-blue-500' : 'h-3 bg-rose-400 dark:bg-rose-500'
            }`}
          />
        )
      })}
    </div>
  )
}
