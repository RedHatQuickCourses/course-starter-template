;(function () {
  'use strict'

  var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
  var LS_TRANSCRIPT = 'rh-qc-transcript-visible'
  var LS_SPEED = 'rh-qc-audio-speed'
  var SEEK_STEP = 5
  var SYNC_INTERVAL = 250

  var audio = null
  var segments = []
  var activeIndex = -1
  var syncTimer = null
  var userScrolling = false
  var userScrollTimer = null
  var isDragging = false

  var els = {}

  // ── Utilities ──────────────────────────────────────────────

  function formatTime (s) {
    if (!isFinite(s) || s < 0) s = 0
    s = Math.floor(s)
    var m = Math.floor(s / 60)
    var sec = s % 60
    return m + ':' + (sec < 10 ? '0' : '') + sec
  }

  function formatTimeVerbose (s) {
    if (!isFinite(s) || s < 0) s = 0
    s = Math.floor(s)
    var m = Math.floor(s / 60)
    var sec = s % 60
    var parts = []
    if (m > 0) parts.push(m + (m === 1 ? ' minute' : ' minutes'))
    if (sec > 0 || m === 0) parts.push(sec + (sec === 1 ? ' second' : ' seconds'))
    return parts.join(' ')
  }

  function lsGet (key) {
    try { return localStorage.getItem(key) } catch (e) { return null }
  }

  function lsSet (key, val) {
    try { localStorage.setItem(key, val) } catch (e) { /* noop */ }
  }

  function resolveMediaUrl (src) {
    if (/^https?:\/\//i.test(src)) return src
    return '_images/' + src
  }

  function svgNs (tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag)
    if (attrs) {
      for (var k in attrs) {
        if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k])
      }
    }
    return el
  }

  // ── Initialization ─────────────────────────────────────────

  function init () {
    var article = document.querySelector('article.doc')
    if (!article) return

    var audioSrc = article.dataset.audioSrc
    if (!audioSrc) return

    var transcriptSrc = article.dataset.transcriptSrc || null
    var mainEl = document.querySelector('main.article') || document.querySelector('main')
    if (!mainEl) return

    audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.src = resolveMediaUrl(audioSrc)

    document.body.classList.add('has-audio-player')

    buildPlayerBar(mainEl, !!transcriptSrc)
    bindAudioEvents()
    restoreSpeed()

    if (transcriptSrc) {
      loadTranscript(resolveMediaUrl(transcriptSrc))
    }
  }

  // ── Player Bar Construction ────────────────────────────────

  function buildPlayerBar (mainEl, hasTranscript) {
    var bar = document.createElement('div')
    bar.className = 'audio-player-bar'
    bar.setAttribute('role', 'region')
    bar.setAttribute('aria-label', 'Audio player')

    // Play / Pause
    var playBtn = document.createElement('button')
    playBtn.className = 'audio-btn audio-play-pause'
    playBtn.type = 'button'
    playBtn.setAttribute('aria-label', 'Play')
    playBtn.title = 'Play'

    var playIcon = svgNs('svg', { 'class': 'audio-icon audio-icon-play', viewBox: '0 0 24 24', 'aria-hidden': 'true' })
    var playPoly = svgNs('polygon', { points: '6,4 20,12 6,20' })
    playIcon.appendChild(playPoly)

    var pauseIcon = svgNs('svg', { 'class': 'audio-icon audio-icon-pause', viewBox: '0 0 24 24', 'aria-hidden': 'true' })
    pauseIcon.style.display = 'none'
    var r1 = svgNs('rect', { x: '5', y: '4', width: '4', height: '16' })
    var r2 = svgNs('rect', { x: '15', y: '4', width: '4', height: '16' })
    pauseIcon.appendChild(r1)
    pauseIcon.appendChild(r2)

    playBtn.appendChild(playIcon)
    playBtn.appendChild(pauseIcon)
    playBtn.addEventListener('click', onPlayPause)

    // Current time
    var timeCurrent = document.createElement('span')
    timeCurrent.className = 'audio-time audio-time-current'
    timeCurrent.setAttribute('aria-live', 'off')
    timeCurrent.textContent = '0:00'

    // Progress bar
    var progressWrap = document.createElement('div')
    progressWrap.className = 'audio-progress-wrap'
    progressWrap.setAttribute('role', 'slider')
    progressWrap.setAttribute('aria-label', 'Audio progress')
    progressWrap.setAttribute('aria-valuemin', '0')
    progressWrap.setAttribute('aria-valuemax', '0')
    progressWrap.setAttribute('aria-valuenow', '0')
    progressWrap.setAttribute('aria-valuetext', '0 seconds of 0 seconds')
    progressWrap.tabIndex = 0

    var track = document.createElement('div')
    track.className = 'audio-progress-track'

    var fill = document.createElement('div')
    fill.className = 'audio-progress-fill'

    var handle = document.createElement('div')
    handle.className = 'audio-progress-handle'
    handle.setAttribute('aria-hidden', 'true')

    track.appendChild(fill)
    track.appendChild(handle)
    progressWrap.appendChild(track)

    progressWrap.addEventListener('mousedown', onProgressMouseDown)
    progressWrap.addEventListener('touchstart', onProgressTouchStart, { passive: false })
    progressWrap.addEventListener('keydown', onProgressKeyDown)

    // Duration
    var timeDuration = document.createElement('span')
    timeDuration.className = 'audio-time audio-time-duration'
    timeDuration.textContent = '0:00'

    // Speed
    var speedSelect = document.createElement('select')
    speedSelect.className = 'audio-speed-select'
    speedSelect.setAttribute('aria-label', 'Playback speed')
    speedSelect.title = 'Playback speed'
    for (var si = 0; si < SPEEDS.length; si++) {
      var opt = document.createElement('option')
      opt.value = String(SPEEDS[si])
      opt.textContent = SPEEDS[si] + 'x'
      if (SPEEDS[si] === 1) opt.selected = true
      speedSelect.appendChild(opt)
    }
    speedSelect.addEventListener('change', onSpeedChange)

    // Loading
    var loading = document.createElement('span')
    loading.className = 'audio-loading'
    loading.setAttribute('aria-live', 'polite')
    loading.style.display = 'none'
    loading.textContent = 'Loading…'

    // Error
    var error = document.createElement('span')
    error.className = 'audio-error'
    error.setAttribute('role', 'alert')
    error.style.display = 'none'

    bar.appendChild(playBtn)
    bar.appendChild(timeCurrent)
    bar.appendChild(progressWrap)
    bar.appendChild(timeDuration)
    bar.appendChild(speedSelect)

    // Transcript toggle
    if (hasTranscript) {
      var toggleBtn = document.createElement('button')
      toggleBtn.className = 'audio-btn audio-transcript-toggle'
      toggleBtn.type = 'button'
      toggleBtn.setAttribute('aria-label', 'Show transcript')
      toggleBtn.setAttribute('aria-expanded', 'false')
      toggleBtn.title = 'Toggle transcript'

      var toggleIcon = svgNs('svg', { 'class': 'audio-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true' })
      var tPath = svgNs('path', { d: 'M4 4h16v2H4zm0 4h16v2H4zm0 4h10v2H4zm0 4h16v2H4z' })
      toggleIcon.appendChild(tPath)
      toggleBtn.appendChild(toggleIcon)
      toggleBtn.addEventListener('click', function () {
        toggleTranscript(!els.transcriptPanel || !els.transcriptPanel.classList.contains('is-visible'))
      })
      bar.appendChild(toggleBtn)
      els.toggleBtn = toggleBtn
    }

    bar.appendChild(loading)
    bar.appendChild(error)

    var toolbar = mainEl.querySelector('.toolbar')
    if (toolbar && toolbar.nextSibling) {
      mainEl.insertBefore(bar, toolbar.nextSibling)
    } else {
      mainEl.appendChild(bar)
    }

    els.bar = bar
    els.playBtn = playBtn
    els.playIcon = playIcon
    els.pauseIcon = pauseIcon
    els.timeCurrent = timeCurrent
    els.timeDuration = timeDuration
    els.progressWrap = progressWrap
    els.fill = fill
    els.handle = handle
    els.speedSelect = speedSelect
    els.loading = loading
    els.error = error
  }

  // ── Audio Events ───────────────────────────────────────────

  function bindAudioEvents () {
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onAudioEnded)
    audio.addEventListener('error', onAudioError)
    audio.addEventListener('waiting', function () {
      els.loading.style.display = ''
    })
    audio.addEventListener('canplay', function () {
      els.loading.style.display = 'none'
    })
    audio.addEventListener('play', function () {
      startSync()
    })
    audio.addEventListener('pause', function () {
      stopSync()
    })
  }

  function onLoadedMetadata () {
    var dur = audio.duration
    els.timeDuration.textContent = formatTime(dur)
    els.progressWrap.setAttribute('aria-valuemax', String(Math.floor(dur)))
    els.loading.style.display = 'none'
  }

  function onTimeUpdate () {
    if (isDragging) return
    var cur = audio.currentTime
    var dur = audio.duration || 0
    var pct = dur > 0 ? (cur / dur) * 100 : 0

    els.timeCurrent.textContent = formatTime(cur)
    els.fill.style.width = pct + '%'
    els.handle.style.left = pct + '%'

    els.progressWrap.setAttribute('aria-valuenow', String(Math.floor(cur)))
    els.progressWrap.setAttribute('aria-valuetext',
      formatTimeVerbose(cur) + ' of ' + formatTimeVerbose(dur))
  }

  function onAudioEnded () {
    setPlayState(false)
    stopSync()
  }

  function onAudioError () {
    els.loading.style.display = 'none'
    var msg = 'Unable to load audio'
    if (audio.error) {
      if (audio.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        msg = 'Audio format not supported'
      }
    }
    els.error.textContent = msg
    els.error.style.display = ''
    els.playBtn.disabled = true
  }

  function onPlayPause () {
    if (audio.paused) {
      audio.play().catch(function () { /* autoplay blocked */ })
    } else {
      audio.pause()
    }
    setPlayState(!audio.paused)
  }

  function setPlayState (playing) {
    els.playIcon.style.display = playing ? 'none' : ''
    els.pauseIcon.style.display = playing ? '' : 'none'
    els.playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play')
    els.playBtn.title = playing ? 'Pause' : 'Play'
  }

  // ── Progress Seeking ───────────────────────────────────────

  function seekToFraction (frac) {
    if (!audio.duration) return
    frac = Math.max(0, Math.min(1, frac))
    audio.currentTime = frac * audio.duration
    onTimeUpdate()
  }

  function fractionFromEvent (e, wrap) {
    var rect = wrap.getBoundingClientRect()
    var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    return x / rect.width
  }

  function onProgressMouseDown (e) {
    if (e.button !== 0) return
    e.preventDefault()
    isDragging = true
    seekToFraction(fractionFromEvent(e, els.progressWrap))

    var onMove = function (ev) {
      seekToFraction(fractionFromEvent(ev, els.progressWrap))
    }
    var onUp = function () {
      isDragging = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function onProgressTouchStart (e) {
    e.preventDefault()
    isDragging = true
    seekToFraction(fractionFromEvent(e, els.progressWrap))

    var onMove = function (ev) {
      ev.preventDefault()
      seekToFraction(fractionFromEvent(ev, els.progressWrap))
    }
    var onEnd = function () {
      isDragging = false
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
  }

  function onProgressKeyDown (e) {
    var handled = true
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + SEEK_STEP)
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        audio.currentTime = Math.max(0, audio.currentTime - SEEK_STEP)
        break
      case 'Home':
        audio.currentTime = 0
        break
      case 'End':
        audio.currentTime = audio.duration || 0
        break
      case ' ':
      case 'Enter':
        onPlayPause()
        break
      default:
        handled = false
    }
    if (handled) {
      e.preventDefault()
      onTimeUpdate()
    }
  }

  // ── Speed ──────────────────────────────────────────────────

  function onSpeedChange () {
    var speed = parseFloat(els.speedSelect.value)
    audio.playbackRate = speed
    lsSet(LS_SPEED, String(speed))
  }

  function restoreSpeed () {
    var saved = lsGet(LS_SPEED)
    if (saved) {
      var speed = parseFloat(saved)
      if (SPEEDS.indexOf(speed) !== -1) {
        audio.playbackRate = speed
        els.speedSelect.value = String(speed)
      }
    }
  }

  // ── Transcript Loading ─────────────────────────────────────

  function isTextFile (url) {
    return /\.txt(\?|#|$)/i.test(url)
  }

  function loadTranscript (url) {
    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('Transcript fetch failed')
        return isTextFile(url) ? res.text() : res.json()
      })
      .then(function (data) {
        if (typeof data === 'string') {
          loadPlainTextTranscript(data)
          return
        }
        if (!data || !Array.isArray(data.segments) || data.segments.length === 0) {
          console.warn('audio-transcript: empty or invalid transcript')
          return
        }
        var valid = data.segments.every(function (seg) {
          return typeof seg.start === 'number' &&
                 typeof seg.end === 'number' &&
                 typeof seg.text === 'string' &&
                 seg.end > seg.start
        })
        if (!valid) {
          console.warn('audio-transcript: transcript segments have invalid structure')
          return
        }
        segments = data.segments
        buildTranscriptPanel(data.lang || null, true)
        restoreTranscriptPref()
      })
      .catch(function (err) {
        console.warn('audio-transcript: could not load transcript:', err.message)
      })
  }

  function loadPlainTextTranscript (text) {
    var trimmed = text.trim()
    if (!trimmed) {
      console.warn('audio-transcript: empty text transcript')
      return
    }
    var paragraphs = trimmed.split(/\n\s*\n/).map(function (block) {
      return block.replace(/\n/g, ' ').trim()
    }).filter(function (s) { return s.length > 0 })
    if (paragraphs.length === 0) return

    segments = []
    buildTranscriptPanel(null, false, paragraphs)
    restoreTranscriptPref()
  }

  // ── Transcript Panel ───────────────────────────────────────

  function buildTranscriptPanel (lang, synced, textParagraphs) {
    var content = document.querySelector('main .content')
    if (!content) return

    var panel = document.createElement('aside')
    panel.className = 'transcript-panel'
    panel.setAttribute('role', 'complementary')
    panel.setAttribute('aria-label', 'Audio transcript')
    if (lang) panel.setAttribute('lang', lang)

    var header = document.createElement('div')
    header.className = 'transcript-header'

    var title = document.createElement('h3')
    title.className = 'transcript-title'
    title.textContent = 'Transcript'

    var closeBtn = document.createElement('button')
    closeBtn.className = 'transcript-close'
    closeBtn.type = 'button'
    closeBtn.setAttribute('aria-label', 'Close transcript')
    closeBtn.title = 'Close transcript'
    closeBtn.innerHTML = '&times;'
    closeBtn.addEventListener('click', function () {
      toggleTranscript(false)
    })

    header.appendChild(title)
    header.appendChild(closeBtn)

    var body = document.createElement('div')
    body.className = 'transcript-body'
    body.tabIndex = 0

    if (synced && segments.length > 0) {
      for (var i = 0; i < segments.length; i++) {
        var seg = segments[i]
        var p = document.createElement('p')
        p.className = 'transcript-segment'
        p.dataset.start = String(seg.start)
        p.dataset.end = String(seg.end)
        p.textContent = seg.text
        p.addEventListener('click', onSegmentClick.bind(null, seg))
        body.appendChild(p)
      }

      body.addEventListener('scroll', function () {
        userScrolling = true
        clearTimeout(userScrollTimer)
        userScrollTimer = setTimeout(function () {
          userScrolling = false
        }, 3000)
      })
    } else if (textParagraphs && textParagraphs.length > 0) {
      for (var j = 0; j < textParagraphs.length; j++) {
        var tp = document.createElement('p')
        tp.className = 'transcript-text'
        tp.textContent = textParagraphs[j]
        body.appendChild(tp)
      }
    }

    panel.appendChild(header)
    panel.appendChild(body)
    content.appendChild(panel)

    els.transcriptPanel = panel
    els.transcriptBody = body
  }

  function onSegmentClick (seg) {
    audio.currentTime = seg.start
    if (audio.paused) {
      audio.play().catch(function () {})
      setPlayState(true)
    }
    onTimeUpdate()
    syncTranscript()
  }

  // ── Transcript Toggle ──────────────────────────────────────

  function toggleTranscript (show) {
    if (!els.transcriptPanel) return
    if (show) {
      els.transcriptPanel.classList.add('is-visible')
    } else {
      els.transcriptPanel.classList.remove('is-visible')
    }
    if (els.toggleBtn) {
      els.toggleBtn.setAttribute('aria-expanded', show ? 'true' : 'false')
      els.toggleBtn.setAttribute('aria-label', show ? 'Hide transcript' : 'Show transcript')
    }
    lsSet(LS_TRANSCRIPT, show ? 'true' : 'false')
  }

  function restoreTranscriptPref () {
    var saved = lsGet(LS_TRANSCRIPT)
    if (saved === 'true') {
      toggleTranscript(true)
    }
  }

  // ── Transcript Sync ────────────────────────────────────────

  function startSync () {
    if (syncTimer) return
    syncTimer = setInterval(syncTranscript, SYNC_INTERVAL)
  }

  function stopSync () {
    if (syncTimer) {
      clearInterval(syncTimer)
      syncTimer = null
    }
  }

  function syncTranscript () {
    if (segments.length === 0) return
    var t = audio.currentTime
    var newIndex = -1

    var lo = 0
    var hi = segments.length - 1
    while (lo <= hi) {
      var mid = (lo + hi) >>> 1
      if (segments[mid].start <= t) {
        if (t < segments[mid].end) {
          newIndex = mid
          break
        }
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }

    if (newIndex === activeIndex) return
    var segEls = els.transcriptBody
      ? els.transcriptBody.querySelectorAll('.transcript-segment')
      : []

    if (activeIndex >= 0 && activeIndex < segEls.length) {
      segEls[activeIndex].classList.remove('is-active')
    }
    activeIndex = newIndex
    if (activeIndex >= 0 && activeIndex < segEls.length) {
      segEls[activeIndex].classList.add('is-active')
      if (!userScrolling) {
        scrollToSegment(segEls[activeIndex])
      }
    }
  }

  function scrollToSegment (el) {
    if (!els.transcriptBody) return
    var bodyRect = els.transcriptBody.getBoundingClientRect()
    var elRect = el.getBoundingClientRect()
    var offset = elRect.top - bodyRect.top - (bodyRect.height / 2) + (elRect.height / 2)
    els.transcriptBody.scrollTop += offset
  }

  // ── Bootstrap ──────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
