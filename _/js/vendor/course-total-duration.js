;(function () {
  'use strict'

  function formatDuration (totalSeconds) {
    var mins = Math.max(1, Math.round(totalSeconds / 60))
    return mins + ' min'
  }

  function getUiRootPath () {
    var siteScript = document.getElementById('site-script')
    if (siteScript && siteScript.dataset.uiRootPath) {
      return siteScript.dataset.uiRootPath
    }
    if (typeof uiRootPath !== 'undefined') return uiRootPath
    return '/_'
  }

  function setDuration (el, totalSeconds) {
    el.textContent = formatDuration(totalSeconds)
  }

  function init () {
    var el = document.querySelector('.course-total-duration')
    if (!el) return

    if (window.__courseDuration && window.__courseDuration.totalSeconds) {
      setDuration(el, window.__courseDuration.totalSeconds)
      return
    }

    var base = getUiRootPath()
    fetch(base + '/data/course-durations.json')
      .then(function (res) {
        if (!res.ok) throw new Error('manifest fetch failed')
        return res.json()
      })
      .then(function (data) {
        setDuration(el, data.totalSeconds)
      })
      .catch(function () {
        el.textContent = 'unavailable'
      })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
