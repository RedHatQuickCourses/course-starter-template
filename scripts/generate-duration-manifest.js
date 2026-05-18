'use strict'

const fs = require('fs')
const path = require('path')
const core = require('./estimate-duration-core')

var ROOT = path.resolve(__dirname, '..')
var antoraYmlPath = path.join(ROOT, 'antora.yml')
var outputPath = path.join(ROOT, 'supplemental-ui', 'data', 'course-durations.json')

function readNavPaths () {
  var yml = fs.readFileSync(antoraYmlPath, 'utf8')
  var paths = []
  var lines = yml.split('\n')
  for (var i = 0; i < lines.length; i++) {
    var match = lines[i].match(/^\s*-\s*(modules\/.+nav\.adoc)\s*$/)
    if (match) paths.push(match[1])
  }
  return paths
}

function moduleFromNavPath (navPath) {
  var parts = navPath.split('/')
  return parts[1]
}

function parseXrefs (navContent) {
  var pages = []
  var lines = navContent.split('\n')
  for (var i = 0; i < lines.length; i++) {
    var match = lines[i].match(/^\s*\*+\s+xref:([^[\]]+\.adoc)/)
    if (match) pages.push(match[1])
  }
  return pages
}

async function main () {
  var navPaths = readNavPaths()
  var pages = []
  var totalSeconds = 0

  for (var i = 0; i < navPaths.length; i++) {
    var navPath = navPaths[i]
    var moduleName = moduleFromNavPath(navPath)
    var moduleDir = path.join(ROOT, 'modules', moduleName)
    var navFile = path.join(ROOT, navPath)
    var navContent = fs.readFileSync(navFile, 'utf8')
    var xrefs = parseXrefs(navContent)

    for (var j = 0; j < xrefs.length; j++) {
      var pageFile = xrefs[j]
      var pagePath = path.join(moduleDir, 'pages', pageFile)
      if (!fs.existsSync(pagePath)) {
        console.warn('warn: page not found:', pagePath)
        continue
      }

      var content = fs.readFileSync(pagePath, 'utf8')
      var seconds = await core.estimatePageSeconds(content, moduleDir)
      pages.push({ module: moduleName, page: pageFile, seconds: seconds })
      totalSeconds += seconds
    }
  }

  var manifest = {
    totalSeconds: totalSeconds,
    pageCount: pages.length,
    pages: pages
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n')

  console.log(
    'course-durations: ' +
      pages.length +
      ' pages, total ' +
      core.formatDuration(totalSeconds) +
      ' (' +
      totalSeconds +
      's)'
  )
}

main().catch(function (err) {
  console.error(err)
  process.exit(1)
})
