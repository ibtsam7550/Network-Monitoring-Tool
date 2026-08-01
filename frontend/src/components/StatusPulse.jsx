export default function StatusPulse({ isUp, size = 'md' }) {
  const dims = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'
  const color =
    isUp === true ? 'bg-emerald-500' : isUp === false ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'

  return (
    <span className="relative inline-flex items-center justify-center">
      {isUp === true && (
        <span
          className={`absolute inline-flex ${dims} rounded-full bg-emerald-400 animate-pulse-ring`}
        />
      )}
      {isUp === false && (
        <span
          className={`absolute inline-flex ${dims} rounded-full bg-rose-400 animate-pulse-ring`}
        />
      )}
      <span className={`relative inline-flex ${dims} rounded-full ${color}`} />
    </span>
  )
}
