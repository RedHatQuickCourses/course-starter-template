;(function () {
  'use strict'

  var WPM = 200
  var MEDIA_TIMEOUT_MS = 3000
  var SELECTORS_TO_STRIP =
    '.listingblock, .literalblock, table, script, style, .tabs, nav.pagination, .source-toolbox'
  var MEDIA_ROLE_RE = /media-seconds-(\d+)/

  function countWords (text) {
    if (!text || !text.trim()) return 0
    return text.trim().split(/\s+/).length
  }

  function wordsToSeconds (words) {
    if (words <= 0) return 0
    return Math.round((words / WPM) * 60)
  }

  function formatDuration (totalSeconds) {
    totalSeconds = Math.max(1, Math.round(totalSeconds))
    var mins = Math.floor(totalSeconds / 60)
    var secs = totalSeconds % 60
    if (mins === 0) return secs + ' sec'
    if (secs === 0) return mins + ' min'
    return mins + ' min ' + secs + ' sec'
  }

  function isInsideStripped (el, article) {
    return SELECTORS_TO_STRIP.split(', ').some(function (sel) {
      var block = el.closest(sel)
      return block && article.contains(block)
    })
  }

  function parseManualSeconds (block) {
    if (!block) return null
    var match = block.className.match(MEDIA_ROLE_RE)
    if (match) return parseInt(match[1], 10)
    var dataEl = block.querySelector('[data-media-duration]')
    if (dataEl) {
      var val = parseInt(dataEl.getAttribute('data-media-duration'), 10)
      if (!isNaN(val) && val > 0) return val
    }
    return null
  }

  function getClipSeconds (mediaEl) {
    var endAttr = mediaEl.getAttribute('end')
    if (endAttr != null && endAttr !== '') {
      var startAttr = parseFloat(mediaEl.getAttribute('start')) || 0
      var endVal = parseFloat(endAttr)
      if (!isNaN(endVal) && endVal > startAttr) {
        return Math.round(endVal - startAttr)
      }
    }

    var src = mediaEl.getAttribute('src') || ''
    var fragment = src.match(/#t=([^&]+)/)
    if (!fragment) return null

    var parts = fragment[1].split(',')
    if (parts.length === 2) {
      var fragStart = parts[0] ? parseFloat(parts[0]) : 0
      var fragEnd = parts[1] ? parseFloat(parts[1]) : null
      if (fragEnd != null && !isNaN(fragEnd) && fragEnd > fragStart) {
        return Math.round(fragEnd - fragStart)
      }
    }

    return null
  }

  function getMetadataSeconds (mediaEl) {
    if (!mediaEl.duration || !isFinite(mediaEl.duration)) return null
    var start = parseFloat(mediaEl.getAttribute('start')) || 0
    return Math.max(0, Math.round(mediaEl.duration - start))
  }

  function resolveMediaElement (mediaEl) {
    var block = mediaEl.closest('.audioblock, .videoblock')
    var manual = parseManualSeconds(block)
    if (manual != null) return Promise.resolve(manual)

    var clip = getClipSeconds(mediaEl)
    if (clip != null) return Promise.resolve(clip)

    var meta = getMetadataSeconds(mediaEl)
    if (meta != null) return Promise.resolve(meta)

    return new Promise(function (resolve) {
      var settled = false
      function finish (value) {
        if (settled) return
        settled = true
        resolve(value)
      }

      var timeout = setTimeout(function () {
        finish(0)
      }, MEDIA_TIMEOUT_MS)

      function onReady () {
        clearTimeout(timeout)
        finish(getMetadataSeconds(mediaEl) || 0)
      }

      if (mediaEl.readyState >= 1) {
        onReady()
        return
      }

      mediaEl.addEventListener('loadedmetadata', onReady, { once: true })
      mediaEl.addEventListener('error', function () {
        clearTimeout(timeout)
        finish(0)
      }, { once: true })
    })
  }

  function resolveIframeBlock (block) {
    var manual = parseManualSeconds(block)
    return Promise.resolve(manual != null ? manual : 0)
  }

  function collectMediaPromises (article) {
    var promises = []

    article.querySelectorAll('audio, video').forEach(function (el) {
      if (isInsideStripped(el, article)) return
      promises.push(resolveMediaElement(el))
    })

    article.querySelectorAll('.videoblock').forEach(function (block) {
      if (isInsideStripped(block, article)) return
      if (block.querySelector('video')) return
      if (!block.querySelector('iframe')) return
      promises.push(resolveIframeBlock(block))
    })

    return promises
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

    var textSeconds = wordsToSeconds(countWords(clone.innerText || ''))

    var p = document.createElement('p')
    p.className = 'reading-time'
    p.setAttribute('role', 'status')
    p.setAttribute('aria-live', 'polite')
    p.textContent = 'Estimated time: …'

    if (h1) {
      h1.insertAdjacentElement('afterend', p)
    } else {
      article.insertBefore(p, article.firstChild)
    }

    var mediaPromises = collectMediaPromises(article)

    Promise.all(mediaPromises).then(function (mediaSeconds) {
      var mediaTotal = mediaSeconds.reduce(function (sum, n) {
        return sum + n
      }, 0)
      var totalSeconds = textSeconds + mediaTotal
      p.textContent = 'Estimated time: ' + formatDuration(totalSeconds)
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
