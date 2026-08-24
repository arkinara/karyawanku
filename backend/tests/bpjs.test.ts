import { describe, expect, it } from 'vitest'
import { calculateBPJS } from '../src/lib/bpjs.js'

describe('calculateBPJS', () => {
  it('gaji 3.500.000 → kesehatan 35.000 + 140.000, jht 70.000 + 129.500, jp 35.000 + 70.000, jkk 35.000, jkm 10.500', () => {
    const res = calculateBPJS(3_500_000)
    expect(res.bpjsKesehatan.employee).toBe(35_000)
    expect(res.bpjsKesehatan.employer).toBe(140_000)
    expect(res.bpjsKetenagakerjaan.jht.employee).toBe(70_000)
    expect(res.bpjsKetenagakerjaan.jht.employer).toBe(129_500)
    expect(res.bpjsKetenagakerjaan.jp.employee).toBe(35_000)
    expect(res.bpjsKetenagakerjaan.jp.employer).toBe(70_000)
    expect(res.bpjsKetenagakerjaan.jkk).toBe(35_000)
    expect(res.bpjsKetenagakerjaan.jkm).toBe(10_500)
  })

  it('gaji 5.000.000 → kesehatan employee 50.000 (1%), jht+jp employee = 150.000 (3%)', () => {
    const res = calculateBPJS(5_000_000)
    expect(res.bpjsKesehatan.employee).toBe(50_000)
    expect(res.bpjsKesehatan.employer).toBe(200_000)
    const employeeTk = res.bpjsKetenagakerjaan.jht.employee + res.bpjsKetenagakerjaan.jp.employee
    expect(employeeTk).toBe(150_000)
  })

  it('gaji 0 → semua nol, tanpa crash', () => {
    const res = calculateBPJS(0)
    expect(res.bpjsKesehatan.employee).toBe(0)
    expect(res.bpjsKetenagakerjaan.jht.employee).toBe(0)
    expect(res.bpjsKetenagakerjaan.jkm).toBe(0)
  })

  it('jkk/jkm hanya employer — tidak ikut mengurangi take-home', () => {
    const res = calculateBPJS(5_000_000)
    const empDeduction =
      res.bpjsKesehatan.employee +
      res.bpjsKetenagakerjaan.jht.employee +
      res.bpjsKetenagakerjaan.jp.employee
    const employerOnly = res.bpjsKetenagakerjaan.jkk + res.bpjsKetenagakerjaan.jkm
    expect(empDeduction).toBe(200_000)
    expect(employerOnly).toBe(65_000)
  })
})
