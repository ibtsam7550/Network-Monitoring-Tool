import { useEffect, useRef, useState } from 'react'

/**
 * Keeps a live-ticking "now" that's corrected for the offset between the
 * browser clock and the backend server clock, plus a countdown to the
 * next scheduled check cycle.
 */
export function useServerClock(serverTime, nextCheckAt) {
  const offsetRef = useRef(0)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    if (serverTime) {
      offsetRef.current = new Date(serverTime).getTime() - Date.now()
    }
  }, [serverTime])

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date(Date.now() + offsetRef.current))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  let secondsToNextCheck = null
  if (nextCheckAt) {
    secondsToNextCheck = Math.max(
      0,
      Math.round((new Date(nextCheckAt).getTime() - now.getTime()) / 1000),
    )
  }

  return { now, secondsToNextCheck }
}
