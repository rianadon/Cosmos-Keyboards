import { browser } from '$app/environment'
import type { CosmosKeyboard } from '$lib/worker/config.cosmos'
import { derived, type Readable, type Writable, writable } from 'svelte/store'
import type { User } from '../routes/beta/lib/login'
import type { ColorScheme } from './3d/materials'
import type { ConfError } from './worker/check'

export type TempConfig = CosmosKeyboard & { fromProto: boolean }

export const protoConfig = writable<CosmosKeyboard>(undefined)
export const tempConfig = writable<TempConfig>(undefined)
export const confError = writable<ConfError | undefined>(undefined)
protoConfig.subscribe(c => tempConfig.set(c ? { ...c, fromProto: true } : c))
export const transformMode = writable<'translate' | 'rotate' | 'select'>('select')
export const selectMode = writable<'key' | 'column' | 'cluster'>('key')
export const user = writable<User>({ success: false, sponsor: undefined })
export const codeError = writable<Error | null>(null)

export const hoveredKey = writable<number | null>(null)
export const clickedKey = writable<number | null>(null)

export const noWall = writable(false)
export const noBase = writable(false)
export const noBlanks = writable(false)
export const noLabels = writable(false)

// Preferences
export const theme = storable<ColorScheme>('theme', 'purple')
export const showHand = storable('showHand', true)
export const view = storable<'left' | 'right' | 'both'>('view', 'both')
export const bomMultiplier = storable('bomMultiplier', '2')
export const stiltsMsg = storable('stiltsMsg', true)
export const modelName = storable('modelName', 'cosmotyl')
export const discordMsg = storable('discordMsg', true)
export const enableUndo = storable('enableUndo', false)

export const developer = storable('developer', browser && location.origin.includes('localhost'))
export const showTiming = andcondition(developer, storable('developer.timing', false))
export const showKeyInts = andcondition(developer, storable('developer.showKeyInts', false))
export const showGizmo = andcondition(developer, storable('developer.showGizmo', false))
export const debugViewport = andcondition(developer, storable('developer.debugViewport', false))

/** A Svelte store that writes and reads from localStorage. */
export function storable<T>(name: string, data: T): Writable<T> {
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

/**
 * A Svelte store that returns the second store only when the condition store = true.
 * Otherwise takes on the ifNot value.
 * Writes are only possible when condition store = true.
 */
function conditional<T>(conditionStore: Readable<boolean>, dataStore: Writable<T>, ifNot: T): Writable<T> {
  let _cond: boolean = false

  const store = derived([conditionStore, dataStore], ([a, b]) => a ? b : ifNot)
  conditionStore.subscribe(c => _cond = c)

  return {
    subscribe: store.subscribe,
    set: n => _cond && dataStore.set(n),
    update: (callback) => _cond && dataStore.update(callback),
  }
}

/** Special case of conditional for booleans. Ands the two values. */
function andcondition(read: Readable<boolean>, write: Writable<boolean>) {
  return conditional(read, write, false)
}
