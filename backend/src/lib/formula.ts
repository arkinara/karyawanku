/**
 * KaryawanKu — safe formula evaluator for salary components (ticket #20).
 *
 * No `eval` / `new Function`: input is hand-tokenized and parsed with a
 * recursive-descent parser. Supports numbers (incl. decimals), `+ - * /`,
 * parentheses, and variables resolved from the `variables` record
 * (`gaji_pokok`, `jam_kerja`, `jam_lembur`, `tarif_lembur`, ...).
 */

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
    let op = this.peek()
    while (op?.type === 'op' && (op.value === '+' || op.value === '-')) {
      this.next()
      const rhs = this.term()
      value = op.value === '+' ? value + rhs : value - rhs
      op = this.peek()
    }
    return value
  }

  private term(): number {
    let value = this.factor()
    let op = this.peek()
    while (op?.type === 'op' && (op.value === '*' || op.value === '/')) {
      this.next()
      const rhs = this.factor()
      if (op.value === '*') {
        value *= rhs
      } else {
        if (rhs === 0) throw new Error('Pembagian dengan nol')
        value /= rhs
      }
      op = this.peek()
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
 * Evaluate `formula` against `variables`. Returns `{ result }` on success, or
 * `{ error }` on any syntax error, unknown variable, unbalanced parens, or
 * division by zero.
 */
export function evaluate(
  formula: string,
  variables: Record<string, number>,
): { result?: number; error?: string } {
  const src = (formula ?? '').trim()
  if (!src) return { error: 'Formula wajib diisi' }
  if (src.length > MAX_LENGTH) return { error: `Formula maksimal ${MAX_LENGTH} karakter` }

  const tokens = tokenize(src)
  if ('error' in tokens) return { error: tokens.error }
  if (tokens.length === 0) return { error: 'Formula wajib diisi' }

  const unknown = Array.from(
    new Set(
      tokens
        .filter((t): t is Extract<Token, { type: 'ident' }> => t.type === 'ident')
        .filter((t) => typeof variables[t.value] !== 'number')
        .map((t) => t.value),
    ),
  )
  if (unknown.length > 0) {
    return { error: `Variabel tidak dikenal: ${unknown.join(', ')}` }
  }

  try {
    return { result: new Parser(tokens, variables).parse() }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Formula tidak valid' }
  }
}

/**
 * Dummy values for the supported salary variables, used to validate a formula
 * at save time (unknown variables / syntax errors are rejected before persist).
 */
export const SAMPLE_SALARY_VARIABLES: Record<string, number> = {
  gaji_pokok: 1,
  jam_kerja: 1,
  jam_lembur: 1,
  tarif_lembur: 1,
}

/** Validates a formula using the supported variable set. Returns error string or null. */
export function validateFormula(formula: string): string | null {
  const res = evaluate(formula, SAMPLE_SALARY_VARIABLES)
  return res.error ?? null
}
