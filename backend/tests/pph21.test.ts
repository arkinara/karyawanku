import { describe, expect, it } from 'vitest'
import { calculatePPh21 } from '../src/lib/pph21.js'

describe('calculatePPh21', () => {
  it('TK/0 gross 60jt → PKP 3jt (60jt - PTKP 54jt - biaya jabatan 3jt) → 5% = 150rb/tahun, 12.500/bulan', () => {
    const res = calculatePPh21(60_000_000, 'TK/0')
    expect(res.annualPPh21).toBe(150_000)
    expect(res.monthlyPPh21).toBe(12_500)
    expect(res.breakdown.pkp).toBe(3_000_000)
    expect(res.breakdown.biayaJabatan).toBe(3_000_000)
  })

  it('TK/0 gross 120jt → PKP 60jt → 5% × 60jt = 3jt/tahun = 250rb/bulan', () => {
    const res = calculatePPh21(120_000_000, 'TK/0')
    expect(res.breakdown.pkp).toBe(60_000_000)
    expect(res.annualPPh21).toBe(3_000_000)
    expect(res.monthlyPPh21).toBe(250_000)
  })

  it('TK/0 gross 160jt → PKP 100jt → campuran 5% + 15% = 9jt/tahun = 750rb/bulan', () => {
    const res = calculatePPh21(160_000_000, 'TK/0')
    expect(res.breakdown.pkp).toBe(100_000_000)
    expect(res.annualPPh21).toBe(9_000_000)
    expect(res.monthlyPPh21).toBe(750_000)
    expect(res.breakdown.brackets).toHaveLength(2)
    expect(res.breakdown.brackets[0]).toMatchObject({ rate: 0.05, amount: 3_000_000 })
    expect(res.breakdown.brackets[1]).toMatchObject({ rate: 0.15, amount: 6_000_000 })
  })

  it('K/1 memiliki PTKP lebih tinggi → pph21 lebih rendah daripada TK/0 untuk gross sama', () => {
    const gross = 150_000_000
    const tk0 = calculatePPh21(gross, 'TK/0')
    const k1 = calculatePPh21(gross, 'K/1')
    expect(k1.annualPPh21).toBeLessThan(tk0.annualPPh21)
    expect(k1.breakdown.ptkpThreshold).toBe(63_000_000)
    expect(k1.breakdown.ptkpThreshold).toBeGreaterThan(tk0.breakdown.ptkpThreshold)
  })

  it('K/3 penghasilan tinggi → mencapai lapisan tertinggi (30%)', () => {
    const res = calculatePPh21(600_000_000, 'K/3')
    const last = res.breakdown.brackets[res.breakdown.brackets.length - 1]
    expect(last.rate).toBe(0.3)
    // PKP = 600jt - 72jt - 6jt = 522jt
    expect(res.breakdown.pkp).toBe(522_000_000)
  })

  it('K/3 penghasilan sangat tinggi → lapisan 35% (PKP > 5M)', () => {
    const res = calculatePPh21(5_100_000_000, 'K/3')
    const last = res.breakdown.brackets[res.breakdown.brackets.length - 1]
    expect(last.rate).toBe(0.35)
  })

  it('status PTKP tidak diberikan → default TK/0 dengan penanda di breakdown', () => {
    const res = calculatePPh21(60_000_000)
    expect(res.breakdown.ptkpCategory).toBe('TK/0')
    expect(res.breakdown.ptkpDefaulted).toBe(true)
    expect(res.annualPPh21).toBe(150_000)
  })

  it('PKP ≤ 0 → pph21 0, bukan negatif', () => {
    const res = calculatePPh21(30_000_000, 'TK/0')
    expect(res.annualPPh21).toBe(0)
    expect(res.monthlyPPh21).toBe(0)
  })

  it('gross 0 → pph21 0, tanpa crash', () => {
    const res = calculatePPh21(0, 'K/2')
    expect(res.annualPPh21).toBe(0)
    expect(res.monthlyPPh21).toBe(0)
  })
})
