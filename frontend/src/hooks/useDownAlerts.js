import { useEffect, useRef, useState } from 'react'

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 740
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.45)
  } catch {
    // Audio not available — fail silently.
  }
}

export function useDownAlerts(targets) {
  const [enabled, setEnabled] = useState(false)
  const prevRef = useRef({})

  const toggle = async () => {
    if (!enabled && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    setEnabled((v) => !v)
  }

  useEffect(() => {
    if (!targets || targets.length === 0) return
    const prev = prevRef.current
    const newlyDown = []

    for (const t of targets) {
      const prevUp = prev[t.name]
      if (prevUp !== false && t.is_up === false) {
        newlyDown.push(t)
      }
      prev[t.name] = t.is_up
    }
    prevRef.current = prev

    if (enabled && newlyDown.length > 0) {
      beep()
      if ('Notification' in window && Notification.permission === 'granted') {
        const names = newlyDown.map((t) => t.name).join(', ')
        new Notification('Device down', {
          body: newlyDown.length === 1 ? `${names} stopped responding.` : `${newlyDown.length} devices went down: ${names}`,
        })
      }
    }
  }, [targets, enabled])

  return { enabled, toggle }
}
