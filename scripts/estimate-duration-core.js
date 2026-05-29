'use strict'

const fs = require('fs')
const path = require('path')
const mm = require('music-metadata')

const WPM = 200
const MEDIA_ROLE_RE = /media-seconds-(\d+)/
const MEDIA_MACRO_RE = /(?:audio|video)::([^[\]\s]+)\[([^\]]*)\]/g

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

function stripAdocForWordCount (content) {
  var text = content
  text = text.replace(/^\/\/.*$/gm, '')
  text = text.replace(/^\/\/\/\/[\s\S]*?\/\/\/\/$/gm, '')
  text = text.replace(/^:[A-Za-z0-9_-]+:.*$/gm, '')
  text = text.replace(/^include::.*$/gm, '')
  text = text.replace(/^\[source[^\]]*\][\s\S]*?^----$/gm, '')
  text = text.replace(/^----[\s\S]*?^----$/gm, '')
  text = text.replace(/^\.\w[\s\S]*?^====$/gm, '')
  text = text.replace(/^\[\.[^\]]*\][\s\S]*?^====$/gm, '')
  text = text.replace(/^(?:audio|video|image)::[^\n]+$/gm, '')
  text = text.replace(/^link:[^\n]+$/gm, '')
  text = text.replace(/^=+\s+.+$/gm, '')
  text = text.replace(/^\.[^\n]+$/gm, '')
  text = text.replace(/^[=*_`#~^+\-]+/gm, '')
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  text = text.replace(/xref:[^\[]+\[[^\]]*\]/g, '')
  text = text.replace(/[\\`*_#~^+\[\]|]/g, ' ')
  return text
}

function parseAttrs (attrs) {
  var result = { role: null, end: null, isYoutube: false, isVimeo: false }
  if (!attrs) return result

  var roleMatch = attrs.match(/role=([^\s,]+)/)
  if (roleMatch) result.role = roleMatch[1]

  var endMatch = attrs.match(/(?:^|[,\s])end=(\d+)/)
  if (endMatch) result.end = parseInt(endMatch[1], 10)

  if (/\byoutube\b/.test(attrs)) result.isYoutube = true
  if (/\bvimeo\b/.test(attrs)) result.isVimeo = true

  return result
}

function parseMediaMacros (content) {
  var macros = []
  var match
  var re = new RegExp(MEDIA_MACRO_RE.source, 'g')
  while ((match = re.exec(content)) !== null) {
    macros.push({
      type: match[0].startsWith('video') ? 'video' : 'audio',
      target: match[1],
      attrs: match[2]
    })
  }
  return macros
}

function manualSecondsFromRole (role) {
  if (!role) return null
  var m = role.match(MEDIA_ROLE_RE)
  if (m) return parseInt(m[1], 10)
  return null
}

function isExternalTarget (target) {
  return /^https?:\/\//i.test(target)
}

async function getLocalMediaSeconds (moduleDir, target) {
  var filePath = path.join(moduleDir, 'images', target)
  if (!fs.existsSync(filePath)) return 0

  try {
    var metadata = await mm.parseFile(filePath)
    var duration = metadata.format.duration
    if (duration != null && isFinite(duration)) {
      return Math.max(0, Math.round(duration))
    }
  } catch (err) {
    return 0
  }
  return 0
}

async function mediaSecondsFromMacro (macro, moduleDir) {
  var parsed = parseAttrs(macro.attrs)
  var manual = manualSecondsFromRole(parsed.role)
  if (manual != null) return manual

  if (parsed.end != null && parsed.end > 0) return parsed.end

  if (parsed.isYoutube || parsed.isVimeo || isExternalTarget(macro.target)) {
    return 0
  }

  return getLocalMediaSeconds(moduleDir, macro.target)
}

async function estimatePageSeconds (content, moduleDir) {
  var macros = parseMediaMacros(content)
  var hasAudio = macros.some(function (m) {
    return m.type === 'audio'
  })
  var textSeconds = wordsToSeconds(countWords(stripAdocForWordCount(content)))
  var audioSeconds = 0
  var videoSeconds = 0

  for (var i = 0; i < macros.length; i++) {
    var sec = await mediaSecondsFromMacro(macros[i], moduleDir)
    if (macros[i].type === 'audio') audioSeconds += sec
    else videoSeconds += sec
  }

  var total = hasAudio
    ? Math.max(textSeconds, audioSeconds) + videoSeconds
    : textSeconds + audioSeconds + videoSeconds

  return Math.max(1, total)
}

module.exports = {
  WPM,
  countWords,
  wordsToSeconds,
  formatDuration,
  stripAdocForWordCount,
  parseMediaMacros,
  mediaSecondsFromMacro,
  estimatePageSeconds
}
