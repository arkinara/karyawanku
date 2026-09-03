import { afterEach, describe, expect, it } from 'vitest'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe('GET /api/notification-prefs/me', () => {
  it('default saat belum pernah disimpan: aktif + 30 menit', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/notification-prefs/me',
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().preferences).toEqual({
      shift_reminders_enabled: true,
      reminder_lead_minutes: 30,
    })
  })

  it('tanpa auth → 401', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/notification-prefs/me' })
    expect(res.statusCode).toBe(401)
  })
})

describe('PATCH /api/notification-prefs/me', () => {
  it('mematikan pengingat → tersimpan', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/notification-prefs/me',
      headers: auth(ctx.employeeToken),
      payload: { shift_reminders_enabled: false },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().preferences.shift_reminders_enabled).toBe(false)
    expect(res.json().preferences.reminder_lead_minutes).toBe(30)

    const again = await ctx.app.inject({
      method: 'GET',
      url: '/api/notification-prefs/me',
      headers: auth(ctx.employeeToken),
    })
    expect(again.json().preferences.shift_reminders_enabled).toBe(false)
  })

  it('mengubah lead time ke 60 → tersimpan, state lain tetap', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/notification-prefs/me',
      headers: auth(ctx.employeeToken),
      payload: { reminder_lead_minutes: 60 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().preferences).toEqual({
      shift_reminders_enabled: true,
      reminder_lead_minutes: 60,
    })
  })

  it('lead time di luar {15,30,60} → 422', async () => {
    ctx = await setupTest()
    for (const lead of [20, 0, -5]) {
      const res = await ctx.app.inject({
        method: 'PATCH',
        url: '/api/notification-prefs/me',
        headers: auth(ctx.employeeToken),
        payload: { reminder_lead_minutes: lead },
      })
      expect(res.statusCode).toBe(422)
    }
  })

  it('body kosong → 422', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/notification-prefs/me',
      headers: auth(ctx.employeeToken),
      payload: {},
    })
    expect(res.statusCode).toBe(422)
  })
})