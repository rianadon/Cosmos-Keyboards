/** Downloads a blob using a given filename */
export function download(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/** Guesses country/region based on timezone */
export function guessRegion() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return timeZone.split('/')[0]
}
