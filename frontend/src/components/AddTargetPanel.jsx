import { useState } from 'react'
import { X } from 'lucide-react'

const PROTOCOLS = ['tcp', 'udp', 'http', 'https', 'icmp']

export default function AddTargetPanel({ onAdd, onEdit, onClose, initial = null }) {
  const isEditMode = !!initial
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    host: initial?.host ?? '',
    port: initial?.port ?? '',
    protocol: initial?.protocol ?? 'tcp',
    description: initial?.description ?? '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const needsPort = form.protocol !== 'icmp'

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim() || !form.host.trim()) {
      setError('Name and host are required.')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name: form.name.trim(),
        host: form.host.trim(),
        port: form.port ? Number(form.port) : null,
        protocol: form.protocol,
        description: form.description.trim(),
      }
      if (isEditMode) {
        await onEdit(initial.name, payload)
      } else {
        await onAdd(payload)
      }
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-slate-900/30 dark:bg-black/60 backdrop-blur-sm">
      <div className="h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-xl p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-lg font-bold text-slate-800 dark:text-slate-100">
            {isEditMode ? 'Edit target' : 'Add target'}
          </h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-1.5">
              Name
            </label>
            <input
              value={form.name}
              onChange={update('name')}
              placeholder="e.g. Sector-A Router"
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-1.5">
              Host / IP
            </label>
            <input
              value={form.host}
              onChange={update('host')}
              placeholder="192.168.1.1"
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-1.5">
                Protocol
              </label>
              <select
                value={form.protocol}
                onChange={update('protocol')}
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 outline-none"
              >
                {PROTOCOLS.map((p) => (
                  <option key={p} value={p}>
                    {p.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-1.5">
                Port {!needsPort && <span className="text-slate-300 dark:text-slate-600">(n/a)</span>}
              </label>
              <input
                value={form.port}
                onChange={update('port')}
                disabled={!needsPort}
                placeholder="80"
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 outline-none disabled:opacity-40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-1.5">
              Description <span className="text-slate-300 dark:text-slate-600 normal-case">(optional)</span>
            </label>
            <input
              value={form.description}
              onChange={update('description')}
              placeholder="What is this device?"
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 outline-none"
            />
          </div>

          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-blue-600 text-white font-semibold text-sm py-3 hover:bg-blue-700 shadow-sm shadow-blue-600/30 transition-colors disabled:opacity-50"
          >
            {submitting
              ? isEditMode
                ? 'Saving…'
                : 'Adding…'
              : isEditMode
                ? 'Save changes'
                : 'Add target'}
          </button>
        </form>
      </div>
    </div>
  )
}
