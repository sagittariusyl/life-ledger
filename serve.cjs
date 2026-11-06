const http = require('node:http')
const fs = require('node:fs/promises')
const path = require('node:path')

const root = path.join(__dirname, 'dist')
const port = Number(process.env.LIFE_LEDGER_PORT || 5175)
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' }
const sessions = new Set()
let exitTimer

function scheduleExit(delay) {
  clearTimeout(exitTimer)
  exitTimer = setTimeout(() => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2000).unref()
  }, delay)
}

function keepSession(response) {
  clearTimeout(exitTimer)
  sessions.add(response)
  response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' })
  response.write(': connected\n\n')
  const heartbeat = setInterval(() => response.write(': keepalive\n\n'), 20000)
  response.on('close', () => {
    clearInterval(heartbeat)
    sessions.delete(response)
    if (!sessions.size) scheduleExit(3000)
  })
}

const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405).end()
    return
  }
  if (request.url === '/__life_ledger_health') {
    response.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end('life-ledger-local-v1')
    return
  }
  if (request.url === '/__life_ledger_session' && request.method === 'GET') {
    keepSession(response)
    return
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
    if (!file.startsWith(root + path.sep)) {
      response.writeHead(403).end()
      return
    }
    const bytes = await fs.readFile(file)
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    response.end(request.method === 'HEAD' ? undefined : bytes)
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 400).end()
  }
})

server.on('error', async (error) => {
  if (error.code !== 'EADDRINUSE') await fs.writeFile(path.join(__dirname, 'startup-error.log'), error.message).catch(() => {})
  process.exit(error.code === 'EADDRINUSE' ? 0 : 1)
})
fs.access(path.join(root, 'index.html'))
  .then(() => server.listen(port, '127.0.0.1', () => scheduleExit(30000)))
  .catch(async () => {
    await fs.writeFile(path.join(__dirname, 'startup-error.log'), 'Missing dist/index.html. Run npm run build.').catch(() => {})
    process.exit(1)
  })
