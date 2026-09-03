import { afterEach, describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { deviceCredentials } from '../src/db/schema.js'
import { eq } from 'drizzle-orm'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

async function signIn(deviceId: string | null = 'dev-1') {
  const headers = deviceId ? { 'x-device-id': deviceId } : undefined
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/sign-in',
    headers,
    payload: { email: 'owner@demo.com', password: 'owner123' },
  })
  expect(res.statusCode).toBe(200)
  return res.json()
}

function proof(biometricKey: string, deviceId: string, installId: string) {
  return createHmac('sha256', biometricKey)
    .update(`${deviceId}:${installId}`)
    .digest('hex')
}

async function deviceRefresh(body: Record<string, unknown>) {
  return ctx.app.inject({ method: 'POST', url: '/api/auth/device-refresh', payload: body })
}

describe('POST /api/auth/sign-in (device credential fields)', () => {
  it('mengembalikan device_refresh_token + install id saat header X-Device-Id hadir', async () => {
    ctx = await setupTest()
    const body = await signIn('dev-1')
    expect(body.device_refresh_token).toBeTruthy()
    expect(body.device_install_id).toBeTruthy()
    expect(body.device_biometric_key).toBeTruthy()
    expect(new Date(body.device_refresh_expires_at).getTime()).toBeGreaterThan(Date.now())
  })

  it('tanpa header X-Device-Id → tidak ada field perangkat (web tidak berubah)', async () => {
    ctx = await setupTest()
    const body = await signIn(null)
    expect(body.device_refresh_token).toBeUndefined()
    expect(body.device_install_id).toBeUndefined()
    expect(body.device_biometric_key).toBeUndefined()
  })
})

describe('POST /api/auth/device-refresh', () => {
  it('happy path: proof benar + tuple cocok → access token baru + credential baru', async () => {
    ctx = await setupTest()
    const body = await signIn('dev-1')
    const res = await deviceRefresh({
      device_id: 'dev-1',
      device_install_id: body.device_install_id,
      device_refresh_token: body.device_refresh_token,
      biometric_proof: proof(body.device_biometric_key, 'dev-1', body.device_install_id),
    })
    expect(res.statusCode).toBe(200)
    const out = res.json()
    expect(out.access_token).toBeTruthy()
    expect(out.refresh_token).toBeTruthy()
    expect(out.device_refresh_token).toBeTruthy()
    expect(out.device_refresh_token).not.toBe(body.device_refresh_token)
    expect(out.user.email).toBe('owner@demo.com')

    const me = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: auth(out.access_token) })
    expect(me.statusCode).toBe(200)
  })

  it('biometric proof salah → 401', async () => {
    ctx = await setupTest()
    const body = await signIn('dev-1')
    const res = await deviceRefresh({
      device_id: 'dev-1',
      device_install_id: body.device_install_id,
      device_refresh_token: body.device_refresh_token,
      biometric_proof: 'deadbeef'.repeat(8),
    })
    expect(res.statusCode).toBe(401)
  })

  it('proof hilang → 401', async () => {
    ctx = await setupTest()
    const body = await signIn('dev-1')
    const res = await deviceRefresh({
      device_id: 'dev-1',
      device_install_id: body.device_install_id,
      device_refresh_token: body.device_refresh_token,
    })
    expect(res.statusCode).toBe(401)
  })

  it('cross-device mismatch (device_id beda) → 401', async () => {
    ctx = await setupTest()
    const body = await signIn('dev-1')
    const res = await deviceRefresh({
      device_id: 'dev-2',
      device_install_id: body.device_install_id,
      device_refresh_token: body.device_refresh_token,
      biometric_proof: proof(body.device_biometric_key, 'dev-2', body.device_install_id),
    })
    expect(res.statusCode).toBe(401)
  })

  it('device_install_id beda → 401', async () => {
    ctx = await setupTest()
    const body = await signIn('dev-1')
    const res = await deviceRefresh({
      device_id: 'dev-1',
      device_install_id: 'install-lain',
      device_refresh_token: body.device_refresh_token,
      biometric_proof: proof(body.device_biometric_key, 'dev-1', 'install-lain'),
    })
    expect(res.statusCode).toBe(401)
  })

  it('token tak dikenal → 401', async () => {
    ctx = await setupTest()
    const res = await deviceRefresh({
      device_id: 'dev-1',
      device_install_id: 'install-x',
      device_refresh_token: 'a'.repeat(64),
      biometric_proof: 'b'.repeat(64),
    })
    expect(res.statusCode).toBe(401)
  })

  it('credential kedaluwarsa → 401', async () => {
    ctx = await setupTest()
    const body = await signIn('dev-1')
    ctx.db.db
      .update(deviceCredentials)
      .set({ expires_at: new Date(Date.now() - 60_000) })
      .where(eq(deviceCredentials.device_install_id, body.device_install_id))
      .run()
    const res = await deviceRefresh({
      device_id: 'dev-1',
      device_install_id: body.device_install_id,
      device_refresh_token: body.device_refresh_token,
      biometric_proof: proof(body.device_biometric_key, 'dev-1', body.device_install_id),
    })
    expect(res.statusCode).toBe(401)
  })

  it('rotasi salt: token lama tidak bisa dipakai ulang setelah refresh sukses', async () => {
    ctx = await setupTest()
    const first = await signIn('dev-1')
    const good = await deviceRefresh({
      device_id: 'dev-1',
      device_install_id: first.device_install_id,
      device_refresh_token: first.device_refresh_token,
      biometric_proof: proof(first.device_biometric_key, 'dev-1', first.device_install_id),
    })
    expect(good.statusCode).toBe(200)
    const rotated = good.json()

    const replay = await deviceRefresh({
      device_id: 'dev-1',
      device_install_id: rotated.device_install_id,
      device_refresh_token: first.device_refresh_token,
      biometric_proof: proof(rotated.device_biometric_key, 'dev-1', rotated.device_install_id),
    })
    expect(replay.statusCode).toBe(401)

    const next = await deviceRefresh({
      device_id: 'dev-1',
      device_install_id: rotated.device_install_id,
      device_refresh_token: rotated.device_refresh_token,
      biometric_proof: proof(rotated.device_biometric_key, 'dev-1', rotated.device_install_id),
    })
    expect(next.statusCode).toBe(200)
  })

  it('credential milik user lain (cross-user) → 401', async () => {
    ctx = await setupTest()
    const owner = await signIn('dev-1')
    const employee = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      headers: { 'x-device-id': 'dev-2' },
      payload: { email: 'siti@demo.com', password: 'demo123' },
    })
    expect(employee.statusCode).toBe(200)
    const empBody = employee.json()

    // Token milik owner dipakai dengan tuple install id milik employee.
    const res = await deviceRefresh({
      device_id: 'dev-2',
      device_install_id: empBody.device_install_id,
      device_refresh_token: owner.device_refresh_token,
      biometric_proof: proof(owner.device_biometric_key, 'dev-2', empBody.device_install_id),
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('sign-out / sign-out-all mencabut kredensial perangkat', () => {
  it('sign-out mengirim device_refresh_token → credential ikut dicabut', async () => {
    ctx = await setupTest()
    const body = await signIn('dev-1')
    const out = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: auth(body.token),
      payload: { device_refresh_token: body.device_refresh_token },
    })
    expect(out.statusCode).toBe(200)
    expect(out.json()).toEqual({ ok: true })

    const res = await deviceRefresh({
      device_id: 'dev-1',
      device_install_id: body.device_install_id,
      device_refresh_token: body.device_refresh_token,
      biometric_proof: proof(body.device_biometric_key, 'dev-1', body.device_install_id),
    })
    expect(res.statusCode).toBe(401)
  })

  it('sign-out-all mencabut semua kredensial perangkat user', async () => {
    ctx = await setupTest()
    const first = await signIn('dev-1')
    const second = await signIn('dev-2')

    const out = await ctx.app.inject({ method: 'POST', url: '/api/auth/sign-out-all', headers: auth(first.token) })
    expect(out.statusCode).toBe(200)
    expect(out.json().device_credentials_revoked).toBeGreaterThanOrEqual(2)

    for (const [body, deviceId] of [
      [first, 'dev-1'],
      [second, 'dev-2'],
    ] as const) {
      const res = await deviceRefresh({
        device_id: deviceId,
        device_install_id: body.device_install_id,
        device_refresh_token: body.device_refresh_token,
        biometric_proof: proof(body.device_biometric_key, deviceId, body.device_install_id),
      })
      expect(res.statusCode).toBe(401)
    }
  })
})