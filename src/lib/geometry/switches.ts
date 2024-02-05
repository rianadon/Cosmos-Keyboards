import type { CuttleKey } from '$lib/worker/config'

type Switch = CuttleKey['type']

interface SwInfo {
  height: number // Unpressed height of switch
  pressedHeight: number /// Pressed height of switch
}

export function switchInfo(sw: Switch | undefined): SwInfo {
  if (sw == 'mx-pcb') {
    return { height: 6.2, pressedHeight: 2.6 }
  }
  if (sw == 'box' || sw?.startsWith('mx') || sw?.startsWith('old-mx')) {
    return { height: 6.2, pressedHeight: 2.6 }
  }
  if (sw == 'choc') {
    return { height: 5, pressedHeight: 2 }
  }
  if (sw == 'alps') {
    return { height: 6, pressedHeight: 3.5 }
  }
  if (sw == 'trackball') {
    // box = pcb then chip
    return { height: 5, pressedHeight: 0 }
  }
  return { height: 5, pressedHeight: 0 }
}
