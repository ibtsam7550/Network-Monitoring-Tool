const BASE_URL = import.meta.env.VITE_API_URL || ''

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed: ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  getStatus: () => request('/api/status'),
  getSettings: () => request('/api/settings'),
  addTarget: (target) =>
    request('/api/targets', { method: 'POST', body: JSON.stringify(target) }),
  updateTarget: (name, target) =>
    request(`/api/targets/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(target),
    }),
  removeTarget: (name) =>
    request(`/api/targets/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  getHistory: (name) => request(`/api/targets/${encodeURIComponent(name)}/history`),
  historyExportUrl: (name) =>
    `${BASE_URL}/api/targets/${encodeURIComponent(name)}/history/export`,
  fullExportUrl: () => `${BASE_URL}/api/export`,

  // Full config.yml exposed for editing in the UI
  getFullSettings: () => request('/api/config/settings'),
  updateFullSettings: (settings) =>
    request('/api/config/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  getNotifications: () => request('/api/config/notifications'),
  updateNotifications: (notifications) =>
    request('/api/config/notifications', {
      method: 'PUT',
      body: JSON.stringify(notifications),
    }),
}
