import { useEffect, useState } from 'react'
import { X, Settings as SettingsIcon, Bell, Eye, EyeOff, Check, Loader2 } from 'lucide-react'
import { api } from '../api.js'

const TABS = [
  { key: 'monitoring', label: 'Monitoring', icon: SettingsIcon },
  { key: 'notifications', label: 'Notifications', icon: Bell },
]

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

const inputClass =
  'w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 outline-none'

function SaveBar({ saving, saved, error, onSave, label = 'Save changes' }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="rounded-full bg-blue-600 text-white font-semibold text-sm px-5 py-2.5 hover:bg-blue-700 shadow-sm shadow-blue-600/30 transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {saving && <Loader2 size={14} className="animate-spin" />}
        {saving ? 'Saving…' : label}
      </button>
      {saved && !saving && (
        <span className="text-sm text-emerald-500 dark:text-emerald-400 flex items-center gap-1">
          <Check size={14} /> Saved
        </span>
      )}
      {error && <span className="text-sm text-rose-600 dark:text-rose-400">{error}</span>}
    </div>
  )
}

export default function ConfigModal({ onClose }) {
  const [tab, setTab] = useState('monitoring')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [settings, setSettings] = useState(null)
  const [notifications, setNotifications] = useState(null)
  const [toText, setToText] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [savingSettings, setSavingSettings] = useState(false)
  const [savedSettings, setSavedSettings] = useState(false)
  const [settingsError, setSettingsError] = useState('')

  const [savingNotif, setSavingNotif] = useState(false)
  const [savedNotif, setSavedNotif] = useState(false)
  const [notifError, setNotifError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([api.getFullSettings(), api.getNotifications()])
      .then(([s, n]) => {
        if (cancelled) return
        setSettings(s)
        setNotifications(n)
        setToText((n.email?.to || []).join(', '))
      })
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const updateSetting = (key) => (e) => {
    const raw = e.target.value
    const isNumeric = ['check_interval', 'timeout', 'retries', 'retry_delay', 'dashboard_port'].includes(key)
    setSettings({ ...settings, [key]: isNumeric ? Number(raw) : raw })
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    setSettingsError('')
    setSavedSettings(false)
    try {
      const updated = await api.updateFullSettings(settings)
      setSettings(updated)
      setSavedSettings(true)
      setTimeout(() => setSavedSettings(false), 2500)
    } catch (err) {
      setSettingsError(err.message)
    } finally {
      setSavingSettings(false)
    }
  }

  const updateEmail = (key) => (e) => {
    const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value
    setNotifications({ ...notifications, email: { ...notifications.email, [key]: value } })
  }

  const updateWebhook = (key) => (e) => {
    setNotifications({ ...notifications, webhook: { ...notifications.webhook, [key]: e.target.value } })
  }

  const saveNotifications = async () => {
    setSavingNotif(true)
    setNotifError('')
    setSavedNotif(false)
    try {
      const to = toText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const payload = { ...notifications, email: { ...notifications.email, to } }
      const updated = await api.updateNotifications(payload)
      setNotifications(updated)
      setToText((updated.email?.to || []).join(', '))
      setSavedNotif(true)
      setTimeout(() => setSavedNotif(false), 2500)
    } catch (err) {
      setNotifError(err.message)
    } finally {
      setSavingNotif(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-xl">
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-display text-lg font-bold text-slate-800 dark:text-slate-100">Configuration</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex items-center gap-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-1 w-fit">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  tab === key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {loadError && (
          <div className="mx-6 mt-4 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
            {loadError}
          </div>
        )}

        {loading && !loadError && (
          <div className="px-6 py-16 text-center text-slate-400 dark:text-slate-500 text-sm">
            Loading configuration…
          </div>
        )}

        {!loading && settings && tab === 'monitoring' && (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Check interval (seconds)" hint="How often every target is checked. Applies live.">
                <input
                  type="number"
                  min={5}
                  value={settings.check_interval}
                  onChange={updateSetting('check_interval')}
                  className={inputClass}
                />
              </Field>
              <Field label="Timeout (seconds)" hint="Per-attempt timeout. Applies live.">
                <input
                  type="number"
                  min={1}
                  value={settings.timeout}
                  onChange={updateSetting('timeout')}
                  className={inputClass}
                />
              </Field>
              <Field label="Retries" hint="Attempts before marking a target down.">
                <input
                  type="number"
                  min={1}
                  value={settings.retries}
                  onChange={updateSetting('retries')}
                  className={inputClass}
                />
              </Field>
              <Field label="Retry delay (seconds)" hint="Wait time between retry attempts.">
                <input
                  type="number"
                  min={0}
                  value={settings.retry_delay}
                  onChange={updateSetting('retry_delay')}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Log file path" hint="Requires restart to take effect.">
                <input
                  value={settings.log_file}
                  onChange={updateSetting('log_file')}
                  className={`${inputClass} font-mono`}
                />
              </Field>
              <Field label="Report file path" hint="Requires restart to take effect.">
                <input
                  value={settings.report_file}
                  onChange={updateSetting('report_file')}
                  className={`${inputClass} font-mono`}
                />
              </Field>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 px-4 py-3 space-y-3">
              <Toggle
                checked={!!settings.enable_web_dashboard}
                onChange={(v) => setSettings({ ...settings, enable_web_dashboard: v })}
                label="Enable web dashboard"
              />
              <div className="grid grid-cols-2 gap-4 pt-1">
                <Field label="Dashboard port" hint="Requires restart to take effect.">
                  <input
                    type="number"
                    value={settings.dashboard_port}
                    onChange={updateSetting('dashboard_port')}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>

            <SaveBar saving={savingSettings} saved={savedSettings} error={settingsError} onSave={saveSettings} />
          </div>
        )}

        {!loading && notifications && tab === 'notifications' && (
          <div className="p-6 space-y-6">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 px-4 py-3">
              <Toggle
                checked={!!notifications.console.enabled}
                onChange={(v) =>
                  setNotifications({ ...notifications, console: { ...notifications.console, enabled: v } })
                }
                label="Console alerts"
              />
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 px-4 py-3 space-y-4">
              <Toggle
                checked={!!notifications.email.enabled}
                onChange={(v) =>
                  setNotifications({ ...notifications, email: { ...notifications.email, enabled: v } })
                }
                label="Email alerts"
              />
              <div className="grid grid-cols-2 gap-4">
                <Field label="SMTP server">
                  <input
                    value={notifications.email.smtp_server}
                    onChange={updateEmail('smtp_server')}
                    className={`${inputClass} font-mono`}
                  />
                </Field>
                <Field label="SMTP port">
                  <input
                    type="number"
                    value={notifications.email.smtp_port}
                    onChange={updateEmail('smtp_port')}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Username">
                  <input
                    value={notifications.email.username}
                    onChange={updateEmail('username')}
                    className={inputClass}
                  />
                </Field>
                <Field label="Password">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={notifications.email.password}
                      onChange={updateEmail('password')}
                      className={`${inputClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </Field>
              </div>
              <Field label="From address">
                <input
                  value={notifications.email.from}
                  onChange={updateEmail('from')}
                  className={inputClass}
                />
              </Field>
              <Field label="To addresses" hint="Comma-separated list of recipients.">
                <input
                  value={toText}
                  onChange={(e) => setToText(e.target.value)}
                  placeholder="you@example.com, ops@example.com"
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 px-4 py-3 space-y-4">
              <Toggle
                checked={!!notifications.webhook.enabled}
                onChange={(v) =>
                  setNotifications({ ...notifications, webhook: { ...notifications.webhook, enabled: v } })
                }
                label="Webhook alerts"
              />
              <Field label="Webhook URL" hint="e.g. a Slack incoming webhook URL.">
                <input
                  value={notifications.webhook.url}
                  onChange={updateWebhook('url')}
                  className={`${inputClass} font-mono`}
                />
              </Field>
            </div>

            <SaveBar saving={savingNotif} saved={savedNotif} error={notifError} onSave={saveNotifications} />
          </div>
        )}
      </div>
    </div>
  )
}
