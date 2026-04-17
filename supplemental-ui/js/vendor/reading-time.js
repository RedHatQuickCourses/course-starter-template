;(function () {
  'use strict'

  var WPM = 200
  var SELECTORS_TO_STRIP =
    '.listingblock, .literalblock, table, script, style, .tabs, nav.pagination, .source-toolbox'

  function countWords (text) {
    if (!text || !text.trim()) return 0
    return text.trim().split(/\s+/).length
  }

  function estimateMinutes (words) {
    if (words <= 0) return 1
    return Math.max(1, Math.round(words / WPM))
  }

  function init () {
    var article = document.querySelector('article.doc')
    if (!article) return

    var clone = article.cloneNode(true)
    var h1 = article.querySelector('h1.page')
    clone.querySelectorAll('h1.page').forEach(function (el) {
      el.remove()
    })
    clone.querySelectorAll(SELECTORS_TO_STRIP).forEach(function (el) {
      el.remove()
    })

    var words = countWords(clone.innerText || '')
    var mins = estimateMinutes(words)

    var p = document.createElement('p')
    p.className = 'reading-time'
    p.setAttribute('role', 'status')
    p.setAttribute('aria-live', 'polite')
    p.textContent = 'Estimated reading time: ' + mins + ' min'

    if (h1) {
      h1.insertAdjacentElement('afterend', p)
    } else {
      article.insertBefore(p, article.firstChild)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
