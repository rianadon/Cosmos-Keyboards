import { browser } from '$app/environment'
import type { CuttleformProto } from '$lib/worker/config'
import { type Writable, writable } from 'svelte/store'
import type { User } from './login'

export const protoConfig = writable<CuttleformProto>(undefined)
export const transformMode = writable<'translate' | 'rotate' | 'select'>('select')
export const flip = writable(false)
export const user = writable<User>({ success: false, sponsor: undefined })
export const codeError = writable<Error | null>(null)

export const hoveredKey = writable<number | null>(null)
export const clickedKey = writable<number | null>(null)

// Preferences
export const theme = storable('theme', 'purple')
export const showHand = storable('showHand', true)
export const bomMultiplier = storable('bomMultiplier', '2')
export const stiltsMsg = storable('stiltsMsg', true)

/** A Svelte store that writes and reads from localStorage. */
function storable<T>(name: string, data: T): Writable<T> {
  const store = writable(data)
  const storageName = 'cosmos.prefs.' + name

  if (browser && localStorage[storageName]) {
    store.set(JSON.parse(localStorage[storageName]))
  }

  return {
    subscribe: store.subscribe,
    set: n => {
      if (browser) localStorage[storageName] = JSON.stringify(n)
      store.set(n)
    },
    update: (callback) => {
      store.update(value => {
        const newValue = callback(value)
        if (browser) localStorage[storageName] = JSON.stringify(newValue)
        return newValue
      })
    },
  }
}
