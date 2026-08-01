export default function StatCard({ label, value, icon: Icon, iconGradient, valueColor, blobColor }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-sm shadow-slate-200/60 dark:shadow-black/20 px-6 py-5">
      <div
        aria-hidden="true"
        className={`absolute -top-6 -right-6 h-24 w-24 rounded-full opacity-70 dark:opacity-20 ${blobColor}`}
      />
      <div className="relative">
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-sm mb-4 bg-gradient-to-br ${iconGradient}`}
        >
          {Icon && <Icon size={18} strokeWidth={2.25} />}
        </div>
        <p className="text-[11px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold">
          {label}
        </p>
        <p className={`mt-1.5 font-display text-3xl font-bold ${valueColor}`}>{value}</p>
      </div>
    </div>
  )
}
