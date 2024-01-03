const keyParameters: { u: number; row: number }[] = [
  { u: 1, row: 4 },
  { u: 1, row: 3 },
  { u: 1, row: 2 },
  { u: 1, row: 3.14159 }, // Deep dish key
  { u: 1, row: 5 },
  { u: 1, row: 1 },
  { u: 1.25, row: 5 },
  { u: 1.25, row: 4 },
  { u: 1.25, row: 3 },
  { u: 1.25, row: 2 },
  { u: 1.25, row: 1 },
  { u: 1.5, row: 5 },
  { u: 1.5, row: 4 },
  { u: 1.5, row: 3 },
  { u: 1.5, row: 2 },
  { u: 1.5, row: 1 },
  { u: 1.75, row: 5 },
  { u: 1.75, row: 4 },
  { u: 1.75, row: 3 },
  { u: 1.75, row: 2 },
  { u: 1.75, row: 1 },
  { u: 2, row: 5 },
  { u: 2, row: 4 },
  { u: 2, row: 3 },
  { u: 2, row: 2 },
  { u: 2, row: 1 },
]

export const psuedoKeyId = (u_: number, row_: number) => {
  if (row_ == 0) row_ = 1
  let idx = keyParameters.findIndex(({ u, row }) => u == u_ && row == row_)
  if (idx < 0) throw new Error(`Could not find key in parameters, u=${u_}, r=${row_}`)
  return idx
}

export const pseudoFiles: Record<string, string> = {
  'des': 'MX_DES_Standard.scad',
}

export const pseudoMirror = (u: number, row: number) => {
  if (row <= 1) return 'mirror([0,1,0])'
  return 'mirror([0,0,0])'
}
