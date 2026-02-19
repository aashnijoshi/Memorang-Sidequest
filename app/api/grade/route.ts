import { NextRequest, NextResponse } from 'next/server';
import { generateObject, generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { runLocalGrade, isBuiltinGrader } from '@/lib/store';
import type { GraderType } from '@/lib/store';

// ─── Request / response shapes ────────────────────────────────────────────────

interface TestCasePayload {
  id: string;
  input: string;
  expectedOutput: string;
  customFields: Record<string, string>;
}

interface GraderPayload {
  id: string;
  name: string;
  description: string;
  rubric: string;
  type: GraderType;
}

export interface GradeResultPayload {
  testCaseId: string;
  graderId: string;
  pass: boolean;
  reason: string;
}

// ─── Zod schema for LLM grader structured output ─────────────────────────────

const llmGradeSchema = z.object({
  pass: z.boolean().describe('Whether the answer passes the grading rubric'),
  reason: z
    .string()
    .describe(
      'Give supportive feedback. Include correct answer, given answer, why it passed/failed, and 1-2 prep tips. Be sharp but chill.'
    ),
});

// ─── LLM grader: LLM decides pass/fail + reason ──────────────────────────────

async function gradeLLM(
  tc: TestCasePayload,
  grader: GraderPayload
): Promise<{ pass: boolean; reason: string }> {
  try {
    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: llmGradeSchema,
      temperature: 0,
      system: `You are a sharp but chill tutor evaluating student answers across any subject.

RUBRIC: ${grader.rubric}

CONSTRAINTS:
- 1–2 sentences max
- 40 words or less
- If CORRECT: clearly explain why it meets the rubric
- If INCORRECT: say exactly what’s wrong and what the correct idea should be
- Be specific to the actual content
- No generic praise
- Never start with "Good attempt"
- Avoid robotic phrases
- Sound natural, slightly gen-z coded but still academically solid`,
      prompt: `QUESTION: ${tc.input}
EXPECTED ANSWER: ${tc.expectedOutput}
STUDENT ANSWER: ${tc.expectedOutput}

GRADING INSTRUCTIONS:
${grader.rubric}

Evaluate the student answer and return a JSON result.`,
    });

    return { pass: object.pass, reason: object.reason };
  } catch (err) {
    console.error('[gradeLLM] error:', err);
    return {
      pass: false,
      reason:
        'Good attempt — the grading service encountered an issue and could not evaluate this answer. ' +
        'Please try re-running the experiment. ' +
        `(Detail: ${err instanceof Error ? err.message : 'Unknown error'})`,
    };
  }
}

// ─── Built-in grader: deterministic pass/fail, LLM writes the reason ─────────

const graderRuleLabels: Record<string, string> = {
  'exact-match': 'case-insensitive exact match against the expected answer',
  'numeric-tolerance': 'numeric extraction with ±10% tolerance',
  'contains': 'output must contain the keyword defined in the rubric',
  'regex': 'output must match the regex pattern defined in the rubric',
  'shorter-than-input': 'output must be shorter in character length than the input',
  'not-empty': 'output must not be empty or whitespace-only',
};

async function gradeBuiltin(
  tc: TestCasePayload,
  grader: GraderPayload
): Promise<{ pass: boolean; reason: string }> {
  // 1. Deterministic result — this is authoritative, LLM cannot override it
  const det = runLocalGrade(
    {
      id: grader.id,
      name: grader.name,
      description: grader.description,
      rubric: grader.rubric,
      type: grader.type,
      createdAt: new Date(),
    },
    {
      id: tc.id,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      customFields: tc.customFields,
    }
  );

  // 2. Ask LLM for a friendly educational reason
  const ruleDesc = graderRuleLabels[grader.type] ?? grader.type;
  try {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      temperature: 0.3,
      //: 400,
      prompt: `You are a friendly physics tutor providing feedback on a student's answer.

A deterministic grader ("${grader.name}") has already decided: ${det.pass ? 'PASS ✓' : 'FAIL ✗'}
Grader rule: ${ruleDesc}${grader.rubric ? ` ("${grader.rubric}")` : ''}

QUESTION: ${tc.input}
CORRECT ANSWER: ${tc.expectedOutput}
STUDENT ANSWER: ${tc.expectedOutput}
RESULT: ${det.pass ? 'PASS' : 'FAIL'}

Write concise feedback (5 to 10 lines) in a smart, slightly gen z tone — supportive but not generic or robotic.
Requirements:
Avoid repetitive or template-y openings.
Clearly state:
What answer was given.
What the correct answer is.
Whether it passed or failed.
- Explain WHY it ${det.pass ? 'passed' : 'failed'} based on the grader rule (be specific about the rule).
End with 1 or 2 practical, actionable prep tips.
Keep it direct, clear, and natural. No cringe, no fluff, no filler.
DO NOT change the pass/fail decision. Respond with plain text only, no JSON, no markdown.`,
    });

    return { pass: det.pass, reason: text.trim() };
  } catch (err) {
    console.error('[gradeBuiltin] LLM reason error:', err);
    // Fall back to the deterministic reason — pass/fail is still correct
    return { pass: det.pass, reason: det.reason };
  }
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testCases, graders } = body as {
      testCases: TestCasePayload[];
      graders: GraderPayload[];
    };

    if (!testCases?.length || !graders?.length) {
      return NextResponse.json(
        { error: 'Missing testCases or graders' },
        { status: 400 }
      );
    }

    const results: GradeResultPayload[] = [];

    for (const tc of testCases) {
      for (const grader of graders) {
        const { pass, reason } = isBuiltinGrader(grader.type)
          ? await gradeBuiltin(tc, grader)
          : await gradeLLM(tc, grader);

        results.push({ testCaseId: tc.id, graderId: grader.id, pass, reason });

        // Small delay to avoid rate limits
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[/api/grade] error:', error);
    return NextResponse.json({ error: 'Failed to run evaluation' }, { status: 500 });
  }
}
