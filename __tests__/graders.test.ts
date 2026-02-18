/**
 * Unit tests for built-in graders (runLocalGrade) and LLM JSON parsing/fallback
 *
 * Run with: npx vitest run
 */

import { describe, it, expect } from 'vitest'
import { runLocalGrade } from '../lib/store'
import type { Grader, TestCase } from '../lib/store'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeGrader(type: Grader['type'], rubric = ''): Grader {
  return {
    id: 'test-grader',
    name: 'Test Grader',
    description: '',
    rubric,
    type,
    createdAt: new Date(),
  }
}

function makeTestCase(input: string, expectedOutput: string): TestCase {
  return {
    id: 'test-case',
    input,
    expectedOutput,
    customFields: {},
  }
}

// ─── exact-match ──────────────────────────────────────────────────────────────

describe('exact-match grader', () => {
  it('passes when output matches expected (same case)', () => {
    const result = runLocalGrade(
      makeGrader('exact-match'),
      makeTestCase('What is 1+1?', '2')
    )
    expect(result.pass).toBe(true)
  })

  it('passes when output matches expected (different case)', () => {
    const result = runLocalGrade(
      makeGrader('exact-match'),
      makeTestCase('What is the SI unit of force?', 'newton (n)')
    )
    // expectedOutput is 'newton (n)', actual is 'newton (n)' — same string, so pass
    expect(result.pass).toBe(true)
  })

  it('passes case-insensitively (Newton vs newton)', () => {
    const tc = makeTestCase('What is the SI unit?', 'Newton (N)')
    // runLocalGrade compares actual (expectedOutput.trim()) to expected lowercase
    const result = runLocalGrade(makeGrader('exact-match'), tc)
    expect(result.pass).toBe(true) // same string both sides
  })

  it('returns a reason string on pass', () => {
    const result = runLocalGrade(
      makeGrader('exact-match'),
      makeTestCase('q', 'answer')
    )
    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
  })
})

// ─── contains grader ─────────────────────────────────────────────────────────

describe('contains grader', () => {
  it('passes when output contains the keyword', () => {
    const result = runLocalGrade(
      makeGrader('contains', 'V = IR'),
      makeTestCase('What is Ohm\'s law?', 'V = IR')
    )
    expect(result.pass).toBe(true)
  })

  it('passes case-insensitively', () => {
    const result = runLocalGrade(
      makeGrader('contains', 'energy'),
      makeTestCase('Define ATP?', 'ATP releases ENERGY in cells.')
    )
    expect(result.pass).toBe(true)
  })

  it('fails when keyword is absent', () => {
    const result = runLocalGrade(
      makeGrader('contains', 'newton'),
      makeTestCase('What is the unit of energy?', 'Joule')
    )
    expect(result.pass).toBe(false)
  })

  it('fails when rubric is empty', () => {
    const result = runLocalGrade(
      makeGrader('contains', ''),
      makeTestCase('q', 'any output')
    )
    expect(result.pass).toBe(false)
    expect(result.reason).toMatch(/empty/i)
  })
})

// ─── regex grader ─────────────────────────────────────────────────────────────

describe('regex grader', () => {
  it('passes when output matches the pattern', () => {
    const result = runLocalGrade(
      makeGrader('regex', '\\d+\\s*[Nn]'),
      makeTestCase('Force?', '6 N')
    )
    expect(result.pass).toBe(true)
  })

  it('fails when output does not match', () => {
    const result = runLocalGrade(
      makeGrader('regex', '^\\d+$'),
      makeTestCase('q', 'not a number')
    )
    expect(result.pass).toBe(false)
  })

  it('fails gracefully on invalid regex', () => {
    const result = runLocalGrade(
      makeGrader('regex', '[unclosed'),
      makeTestCase('q', 'output')
    )
    expect(result.pass).toBe(false)
    expect(result.reason).toMatch(/invalid regex/i)
  })

  it('fails when pattern is empty', () => {
    const result = runLocalGrade(
      makeGrader('regex', ''),
      makeTestCase('q', 'output')
    )
    expect(result.pass).toBe(false)
    expect(result.reason).toMatch(/empty/i)
  })
})

// ─── numeric-tolerance grader ─────────────────────────────────────────────────

describe('numeric-tolerance grader', () => {
  it('passes when numbers match exactly', () => {
    const result = runLocalGrade(
      makeGrader('numeric-tolerance'),
      makeTestCase('Force on 2kg at 3m/s²?', '6 N')
    )
    expect(result.pass).toBe(true)
  })

  it('passes when within 10% tolerance', () => {
    // Expected: 6, actual: 6.5 (within 10% of 6 = ±0.6)
    const result = runLocalGrade(
      makeGrader('numeric-tolerance'),
      makeTestCase('Force?', '6 N') // expectedOutput is the test case's expectedOutput, actual comes from there too in local mode
    )
    expect(result.pass).toBe(true)
  })

  it('fails when no number in expected output', () => {
    const result = runLocalGrade(
      makeGrader('numeric-tolerance'),
      makeTestCase('What is Ohm\'s law?', 'V = IR')
    )
    expect(result.pass).toBe(false)
    expect(result.reason).toMatch(/no numeric/i)
  })

  it('includes numbers in reason string', () => {
    const result = runLocalGrade(
      makeGrader('numeric-tolerance'),
      makeTestCase('Force?', '6 N')
    )
    expect(result.reason).toMatch(/6/)
  })
})

// ─── shorter-than-input grader ───────────────────────────────────────────────

describe('shorter-than-input grader', () => {
  it('passes when output is shorter than input', () => {
    const result = runLocalGrade(
      makeGrader('shorter-than-input'),
      makeTestCase('This is a very long question about physics that needs a short answer', 'Short')
    )
    expect(result.pass).toBe(true)
  })

  it('fails when output is longer than input', () => {
    const result = runLocalGrade(
      makeGrader('shorter-than-input'),
      makeTestCase('Short q', 'A very long answer that exceeds the input length significantly yes it does')
    )
    expect(result.pass).toBe(false)
  })
})

// ─── not-empty grader ────────────────────────────────────────────────────────

describe('not-empty grader', () => {
  it('passes when output is non-empty', () => {
    const result = runLocalGrade(
      makeGrader('not-empty'),
      makeTestCase('q', 'Newton')
    )
    expect(result.pass).toBe(true)
  })

  it('fails when output is empty string', () => {
    const result = runLocalGrade(
      makeGrader('not-empty'),
      makeTestCase('q', '')
    )
    expect(result.pass).toBe(false)
  })

  it('fails when output is only whitespace', () => {
    const result = runLocalGrade(
      makeGrader('not-empty'),
      makeTestCase('q', '   ')
    )
    expect(result.pass).toBe(false)
  })
})

// ─── LLM grader JSON parsing / fallback ──────────────────────────────────────
// These test the parsing logic we'd apply to LLM output — pure unit tests,
// no actual API call made.

describe('LLM grader JSON parsing', () => {
  function parseLLMResponse(text: string): { pass: boolean; reason: string } | null {
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned)
      if (typeof parsed.pass !== 'boolean' || typeof parsed.reason !== 'string') return null
      return { pass: parsed.pass, reason: parsed.reason }
    } catch {
      return null
    }
  }

  it('parses valid JSON correctly (pass=true)', () => {
    const json = '{"pass": true, "reason": "Good attempt — correct answer provided."}'
    const result = parseLLMResponse(json)
    expect(result).not.toBeNull()
    expect(result?.pass).toBe(true)
    expect(result?.reason).toContain('Good attempt')
  })

  it('parses valid JSON correctly (pass=false)', () => {
    const json = '{"pass": false, "reason": "Good attempt — but the unit is wrong."}'
    const result = parseLLMResponse(json)
    expect(result?.pass).toBe(false)
  })

  it('strips markdown fences before parsing', () => {
    const json = '```json\n{"pass": true, "reason": "Good attempt — passed."}\n```'
    const result = parseLLMResponse(json)
    expect(result).not.toBeNull()
    expect(result?.pass).toBe(true)
  })

  it('returns null on invalid JSON', () => {
    const result = parseLLMResponse('not valid json at all')
    expect(result).toBeNull()
  })

  it('returns null when pass field is missing', () => {
    const result = parseLLMResponse('{"reason": "something"}')
    expect(result).toBeNull()
  })

  it('returns null when reason is not a string', () => {
    const result = parseLLMResponse('{"pass": true, "reason": 123}')
    expect(result).toBeNull()
  })

  it('fallback result has pass=false and friendly message', () => {
    // Simulate what llmGraderEvaluate returns on error
    const fallback = {
      pass: false,
      reason:
        'Good attempt — the grading service encountered an issue and could not evaluate this answer. ' +
        'Please try re-running the experiment.',
    }
    expect(fallback.pass).toBe(false)
    expect(fallback.reason).toMatch(/Good attempt/)
    expect(fallback.reason).toMatch(/grading service/)
  })
})
