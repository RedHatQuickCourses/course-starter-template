;(function () {
  'use strict'

  function formatDuration (totalSeconds) {
    totalSeconds = Math.max(1, Math.round(totalSeconds))
    var mins = Math.floor(totalSeconds / 60)
    var secs = totalSeconds % 60
    if (mins === 0) return secs + ' sec'
    if (secs === 0) return mins + ' min'
    return mins + ' min ' + secs + ' sec'
  }

  function init () {
    var el = document.querySelector('.course-total-duration')
    if (!el) return

    var base = typeof uiRootPath !== 'undefined' ? uiRootPath : '/_'
    fetch(base + '/data/course-durations.json')
      .then(function (res) {
        if (!res.ok) throw new Error('manifest fetch failed')
        return res.json()
      })
      .then(function (data) {
        el.textContent = formatDuration(data.totalSeconds)
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
