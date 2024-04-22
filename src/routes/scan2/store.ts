import { storable } from '$lib/store'
import { writable } from 'svelte/store'
import { INITIAL_STAT } from './lib/stats'

export const step = writable(0)
export const mmToPx = storable('mmToPx', 3.78) // 96/25.4, ie how css defines a mm
export const pc = writable<RTCPeerConnection | null>(null)
export const remoteStream = writable<{ stream: MediaStream } | null>(null)
export const stats = {
  Left: writable(INITIAL_STAT()),
  Right: writable(INITIAL_STAT()),
}
export const poseStats = {
  Left: writable(INITIAL_STAT()),
  Right: writable(INITIAL_STAT()),
}
export const debugImgs = writable<{ img: string; data: any }[]>([])
