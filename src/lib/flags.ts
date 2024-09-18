let search: string[] = []
try {
  search = document.location.search.substring(1).replace('/', '').split(',')
} catch {
  // Do nothing
}

export const hand = true
export const login = true
export const performance = search.includes('Performance')
export const board = true
export const boardView = true
export const intersection = search.includes('Intersection')
export const fast = search.includes('Fast')
export const theme = true
export const glb = search.includes('glb')
export const fitToHand = search.includes('FitToHand')
export const noUMR = search.includes('NoUMR')
export const rtcb = search.includes('rtcb')
export const draftuc = search.includes('draftuc')
