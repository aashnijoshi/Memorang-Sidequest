import Anthropic from '@anthropic-ai/sdk';
import { Dataset } from '@/types';

// Initialize the Anthropic client with your API key
// process.env.ANTHROPIC_API_KEY reads from your .env.local file
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// INTERFACE: What we expect from the grading function
export interface GradeResult {
  passed: boolean;      // Did it pass the grader's criteria?
  reason: string;       // Why did it pass or fail?
  input: string;        // Echo back the input (for reference)
  expected: string;     // Echo back the expected output
  datasetId: string;    // Which dataset row was graded
  graderId: string;     // Which grader was used
}

/**
 * MAIN FUNCTION: Grade a single dataset row with a single grader
 * 
 * How it works:
 * 1. We build a prompt that explains the task to Claude
 * 2. We send the dataset input, expected output, and grader rubric
 * 3. Claude evaluates and returns pass/fail + reasoning
 * 4. We parse the response and return a structured result
 * 
 * @param dataset - The test case (input + expected output)
 * @param graderRubric - The evaluation criteria
 * @param graderId - ID of the grader (for tracking)
 * @returns Promise<GradeResult> - The grading result
 */
export async function gradeWithLLM(
  dataset: Dataset,
  graderRubric: string,
  graderId: string
): Promise<GradeResult> {
  
  // Build the prompt for Claude
  // This is critical - clear instructions = better results
  const prompt = `You are an evaluation assistant. Your job is to grade a test case based on specific criteria.

TEST CASE:
Input: ${dataset.input}
Expected Output: ${dataset.expected_output}

GRADING RUBRIC:
${graderRubric}

TASK:
Evaluate whether the expected output meets the criteria in the rubric. 

Respond ONLY in this exact JSON format (no markdown, no explanation):
{
  "passed": true or false,
  "reason": "Brief explanation of why it passed or failed"
}`;

  try {
    // Call the Anthropic API
    // We're using Claude Sonnet - fast and smart
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',  // Latest Sonnet model
      max_tokens: 1024,                    // Limit response length
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      // Temperature 0 = deterministic, consistent grading
      temperature: 0,
    });

    // Extract the text response from Claude
    const response = message.content[0];
    if (response.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse Claude's JSON response
    // Example: { "passed": true, "reason": "The output correctly..." }
    const result = JSON.parse(response.text);

    // Return structured result
    return {
      passed: result.passed,
      reason: result.reason,
      input: dataset.input,
      expected: dataset.expected_output,
      datasetId: dataset.id,
      graderId: graderId,
    };

  } catch (error) {
    // Error handling - important for production!
    console.error('Grading error:', error);
    
    // Return a failure result with error details
    return {
      passed: false,
      reason: `Error during grading: ${error instanceof Error ? error.message : 'Unknown error'}`,
      input: dataset.input,
      expected: dataset.expected_output,
      datasetId: dataset.id,
      graderId: graderId,
    };
  }
}

/**
 * BATCH FUNCTION: Grade multiple datasets with multiple graders
 * 
 * This runs all combinations:
 * - Dataset 1 × Grader 1
 * - Dataset 1 × Grader 2
 * - Dataset 2 × Grader 1
 * - Dataset 2 × Grader 2
 * ... etc
 * 
 * Why not parallel? To avoid rate limits and make progress trackable
 * In production, you'd use a job queue or rate-limited parallelization
 * 
 * @param datasets - All test cases to evaluate
 * @param graders - All graders to use
 * @param onProgress - Callback for progress updates (optional)
 * @returns Promise<GradeResult[]> - All grading results
 */
export async function gradeAll(
  datasets: Dataset[],
  graders: Array<{ id: string; name: string; rubric: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<GradeResult[]> {
  
  const results: GradeResult[] = [];
  const total = datasets.length * graders.length;
  let current = 0;

  // Nested loop: for each dataset, run each grader
  for (const dataset of datasets) {
    for (const grader of graders) {
      
      // Grade this combination
      const result = await gradeWithLLM(
        dataset,
        grader.rubric,
        grader.id
      );
      
      results.push(result);
      current++;
      
      // Report progress if callback provided
      if (onProgress) {
        onProgress(current, total);
      }
      
      // Small delay to avoid rate limits (100ms between calls)
      // In production, you'd use exponential backoff
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}