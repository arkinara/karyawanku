/**
 * KaryawanKu — safe formula evaluator for salary components (ticket #9).
 *
 * No `eval` / `new Function`: input is hand-tokenized and parsed with a
 * recursive-descent parser. Supports numbers (incl. decimals), `+ - * /`,
 * parentheses, and variables resolved from the `inputs` record
 * (`gaji_pokok`, `jam_kerja`, `tarif_lembur`, `jam_lembur`, ...).
 */

export type FormulaResult =
  | { ok: true; value: number }
  | { ok: false; error: string }

const MAX_LENGTH = 200
const NUMBER_RE = /^\d+(?:\.\d+)?/
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*/

type Token =
  | { type: 'number'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'paren'; value: '(' | ')' }

function tokenize(src: string): Token[] | { error: string } {
  const tokens: Token[] = []
  let index = 0
  while (index < src.length) {
    const ch = src[index]
    if (/\s/.test(ch)) {
      index += 1
      continue
    }
    const rest = src.slice(index)
    const num = NUMBER_RE.exec(rest)
    if (num) {
      tokens.push({ type: 'number', value: parseFloat(num[0]) })
      index += num[0].length
      continue
    }
    const ident = IDENT_RE.exec(rest)
    if (ident) {
      tokens.push({ type: 'ident', value: ident[0] })
      index += ident[0].length
      continue
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch })
      index += 1
      continue
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', value: ch })
      index += 1
      continue
    }
    return { error: `Karakter tidak dikenal: "${ch}"` }
  }
  return tokens
}

class Parser {
  private pos = 0

  constructor(
    private readonly tokens: Token[],
    private readonly inputs: Record<string, number>,
  ) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++]
  }

  parse(): number {
    const value = this.expr()
    if (this.pos !== this.tokens.length) throw new Error('Ekspresi tidak valid')
    return value
  }

  private expr(): number {
    let value = this.term()
    while (true) {
      const op = this.peek()
      if (op?.type !== 'op' || (op.value !== '+' && op.value !== '-')) break
      this.next()
      const rhs = this.term()
      value = op.value === '+' ? value + rhs : value - rhs
    }
    return value
  }

  private term(): number {
    let value = this.factor()
    while (true) {
      const op = this.peek()
      if (op?.type !== 'op' || (op.value !== '*' && op.value !== '/')) break
      this.next()
      const rhs = this.factor()
      if (op.value === '*') {
        value *= rhs
      } else {
        if (rhs === 0) throw new Error('Pembagian dengan nol')
        value /= rhs
      }
    }
    return value
  }

  private factor(): number {
    const token = this.next()
    if (!token) throw new Error('Formula tidak lengkap')
    if (token.type === 'number') return token.value
    if (token.type === 'ident') {
      const value = this.inputs[token.value]
      if (typeof value !== 'number') throw new Error(`Variabel tidak dikenal: ${token.value}`)
      return value
    }
    if (token.type === 'op' && token.value === '-') return -this.factor()
    if (token.type === 'paren' && token.value === '(') {
      const inner = this.expr()
      const close = this.next()
      if (!close || close.type !== 'paren' || close.value !== ')') {
        throw new Error('Tanda kurung tidak seimbang')
      }
      return inner
    }
    throw new Error('Ekspresi tidak valid')
  }
}

/**
 * Evaluate `formula` against `inputs`. Returns `{ ok: false, error }` on any
 * syntax error, unknown variable, unbalanced parens, or division by zero.
 */
export function evaluateFormulaResult(
  formula: string,
  inputs: Record<string, number>,
): FormulaResult {
  const src = (formula ?? '').trim()
  if (!src) return { ok: false, error: 'Formula wajib diisi' }
  if (src.length > MAX_LENGTH) return { ok: false, error: `Formula maksimal ${MAX_LENGTH} karakter` }

  const tokens = tokenize(src)
  if ('error' in tokens) return { ok: false, error: tokens.error }
  if (tokens.length === 0) return { ok: false, error: 'Formula wajib diisi' }

  const unknown = Array.from(
    new Set(
      tokens
        .filter((t): t is Extract<Token, { type: 'ident' }> => t.type === 'ident')
        .filter((t) => typeof inputs[t.value] !== 'number')
        .map((t) => t.value),
    ),
  )
  if (unknown.length > 0) {
    return { ok: false, error: `Variabel tidak dikenal: ${unknown.join(', ')}` }
  }

  try {
    return { ok: true, value: new Parser(tokens, inputs).parse() }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Formula tidak valid' }
  }
}

/**
 * Evaluate `formula` against `inputs`; returns the numeric result, or `NaN`
 * when the formula is invalid.
 */
export function evaluateFormula(formula: string, inputs: Record<string, number>): number {
  const result = evaluateFormulaResult(formula, inputs)
  return result.ok ? result.value : NaN
}