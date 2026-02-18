import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { Dataset } from '@/types';

// Zod schema for type-safe parsing
const gradeResultSchema = z.object({
  passed: z.boolean().describe("Whether the test case passes the grading rubric"),
  reason: z.string().describe("A brief explanation of why the test case passed or failed"),
});

/**
 * Grade a single dataset with a single grader
 * Uses Vercel AI SDK + Zod for type safety
 */
async function gradeOne(
  dataset: Dataset,
  grader: { id: string; name: string; rubric: string }
) {
  try {
    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: gradeResultSchema,
      system: `You are an AI evaluation grader named "${grader.name}". Your job is to evaluate outputs against expected results based on a rubric.

Rubric:
${grader.rubric}

Be strict but fair in your evaluation.`,
      prompt: `Evaluate this test case:

Input: ${dataset.input}
Expected Output: ${dataset.expected_output}

Does this pass the rubric?`,
    });

    return {
      passed: object.passed,
      reason: object.reason,
      input: dataset.input,
      expected: dataset.expected_output,
      datasetId: dataset.id,
      graderId: grader.id,
    };
  } catch (error) {
    console.error('Grading error:', error);
    return {
      passed: false,
      reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      input: dataset.input,
      expected: dataset.expected_output,
      datasetId: dataset.id,
      graderId: grader.id,
    };
  }
}

/**
 * POST endpoint: Grade multiple datasets with multiple graders
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { datasets, graders } = body;

    // Validation
    if (!datasets || !graders || datasets.length === 0 || graders.length === 0) {
      return NextResponse.json(
        { error: 'Missing datasets or graders' },
        { status: 400 }
      );
    }

    // Grade all combinations (dataset × grader)
    const results = [];
    for (const dataset of datasets) {
      for (const grader of graders) {
        const result = await gradeOne(dataset, grader);
        results.push(result);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return NextResponse.json({ results });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to run evaluation' },
      { status: 500 }
    );
  }
}