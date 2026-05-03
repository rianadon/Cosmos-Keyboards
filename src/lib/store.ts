import { browser } from '$app/environment'
import type { CosmosKeyboard } from '$lib/worker/config.cosmos'
import { derived, type Readable, type Writable, writable } from 'svelte/store'
import type { User } from '../routes/beta/lib/login'
import type { ColorScheme } from './3d/materials'
import type { ConfErrors } from './worker/check'

export type TempConfig = CosmosKeyboard & { fromProto: boolean }

export const protoConfig = writable<CosmosKeyboard>(undefined)
export const tempConfig = writable<TempConfig>(undefined)
export const confError = writable<ConfErrors>([])
export const showErrorMsg = writable<boolean>(false)
protoConfig.subscribe(c => tempConfig.set(c ? { ...c, fromProto: true } : c))
export const transformMode = writable<'translate' | 'rotate' | 'select'>('select')
export const selectMode = writable<'key' | 'column' | 'cluster'>('key')
export const user = writable<User>({ success: false, sponsor: undefined })
export const codeError = writable<Error | null>(null)
export const openSelect = writable<symbol | null>(null)

export const hoveredKey = writable<number | null>(null)
export const clickedKey = writable<number | null>(null)
/** Which visual half the user clicked, regardless of which cluster the click
 *  resolves to in storage. In mirror form (only the right cluster is stored)
 *  `clickedKey` resolves to a right-cluster key for either side, so the editor
 *  needs this hint to flip its Letter input through the layout's flipMap when
 *  the user is editing a left-side virtual key. Distinct from
 *  `Viewer3D`'s local `clickedSide` (which reports the *resolved* cluster's
 *  side via nthKey). */
export const clickedVisualSide = writable<'left' | 'right' | 'unibody' | null>(null)
export const lastKeycap = writable<number>(0)

// --- Alerts -----------------------------------------------------------------
//
// A lightweight popover-alert system: callers `pushAlert({ message, anchor })`
// from anywhere; `Alert.svelte` (mounted once in App.svelte) renders a
// dismissible popover next to the anchor element with a 10s auto-dismiss
// timer and a progress bar. Used by the layout dropdown to surface "missing
// keys" warnings and "you've switched to Custom" hints without blocking the
// page with a modal dialog.

export interface AlertItem {
  id: symbol
  message: string
  /** DOM element to anchor the popover next to (typically the Field that
   *  triggered the alert). null disables anchoring (centered fallback). */
  anchor: HTMLElement | null
  variant?: 'info' | 'warn' | 'error'
  /** Auto-dismiss after this many ms. Default 10000. Pass 0 to disable. */
  durationMs?: number
}

export const alerts = writable<AlertItem[]>([])

export function pushAlert(a: Omit<AlertItem, 'id'>): symbol {
  const id = Symbol()
  alerts.update(xs => [...xs, { id, durationMs: 10000, variant: 'info', ...a }])
  return id
}

export function dismissAlert(id: symbol) {
  alerts.update(xs => xs.filter(a => a.id !== id))
}

export const showGrid = writable(false)
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
export const showHelp = storable('showHelp', true)
export const assemblyIsNew = storable('assemblyIsNew', true)
export const showScheduleEmail = storable('showScheduleEmail', false)
export const emailScheduled = storable('emailScheduled', false)
export const emailMinimized = storable('emailMinimized', 0)

export const developer = storable('developer', browser && location.origin.includes('localhost'))
export const showTiming = andcondition(developer, storable('developer.timing', false))
export const showKeyInts = andcondition(developer, storable('developer.showKeyInts', false))
export const showGizmo = andcondition(developer, storable('developer.showGizmo', false))
export const debugViewport = andcondition(developer, storable('developer.debugViewport', false))
export const noStitch = andcondition(developer, storable('developer.noStitch', false))

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
