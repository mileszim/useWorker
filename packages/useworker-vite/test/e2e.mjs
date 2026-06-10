import { fileURLToPath } from 'node:url'
import { build, createServer, preview } from 'vite'
import { runInBrowser } from './browser.mjs'

const root = fileURLToPath(new URL('./fixture', import.meta.url))
const configFile = fileURLToPath(
  new URL('./fixture/vite.config.mts', import.meta.url),
)

const EXPECTED_SQUARED = '[1,4,9,16]' // module path: local import
const EXPECTED_DEDUPED_LEN = 2 // module path: npm import
const EXPECTED_SORTED = '[1,2,3]' // blob path: inline fn

function check(label, result) {
  const ok =
    result &&
    !result.error &&
    JSON.stringify(result.squared) === EXPECTED_SQUARED &&
    result.dedupedLen === EXPECTED_DEDUPED_LEN &&
    JSON.stringify(result.sorted) === EXPECTED_SORTED
  console.log(`\n[${label}] result: ${JSON.stringify(result)}`)
  console.log(`[${label}] ${ok ? 'PASS ✅' : 'FAIL ❌'}`)
  return ok
}

async function testDev() {
  const server = await createServer({
    root,
    configFile,
    server: { port: 5189, strictPort: true },
  })
  await server.listen()
  const url = `http://localhost:${server.config.server.port}/`
  try {
    const { result, logs } = await runInBrowser(url)
    if (process.env.VERBOSE) console.log('[dev logs]\n' + logs.join('\n'))
    return check('dev', result)
  } finally {
    await server.close()
  }
}

async function testBuild() {
  await build({ root, configFile, logLevel: 'warn' })
  const server = await preview({
    root,
    configFile,
    preview: { port: 5190, strictPort: true },
  })
  const url = `http://localhost:${server.config.preview.port}/`
  try {
    const { result, logs } = await runInBrowser(url)
    if (process.env.VERBOSE) console.log('[build logs]\n' + logs.join('\n'))
    return check('build', result)
  } finally {
    await new Promise((res) => server.httpServer.close(res))
  }
}

const devOk = await testDev()
const buildOk = await testBuild()

if (devOk && buildOk) {
  console.log('\nAll e2e modes passed ✅')
  process.exit(0)
} else {
  console.log('\nE2E FAILED ❌')
  process.exit(1)
}
