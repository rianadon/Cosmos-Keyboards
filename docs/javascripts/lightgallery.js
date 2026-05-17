document$.subscribe(({ body }) => {
  const tobii = new Tobii({
    captionText(el) {
      let parent = el
      while (parent != document.body) {
        parent = parent.parentNode
        if (parent.nodeName == 'FIGURE') {
          const caption = parent.querySelector('figcaption')
          return caption ? caption.textContent : null
        }
      }
    },
  })
})
