import { generateText, Output } from "ai"
import { z } from "zod"

const gradeResultSchema = z.object({
  pass: z.boolean().describe("Whether the test case passes the grading rubric"),
  reason: z.string().describe("A brief explanation of why the test case passed or failed"),
})

export async function POST(req: Request) {
  try {
    const { input, expectedOutput, graderName, rubric, customFields } = await req.json()

    const customFieldsText = customFields && Object.keys(customFields).length > 0
      ? `\nAdditional context:\n${Object.entries(customFields)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")}`
      : ""

    const { output } = await generateText({
      model: "openai/gpt-4.1-mini",
      output: Output.object({ schema: gradeResultSchema }),
      messages: [
        {
          role: "system",
          content: `You are an AI evaluation grader named "${graderName}". Your job is to evaluate AI outputs against expected results based on a rubric.

Rubric:
${rubric}

You must determine whether the given output passes or fails the evaluation criteria, and provide a brief reason for your judgment. Be strict but fair.`,
        },
        {
          role: "user",
          content: `Evaluate the following test case:

Input: ${input}
Expected Output: ${expectedOutput}${customFieldsText}

Does this test case pass the evaluation rubric? Respond with your judgment.`,
        },
      ],
    })

    return Response.json(output)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json(
      { error: message },
      { status: 500 }
    )
  }
}
