import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

test('后台服务：多标签页保持运行，刷新可重连，最后一个页面关闭后退出', { timeout: 15000 }, async (t) => {
  const reservation = net.createServer().listen(0, '127.0.0.1')
  await once(reservation, 'listening')
  const port = reservation.address().port
  await new Promise((resolve) => reservation.close(resolve))
  const child = spawn(process.execPath, [fileURLToPath(new URL('../serve.cjs', import.meta.url))], {
    env: { ...process.env, LIFE_LEDGER_PORT: String(port) }, windowsHide: true, stdio: 'ignore',
  })
  t.after(() => { if (child.exitCode === null) child.kill() })
  const address = `http://127.0.0.1:${port}`
  let ready = false
  for (let attempt = 0; attempt < 60; attempt++) {
    try { ready = (await fetch(address + '/__life_ledger_health')).ok } catch {}
    if (ready) break
    await delay(50)
  }
  assert.ok(ready, '本地服务应启动成功')
  const openPage = () => new Promise((resolve, reject) => {
    const request = http.get(address + '/__life_ledger_session', (response) => {
      response.resume()
      resolve(request)
    })
    request.on('error', reject)
    t.after(() => request.destroy())
  })
  const first = await openPage(), second = await openPage()
  first.destroy()
  await delay(3200)
  assert.equal(child.exitCode, null, '仍有标签页时应继续运行')
  second.destroy()
  await delay(300)
  const refreshed = await openPage()
  await delay(3200)
  assert.equal(child.exitCode, null, '刷新后应取消退出计时')
  const exited = once(child, 'exit')
  refreshed.destroy()
  const [code] = await exited
  assert.equal(code, 0, '关闭最后一个页面后应正常退出')
})

