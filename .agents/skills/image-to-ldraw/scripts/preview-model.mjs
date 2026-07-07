#!/usr/bin/env node
/**
 * preview-model.mjs
 *
 * Renders an LDraw .ldr/.mpd file to a PNG screenshot using Playwright + three.js.
 *
 * Usage:
 *   node scripts/preview-model.mjs <model.ldr|model.mpd> [--out preview.png] [--width 800] [--height 600]
 *
 * Requires: @playwright/test (already in project devDependencies)
 */
import { createServer } from 'node:http'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { resolve, dirname, basename, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PREVIEW_HTML = resolve(SCRIPT_DIR, 'preview.html')

function parseArgs(argv) {
  if (argv.length === 0) {
    console.error('Usage: preview-model.mjs <model.ldr|model.mpd> [--out file.png] [--width 800] [--height 600]')
    process.exit(1)
  }
  const args = {
    modelPath: resolve(argv[0]),
    outPath: null,
    width: 800,
    height: 600,
    timeout: 60000,
  }
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) args.outPath = resolve(argv[++i])
    else if (argv[i] === '--width' && argv[i + 1]) args.width = parseInt(argv[++i])
    else if (argv[i] === '--height' && argv[i + 1]) args.height = parseInt(argv[++i])
    else if (argv[i] === '--timeout' && argv[i + 1]) args.timeout = parseInt(argv[++i])
  }
  if (!args.outPath) {
    const name = basename(args.modelPath, extname(args.modelPath))
    args.outPath = resolve(dirname(args.modelPath), `${name}-preview.png`)
  }
  return args
}

/**
 * Start a minimal HTTP server to serve the HTML, model file, and LDraw parts library.
 */
function startServer(htmlPath, modelPath, ldrawLibDir) {
  return new Promise((resolvePromise) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost')
      res.setHeader('Access-Control-Allow-Origin', '*')

      if (url.pathname === '/') {
        const html = await readFile(htmlPath, 'utf8')
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)
      } else if (url.pathname === '/model') {
        const model = await readFile(modelPath, 'utf8')
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end(model)
      } else if (url.pathname.startsWith('/ldraw/')) {
        // Serve LDraw library files from local cache
        const relPath = url.pathname.slice(7) // remove '/ldraw/'
        const filePath = join(ldrawLibDir, relPath)
        try {
          const content = await readFile(filePath, 'utf8')
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end(content)
        } catch {
          console.error(`[server] 404 Not Found: ${relPath}`)
          res.writeHead(404)
          res.end('Part not found')
        }
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      resolvePromise({ server, port })
    })
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  // Verify model file exists
  try {
    await stat(args.modelPath)
  } catch {
    console.error(`Model file not found: ${args.modelPath}`)
    process.exit(1)
  }

  console.log(`Model: ${args.modelPath}`)
  console.log(`Output: ${args.outPath}`)
  console.log(`Size: ${args.width}x${args.height}`)

  // Import playwright
  let chromium
  try {
    const pw = await import('playwright')
    chromium = pw.chromium
  } catch {
    try {
      const pw = await import('@playwright/test')
      chromium = pw.chromium
    } catch {
      console.error('Playwright not found. Install with: npx playwright install chromium')
      process.exit(1)
    }
  }

  // Start local server with local LDraw library
  const ldrawLibDir = resolve(SCRIPT_DIR, '../.cache/ldraw-library/extracted/ldraw')
  const { server, port } = await startServer(PREVIEW_HTML, args.modelPath, ldrawLibDir)
  const ldrawPath = `http://127.0.0.1:${port}/ldraw/`
  const pageUrl = `http://127.0.0.1:${port}/?model=http://127.0.0.1:${port}/model&w=${args.width}&h=${args.height}&ldrawPath=${encodeURIComponent(ldrawPath)}`

  console.log(`Server: http://127.0.0.1:${port}`)
  console.log('Launching browser...')

  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--use-gl=angle',
        '--use-angle=swiftshader'
      ],
    })
    const page = await browser.newPage()
    page.setViewportSize({ width: args.width, height: args.height })
    page.setDefaultTimeout(args.timeout)

    // Listen for console messages
    page.on('console', (msg) => {
      const type = msg.type()
      if (type === 'error' || type === 'warning') {
        console.error(`  [browser:${type}] ${msg.text()}`)
      } else {
        console.log(`  [browser] ${msg.text()}`)
      }
    })

    console.log('Loading model...')
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded' })

    // Wait for render completion or error
    const result = await page.waitForFunction(
      () => window.__PREVIEW_DONE === true || window.__PREVIEW_ERROR,
      { timeout: args.timeout }
    )

    const error = await page.evaluate(() => window.__PREVIEW_ERROR)
    if (error) {
      console.error(`Render error: ${error}`)
      process.exit(1)
    }

    // Small delay for final render pass
    await page.waitForTimeout(500)

    // Take screenshot
    await page.screenshot({
      path: args.outPath,
      type: 'png',
      clip: { x: 0, y: 0, width: args.width, height: args.height },
    })

    console.log(`\n✅ Preview saved: ${args.outPath}`)
  } catch (err) {
    console.error(`Screenshot failed: ${err.message}`)
    if (err.message.includes('Executable doesn\'t exist') || err.message.includes('browserType.launch')) {
      console.error('\nPlaywright browser not installed. Run:')
      console.error('  npx playwright install chromium')
    }
    process.exit(1)
  } finally {
    await browser?.close()
    server.close()
  }
}

main().catch((err) => {
  console.error(err.stack || err.message)
  process.exit(1)
})
