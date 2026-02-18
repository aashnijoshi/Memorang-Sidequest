/**
 * LLM Grading Utilities
 *
 * Two pathways:
 *  1. llmGraderEvaluate() — for user-created "llm" graders: LLM decides pass/fail + reason
 *  2. llmReasonExplain()  — for built-in graders: pass/fail already known; LLM writes a human reason
 *
 * Both functions are cached in-memory keyed by a hash of their inputs.
 * API key: process.env.ANTHROPIC_API_KEY (set in .env.local)
 */

import Anthropic from '@anthropic-ai/sdk';

// ─── Anthropic client ────────────────────────────────────────────────────────
// Key is loaded from ANTHROPIC_API_KEY env var — never hardcoded.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LLMGradeResult {
  pass: boolean;
  reason: string;
}

// ─── Simple in-memory cache ──────────────────────────────────────────────────

const cache = new Map<string, LLMGradeResult | string>();

/** Deterministic hash for cache keys — no crypto dep needed */
function hashKey(...parts: string[]): string {
  const str = parts.join('\x00');
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0; // keep as uint32
  }
  return h.toString(36);
}

// ─── Pathway 1: LLM Grader Evaluate ─────────────────────────────────────────
// For user-created graders (type === "llm").
// LLM decides BOTH pass/fail and writes the reason.

/**
 * Evaluate a test case using an LLM grader.
 * The LLM decides pass/fail based on the grader's rubric/instructions.
 *
 * @param question         - The input question / prompt
 * @param expectedOutput   - The expected/correct answer
 * @param actualOutput     - What the model/student answered (in our app this is also expectedOutput since we're grading datasets, not live model outputs)
 * @param graderName       - Display name of the grader
 * @param graderInstructions - The rubric / grading criteria written by the user
 * @returns { pass, reason }
 */
export async function llmGraderEvaluate(
  question: string,
  expectedOutput: string,
  actualOutput: string,
  graderName: string,
  graderInstructions: string
): Promise<LLMGradeResult> {
  const cacheKey = 'eval:' + hashKey(question, expectedOutput, actualOutput, graderInstructions);
  const cached = cache.get(cacheKey);
  if (cached && typeof cached === 'object') return cached as LLMGradeResult;

  const prompt = `You are an expert AI evaluation grader named "${graderName}".

Your job is to evaluate a student answer against an expected answer, using the grading instructions provided.

---
QUESTION:
${question}

EXPECTED ANSWER:
${expectedOutput}

STUDENT ANSWER:
${actualOutput}

GRADING INSTRUCTIONS:
${graderInstructions}
---

Evaluate the student answer. Respond with STRICT JSON only (no markdown, no explanation outside JSON):
{
  "pass": true or false,
  "reason": "Good attempt — [your detailed feedback here. Include: correct answer, given answer, why it passed/failed based on the rubric, and 1-2 quick prep tips. Keep to 5-10 lines.]"
}

The reason MUST start with "Good attempt — " even if the answer fails.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0];
    if (text.type !== 'text') throw new Error('Unexpected response type');

    // Strip markdown fences if present
    const cleaned = text.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (typeof parsed.pass !== 'boolean' || typeof parsed.reason !== 'string') {
      throw new Error('Invalid JSON shape from LLM');
    }

    const result: LLMGradeResult = { pass: parsed.pass, reason: parsed.reason };
    cache.set(cacheKey, result);
    return result;

  } catch (err) {
    console.error('[llmGraderEvaluate] error:', err);
    // Fallback: do not crash UI
    return {
      pass: false,
      reason:
        'Good attempt — the grading service encountered an issue and could not evaluate this answer. ' +
        'Please try re-running the experiment. ' +
        `(Technical detail: ${err instanceof Error ? err.message : 'Unknown error'})`,
    };
  }
}

// ─── Pathway 2: LLM Reason Explain ──────────────────────────────────────────
// For built-in graders. Pass/fail is already decided deterministically.
// The LLM only writes a friendly, educational reason string.

/**
 * Generate a human-friendly reason for a deterministic grading result.
 * The LLM CANNOT override pass/fail — it only explains.
 *
 * @param question              - The input question
 * @param expectedOutput        - The correct answer
 * @param actualOutput          - The answer that was evaluated
 * @param pass                  - The deterministic pass/fail result (LLM cannot change this)
 * @param graderName            - Display name of the grader
 * @param graderRuleDescription - Short description of the deterministic rule
 * @returns reason string
 */
export async function llmReasonExplain(
  question: string,
  expectedOutput: string,
  actualOutput: string,
  pass: boolean,
  graderName: string,
  graderRuleDescription: string
): Promise<string> {
  const cacheKey = 'reason:' + hashKey(question, expectedOutput, actualOutput, String(pass), graderRuleDescription);
  const cached = cache.get(cacheKey);
  if (cached && typeof cached === 'string') return cached;

  const prompt = `You are a friendly physics tutor providing feedback on a student's answer.

A deterministic grader ("${graderName}") has already decided the result: ${pass ? 'PASS ✓' : 'FAIL ✗'}.
Grader rule: ${graderRuleDescription}

---
QUESTION: ${question}
CORRECT ANSWER: ${expectedOutput}
STUDENT ANSWER: ${actualOutput}
RESULT: ${pass ? 'PASS' : 'FAIL'}
---

Write a concise, encouraging feedback message (5-10 lines). Requirements:
- Start with "Good attempt — " (even if it failed)
- Explicitly mention the correct answer
- Explicitly mention what the student gave
- Explain WHY it ${pass ? 'passed' : 'failed'} in terms of the grader rule
- Add 1-2 practical prep tips

DO NOT change the pass/fail decision — it was set deterministically and is final.
Respond with only the feedback text (no JSON, no markdown).`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0];
    if (text.type !== 'text') throw new Error('Unexpected response type');

    const reason = text.text.trim();
    cache.set(cacheKey, reason);
    return reason;

  } catch (err) {
    console.error('[llmReasonExplain] error:', err);
    // Friendly deterministic fallback — keep pass/fail from caller
    return pass
      ? `Good attempt — this answer passed the "${graderName}" check. The correct answer is "${expectedOutput}" and your response matched the required criteria. Keep reviewing your physics concepts to stay sharp!`
      : `Good attempt — this answer did not pass the "${graderName}" check. The correct answer is "${expectedOutput}" but the response did not meet the criteria (${graderRuleDescription}). Review this concept and practice similar problems to improve.`;
  }
}

/** Clear the in-memory cache (useful for testing) */
export function clearLLMCache(): void {
  cache.clear();
}
