import { guessRegion } from '$lib/browser'

// Skree first for visitors in America region
// TuKon first for visitors in Europe region
// Otherwise alternae the order every day
export const skreeFirst = guessRegion() == 'America'
  ? true
  : guessRegion() == 'Europe'
  ? false
  : !!(Math.floor(Date.now() / 1000 / 3600 / 24) % 2)
