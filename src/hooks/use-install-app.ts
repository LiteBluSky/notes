import { useEffect, useState } from 'react'

// Chrome/Edge/Android fire this when the app can be installed; we keep the
// event to show the browser's install prompt from our own menu item.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Chrome fires this once per page load, usually before React has hydrated,
// so catch it as soon as this module loads and hand it to the hook later.
let deferredPrompt: InstallPromptEvent | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as InstallPromptEvent
  })
}

export type InstallState =
  /** Already running as an installed app. */
  | 'installed'
  /** The browser offered an install prompt. */
  | 'prompt'
  /** iPhone/iPad: no prompt, only Share → Add to Home Screen. */
  | 'ios'
  /** Not offered (e.g. plain http on the LAN, or an unsupported browser). */
  | 'manual'

export function useInstallApp() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null)
  const [state, setState] = useState<InstallState>('manual')

  useEffect(() => {
    if (
      matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone
    ) {
      setState('installed')
      return
    }
    // iPadOS reports itself as a Mac, but with touch.
    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    if (ios) setState('ios')

    // Already caught before hydration.
    if (deferredPrompt) {
      setEvent(deferredPrompt)
      setState('prompt')
    }
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallPromptEvent)
      setState('prompt')
    }
    const onInstalled = () => {
      deferredPrompt = null
      setEvent(null)
      setState('installed')
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  /** Shows the browser's prompt; resolves to whether it was accepted. */
  const install = async () => {
    if (!event) return false
    await event.prompt()
    const { outcome } = await event.userChoice
    // A prompt can only be shown once; Chrome fires a new event if allowed.
    deferredPrompt = null
    setEvent(null)
    if (outcome === 'accepted') setState('installed')
    return outcome === 'accepted'
  }

  return { state, install }
}

// Registered in production builds only, so dev never serves stale modules.
// Needs a secure context: https, or http://localhost.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Not available (e.g. plain http on the LAN) — the app works without it.
  })
}
