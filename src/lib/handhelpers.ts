import type { Joints } from '../routes/beta/lib/hand'

export interface HandData {
  version: number
  left: Joints
  right: Joints
  time: string
}

export function readHands(): HandData | undefined {
  try {
    const json = localStorage.getItem('cosmosHands')
    const parsed = JSON.parse(json!)[0] as HandData
    Object.values(parsed.left).forEach((js) => {
      js.forEach((j) => {
        if (parsed.version >= 2) j.length /= 1000
      })
    })
    Object.values(parsed.right).forEach((js) => {
      js.forEach((j) => {
        if (parsed.version >= 2) j.length /= 1000
      })
    })
    return parsed
  } catch (e) {
    return undefined
  }
}
