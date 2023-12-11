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
export const noWall = search.includes('NoWall')
export const intersection = search.includes('Intersection')
export const timing = search.includes('Timing')
export const fast = search.includes('Fast')
export const theme = search.includes('Theme')
export const glb = search.includes('glb')
