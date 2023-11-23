async function post(url: string, body: any) {
  try {
    await (await fetch('https://analytics.ryanis.cool' + url, {
      method: 'POST',
      body: JSON.stringify(body),
    })).text()
  } catch (e) {
    console.log(e)
  }
}

export function trackPageView() {
  return post('/', {
    url: window.location.href,
    language: window.navigator.language,
    referrer: document.referrer,
  })
}

export function trackEvent(event: string, keys: Record<string, string | number>) {
  const entries = Object.entries(keys)
  return post('/event', {
    url: window.location.href,
    event,
    strings: Object.fromEntries(entries.filter(([_, v]) => typeof v == 'string')),
    numbers: Object.fromEntries(entries.filter(([_, v]) => typeof v == 'number')),
  })
}
