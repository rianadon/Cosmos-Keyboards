type Keyboard = {
  author: string
  name?: string
  config: string
  details?: string
}

const images: Record<string, { default: string }> = import.meta.glob(['./assets/*.jpg', '$target/media/kbd-*.jpg'], { query: '?url', eager: true })

// Generate the IDs with `openssl rand -hex 4`
const _keyboards: Record<string, Keyboard> = {
  '8f80172e': {
    author: 'TheBigSkree',
    config:
      '#cf:ChYIBBAGWAAYACAFKNIBMLsBUABAAEgBWmMKEQjbjdSk0DEQrZHcjcGThuQBEhAIlIPw8wIQwpmglZC8geQBEhAInonwiAMQ7pXQ7/DYg+QBEhEIj4XQjOAEEKydtLygvYDkARIXCJHEl4CsgAEQop2Il6CwgOQBGKIDIChCUwgA4AEBeAbYAQEQAUgASABIAEgASABIAEgAYAFoAHABGAAgACgAmAH0A6gB6AegAcgBsAEAkAGEB7gBAIABADAAOChYAYgBAcABAMgB2ATQAYQH',
  },
  'b9a37e44': {
    author: 'fata1err0r',
    name: 'tamatama',
    config:
      '#expert:eJzlWVtv6jgQfudXWLwsewSBcOkF6by0uytVq56uTjlPVR9M4hSrwYlsB0or/vvO2CFXStujniXSooo647E98818k2TwIqE0iWLNYTAlN3ZAvpKXFiFrGoazBfceBVMwOe6mstuFjBKfi4cpGRgZmxfUdqJrLjLpX9TTkYQ55wxnH9nmgioOym1vEXltlClPsvWV8LnHQH43dJ1JlwxP8Xt04pzcZzqzTcxgoRkTLhSTOt/glj/j5PUoF11GidBMKi4ep0TLhOEMOCB85k/JyxYvvUgIZk1saylVuyTETX/cXsDcnD+Up8Bg9jQlPRelS+7JCKa0jMKQ4V5rumJqQSXryXg4GA96z0xGZoeAKs3EdXVFQENlDFyBW9yj4WXIqKTCA69G5mS8vkW/VO6NWrAwBF+IttjMAVxAlYQ8Trck29a21e+TbzezP6fErid9ohcs94WsuV6gkmAPVPMVA3RNOAg4QOKQeswnNNHRkhrTwo2D2lfCbGPO7FN/hcb6RNN5F+Vw9IqGCWyyZpJNcUEl0ucYYvcEv8dmODTfRmzC74L4HhdWUR+0Wp7JXy+RK6oTsNImbnZ9E1xGYbIUUzI0aVmY+B6t01xVMfUgmY0IDHJPS0K7AcpN6lLp4cHbVqv/5UuLfCE/FAuSkASAn2JawxpCic+DANwVBdNQF5UQqxhycYMsUA6I+6kXRnpZccVxnGyL7iuuTQrmzBYmVIKRRGEYIhJHiiOrzclJHDOZnUyu9G8KuKCpBt35xqhAWlovhE+e7CSsRm2YhV0gG1VYXPBMoiAA34u+mHP+hmP+MbZ8hZxak5lUQed3dMoe2RlCdO8GXYJ/93bo2qFJ2qKqW9Z0s2GumVnWSRWzSYMO+YMFXHBb4HaRKOCRGw9qD1AwpgQcuLsH4+9gewwG2REMjvIe50ABw2XIChVDYkKO2EsvTIDdWADSrVI1ZarTC5HU54nCpHTOuyD1kQiTAdlatV3EpmXU8OMYGt6Ia6olf+q8pOJ6ntiPl6ZIbwREyqTSpL4zHJQ+7lmqsM0OyxE9Q0YCpOUpQHF5semUg52p2MjNojWVvuqk0XMhZC6qGF9LoGa3AnOD8CjUrp1/sYwCHlaUUkeGu6sQ6GdAD9tGsv1QbH4B6G4F8p57AOGeueEN3o/xpwE42l0toiVqcKyu7Rqqi4aiOmgkqOMafrKh+DUzKeus9puB3+AjpAbkAL/e5NiUXnLfD1md07qZmB6i9LEgrRN62UzwmpiPdTavmwHeh27R9gmmNzw2myWAUueyaiaib3D5KIDWuRw0E7wmZmOdy6v/ELzyS3IdweFHCD0C/Fx8KTn6M7dxq85p0WBkDxH7eMDWqR03GMPPTc7W/XvbQHqRLOeFFpCPrRHQS5TtXwlG5dx0qLJ13awDZLs92P1RkLyELrHBWmz+mN1vJH/g4rXOz2B/O6eo0jsZ7O8OFZVGdR3TZKg0hHpj+xrTcyflGQCyEuBXwruvbtsQ7q7yFyxn0ioE9c1WSbHN4pzi85n9Z+JeccS1DoIXpqWFYc6bn1GQB3eX2U4lLNX+4t6O6J4mY7lTmjdFz/d0UIemP1o49FAr7Sd5PqnxnLQrNdUcXSJ/znZr1v7u3SHuv52+B9SKCXxYLcvhtwpOOaY//WaVZmeBuO8vyrUwpQH6/4L+zkfgV0DHKm65s5Zc6e9M6Vdq6a+tYp9cw96GvbDHGF9Su2QMZY49xZHUeIeiSah3v4mkv1ii1RWUUIT9/Cm5A730rt7Nwqbuu1Cc/gXKJPH1',
    details: 'https://github.com/dlip/tamatama',
  },
  '1afd1ac9': {
    author: 'jonas_h',
  },
  '7a01d710': {
    name: 'Cosmic Sushi',
    author: 'Lily',
    config:
      '#expert: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',
  },
  '4d3652f2': {
    name: 'Spidermo Special V1',
    author: 'spidermo',
    config:
      '#expert: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',
  },
  'de79d260': {
    author: 'umang',
    config:
      '#cf:ChYIBBAGWAAYBSAEKNMBMMgBUAFAAEgAEg8I6AIY2BMg7Ako6AIwvA9acgoRCMuLhKTQMRCtkdyNwZOG5AESEAiEg4DjAxC/w5iG8tSW1gISEAiwiejIGRD7nbiG0tKW1gISEQiYh8yd0H0Q8pfArJDQgv0BEhMIpoWYnsD7gAEQ9auIlrD8jOQBEhEIq4O8lrBQENCdkNfR1oD9AUJKCAN4ChABSABIAEgASABIAEgASABIAEgASABgAGgAcAEYASABKACYAfQDqAHoB6AByAGwAQCQAYQHuAEAgAEUMAA4PFAAWDyIAQE=',
  },
}

export const keyboards = Object.entries(_keyboards).map(([key, kbd]) => ({
  ...kbd,
  key,
  name: kbd.name || `${kbd.author}'s Keyboard`,
  image: images[`/target/media/kbd-${kbd.author.toLowerCase()}.thumb.jpg`]?.default
    || images[`/src/routes/showcase/assets/kbd-${kbd.author.toLowerCase()}.jpg`]?.default,
  largeImage: images[`/target/media/kbd-${kbd.author.toLowerCase()}.jpg`]?.default
    || images[`/src/routes/showcase/assets/kbd-${kbd.author.toLowerCase()}.jpg`]?.default,
  authorImage: images[`/src/routes/showcase/assets/author-${kbd.author.toLowerCase()}.jpg`]?.default,
}))

// https://stackoverflow.com/a/47593316
// I need an efficent RNG with a configurable seed
function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

/** Shuffles an array randomly */
function fisherYates<T>(array: T[], rand: () => number) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
}

// Shuffle the list of keyboards so no one gets preference. The order changes once every day.
const daysSinceEpoch = Math.floor(Date.now() / 1000 / 3600 / 24)
fisherYates(keyboards, mulberry32(daysSinceEpoch))
