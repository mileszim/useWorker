import puppeteer from 'puppeteer-core'

/**
 * Minimal real-browser harness. jsdom cannot execute Blob/module workers, so
 * any test that exercises an actual Worker must run in a real browser. Point
 * CHROME_PATH at a Chrome/Chromium binary (defaults to macOS Google Chrome).
 */
const CHROME_PATH =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

/**
 * Loads `url`, waits for the page to set `window.__RESULT__`, and returns it
 * along with collected console/error logs.
 */
export async function runInBrowser(url, { timeout = 12000 } = {}) {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox'],
  })
  try {
    const page = await browser.newPage()
    const logs = []
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
    await page.goto(url, { waitUntil: 'networkidle0' })
    await page.waitForFunction('window.__RESULT__ !== undefined', { timeout })
    const result = await page.evaluate('window.__RESULT__')
    return { result, logs }
  } finally {
    await browser.close()
  }
}
