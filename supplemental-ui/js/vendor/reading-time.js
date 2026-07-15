;(function () {
  'use strict'

  var WPM = 200
  var DEFAULT_IMAGE_SECONDS = 15
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
    var mins = Math.max(1, Math.round(totalSeconds / 60))
    if (mins < 60) return mins + ' min'
    var hrs = Math.floor(mins / 60)
    var rem = mins % 60
    if (rem === 0) return hrs + ' hr'
    return hrs + ' hr ' + rem + ' min'
  }

  function isInsideStripped (el, article) {
    return SELECTORS_TO_STRIP.split(', ').some(function (sel) {
      var block = el.closest(sel)
      return block && article.contains(block)
    })
  }

  function parseManualSeconds (block) {
    if (!block) return null
    var direct = block.getAttribute && block.getAttribute('data-media-duration')
    if (direct != null) {
      var directVal = parseInt(direct, 10)
      if (!isNaN(directVal) && directVal > 0) return directVal
    }
    var match = block.className && block.className.match(MEDIA_ROLE_RE)
    if (match) return parseInt(match[1], 10)
    var dataEl = block.querySelector('[data-media-duration]')
    if (dataEl) {
      var val = parseInt(dataEl.getAttribute('data-media-duration'), 10)
      if (!isNaN(val) && val > 0) return val
    }
    return null
  }

  function parseRoleSeconds (block) {
    if (!block || !block.className) return null
    var match = block.className.match(MEDIA_ROLE_RE)
    if (match) return parseInt(match[1], 10)
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

  function resolveIframeSeconds (iframeEl) {
    var direct = iframeEl.getAttribute('data-media-duration')
    if (direct != null) {
      var directVal = parseInt(direct, 10)
      if (!isNaN(directVal) && directVal > 0) return Promise.resolve(directVal)
    }

    var node = iframeEl.parentElement
    while (node) {
      var manual = parseManualSeconds(node)
      if (manual != null) return Promise.resolve(manual)
      node = node.parentElement
    }

    return Promise.resolve(0)
  }

  function pageHasAudio (article) {
    var found = false
    article.querySelectorAll('audio').forEach(function (el) {
      if (!isInsideStripped(el, article)) found = true
    })
    return found
  }

  function sumSeconds (values) {
    return values.reduce(function (sum, n) {
      return sum + n
    }, 0)
  }

  function collectAudioPromises (article) {
    var promises = []
    article.querySelectorAll('audio').forEach(function (el) {
      if (isInsideStripped(el, article)) return
      promises.push(resolveMediaElement(el))
    })
    return promises
  }

  function collectVideoPromises (article) {
    var promises = []
    article.querySelectorAll('video').forEach(function (el) {
      if (isInsideStripped(el, article)) return
      promises.push(resolveMediaElement(el))
    })
    article.querySelectorAll('iframe').forEach(function (el) {
      if (isInsideStripped(el, article)) return
      promises.push(resolveIframeSeconds(el))
    })
    return promises
  }

  function resolveImageSeconds (imgEl) {
    var direct = imgEl.getAttribute('data-media-duration')
    if (direct != null) {
      var directVal = parseInt(direct, 10)
      if (!isNaN(directVal) && directVal >= 0) return directVal
    }

    var imageblock = imgEl.closest('.imageblock')
    if (imageblock) {
      var manual = parseRoleSeconds(imageblock)
      if (manual != null) return manual
      return DEFAULT_IMAGE_SECONDS
    }

    var node = imgEl.parentElement
    while (node) {
      var ancestorManual = parseRoleSeconds(node)
      if (ancestorManual != null) return ancestorManual
      node = node.parentElement
    }

    return 0
  }

  function collectImageSeconds (article) {
    var total = 0
    article.querySelectorAll('img').forEach(function (el) {
      if (isInsideStripped(el, article)) return
      total += resolveImageSeconds(el)
    })
    return total
  }

  function getLabSeconds (article) {
    var mins = parseInt(article.dataset.labMinutes, 10)
    if (isNaN(mins) || mins <= 0) return 0
    return mins * 60
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

    var audioPromises = collectAudioPromises(article)
    var videoPromises = collectVideoPromises(article)
    var imageTotal = collectImageSeconds(article)
    var labTotal = getLabSeconds(article)

    Promise.all([
      Promise.all(audioPromises),
      Promise.all(videoPromises)
    ]).then(function (results) {
      var audioTotal = sumSeconds(results[0])
      var videoTotal = sumSeconds(results[1])
      var totalSeconds = pageHasAudio(article)
        ? Math.max(textSeconds, audioTotal) + videoTotal
        : textSeconds + audioTotal + videoTotal
      totalSeconds += imageTotal + labTotal
      p.textContent = 'Estimated time: ' + formatDuration(totalSeconds)
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
