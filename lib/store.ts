// In-memory state store using SWR-compatible approach with a global singleton

export interface TestCase {
  id: string
  input: string
  expectedOutput: string
  customFields: Record<string, string>
}

export interface Dataset {
  id: string
  name: string
  testCases: TestCase[]
  customColumns: string[]
  createdAt: Date
}

export type GraderType = "exact-match" | "contains" | "regex" | "shorter-than-input" | "not-empty" | "numeric-tolerance" | "llm"

export const BUILTIN_GRADER_TYPES: GraderType[] = [
  "exact-match", "contains", "regex", "shorter-than-input", "not-empty", "numeric-tolerance",
]

export function isBuiltinGrader(type: GraderType): boolean {
  return BUILTIN_GRADER_TYPES.includes(type)
}

export const GRADER_TYPES: { value: GraderType; label: string; description: string }[] = [
  { value: "exact-match", label: "Exact Match", description: "Output must exactly equal the expected output (case-insensitive, trimmed)" },
  { value: "contains", label: "Contains", description: "Output must contain the keyword in the rubric field" },
  { value: "regex", label: "Regex", description: "Output must match the regex pattern in the rubric field" },
  { value: "numeric-tolerance", label: "Numeric Tolerance", description: "Extracts numbers and checks they are within ±10% of expected (good for physics answers)" },
  { value: "shorter-than-input", label: "Shorter Than Input", description: "Output must be shorter in length than the input" },
  { value: "not-empty", label: "Not Empty", description: "Output must not be empty or whitespace-only" },
  { value: "llm", label: "LLM Grader", description: "Claude evaluates pass/fail and explains based on your rubric/instructions" },
]

export interface Grader {
  id: string
  name: string
  description: string
  rubric: string
  type: GraderType
  createdAt: Date
}

export interface GradeResult {
  pass: boolean
  reason: string
}

export interface ExperimentResult {
  id: string
  datasetId: string
  graderIds: string[]
  results: Record<string, Record<string, GradeResult>> // testCaseId -> graderId -> result
  createdAt: Date
}

// Generate unique IDs
let counter = 0
export function generateId(): string {
  counter++
  return `${Date.now()}-${counter}`
}

// Global in-memory store
class Store {
  datasets: Dataset[] = []
  graders: Grader[] = []
  experiments: ExperimentResult[] = []
  private listeners: Set<() => void> = new Set()
  private _snapshot: { datasets: Dataset[]; graders: Grader[]; experiments: ExperimentResult[] } | null = null

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this._snapshot = null
    this.listeners.forEach((l) => l())
  }

  // Dataset CRUD
  addDataset(name: string): Dataset {
    const dataset: Dataset = {
      id: generateId(),
      name,
      testCases: [],
      customColumns: [],
      createdAt: new Date(),
    }
    this.datasets = [...this.datasets, dataset]
    this.notify()
    return dataset
  }

  updateDataset(id: string, updates: Partial<Dataset>) {
    this.datasets = this.datasets.map((d) =>
      d.id === id ? { ...d, ...updates } : d
    )
    this.notify()
  }

  deleteDataset(id: string) {
    this.datasets = this.datasets.filter((d) => d.id !== id)
    this.notify()
  }

  addTestCase(datasetId: string): TestCase {
    const testCase: TestCase = {
      id: generateId(),
      input: "",
      expectedOutput: "",
      customFields: {},
    }
    this.datasets = this.datasets.map((d) =>
      d.id === datasetId
        ? { ...d, testCases: [...d.testCases, testCase] }
        : d
    )
    this.notify()
    return testCase
  }

  updateTestCase(datasetId: string, testCaseId: string, updates: Partial<TestCase>) {
    this.datasets = this.datasets.map((d) =>
      d.id === datasetId
        ? {
            ...d,
            testCases: d.testCases.map((tc) =>
              tc.id === testCaseId ? { ...tc, ...updates } : tc
            ),
          }
        : d
    )
    this.notify()
  }

  deleteTestCase(datasetId: string, testCaseId: string) {
    this.datasets = this.datasets.map((d) =>
      d.id === datasetId
        ? { ...d, testCases: d.testCases.filter((tc) => tc.id !== testCaseId) }
        : d
    )
    this.notify()
  }

  addCustomColumn(datasetId: string, columnName: string) {
    this.datasets = this.datasets.map((d) =>
      d.id === datasetId
        ? { ...d, customColumns: [...d.customColumns, columnName] }
        : d
    )
    this.notify()
  }

  removeCustomColumn(datasetId: string, columnName: string) {
    this.datasets = this.datasets.map((d) =>
      d.id === datasetId
        ? {
            ...d,
            customColumns: d.customColumns.filter((c) => c !== columnName),
            testCases: d.testCases.map((tc) => {
              const newFields = { ...tc.customFields }
              delete newFields[columnName]
              return { ...tc, customFields: newFields }
            }),
          }
        : d
    )
    this.notify()
  }

  // Grader CRUD
  addGrader(name: string, description: string, rubric: string, type: GraderType = "contains"): Grader {
    const grader: Grader = {
      id: generateId(),
      name,
      description,
      rubric,
      type,
      createdAt: new Date(),
    }
    this.graders = [...this.graders, grader]
    this.notify()
    return grader
  }

  updateGrader(id: string, updates: Partial<Grader>) {
    this.graders = this.graders.map((g) =>
      g.id === id ? { ...g, ...updates } : g
    )
    this.notify()
  }

  deleteGrader(id: string) {
    this.graders = this.graders.filter((g) => g.id !== id)
    this.notify()
  }

  // Experiment
  addExperiment(result: ExperimentResult) {
    this.experiments = [...this.experiments, result]
    this.notify()
  }

  getSnapshot() {
    if (!this._snapshot) {
      this._snapshot = {
        datasets: this.datasets,
        graders: this.graders,
        experiments: this.experiments,
      }
    }
    return this._snapshot
  }
}

export const store = new Store()

// --- Deterministic local grading ---

/** Extract all numeric values from a string */
function extractNumbers(s: string): number[] {
  const matches = s.match(/-?\d+(\.\d+)?/g)
  return matches ? matches.map(Number) : []
}

/**
 * Deterministic local grader — runs synchronously, no API calls.
 * Returns { pass, reason } with a short deterministic reason string.
 * The reason is later enriched by the LLM via llm_reason_explain().
 *
 * NOTE: for type "llm", this should NOT be called — use llmGraderEvaluate() instead.
 */
export function runLocalGrade(
  grader: Grader,
  testCase: TestCase
): GradeResult {
  const { input, expectedOutput } = testCase
  const actual = expectedOutput.trim()
  const inp = input.trim()

  switch (grader.type) {
    case "exact-match": {
      const pass = actual.toLowerCase() === expectedOutput.trim().toLowerCase()
      return {
        pass,
        reason: pass
          ? `Exact match: output matches expected (case-insensitive).`
          : `Exact match failed. Expected "${expectedOutput.trim()}", got "${actual}".`,
      }
    }
    case "contains": {
      const keyword = grader.rubric.trim().toLowerCase()
      if (!keyword) {
        return { pass: false, reason: "Rubric (keyword) is empty." }
      }
      const pass = actual.toLowerCase().includes(keyword)
      return {
        pass,
        reason: pass
          ? `Output contains keyword "${grader.rubric.trim()}".`
          : `Output does not contain keyword "${grader.rubric.trim()}".`,
      }
    }
    case "regex": {
      const pattern = grader.rubric.trim()
      if (!pattern) {
        return { pass: false, reason: "Rubric (regex pattern) is empty." }
      }
      try {
        const re = new RegExp(pattern, "i")
        const pass = re.test(actual)
        return {
          pass,
          reason: pass
            ? `Output matches pattern /${pattern}/i.`
            : `Output does not match pattern /${pattern}/i.`,
        }
      } catch {
        return { pass: false, reason: `Invalid regex pattern: ${pattern}` }
      }
    }
    case "numeric-tolerance": {
      const expectedNums = extractNumbers(expectedOutput)
      const actualNums = extractNumbers(actual)
      if (expectedNums.length === 0) {
        return { pass: false, reason: "No numeric value found in expected output." }
      }
      if (actualNums.length === 0) {
        return { pass: false, reason: `No numeric value found in output. Expected approximately ${expectedNums[0]}.` }
      }
      // Compare first numeric value with 10% tolerance
      const expected = expectedNums[0]
      const got = actualNums[0]
      const tolerance = Math.abs(expected) * 0.10 + 0.001 // +0.001 to handle zero
      const pass = Math.abs(got - expected) <= tolerance
      return {
        pass,
        reason: pass
          ? `Numeric match: ${got} is within 10% tolerance of expected ${expected}.`
          : `Numeric mismatch: got ${got}, expected ${expected} (±10% = ±${tolerance.toFixed(3)}).`,
      }
    }
    case "shorter-than-input": {
      const pass = actual.length < inp.length && actual.length > 0
      return {
        pass,
        reason: pass
          ? `Output (${actual.length} chars) is shorter than input (${inp.length} chars).`
          : `Output (${actual.length} chars) is not shorter than input (${inp.length} chars).`,
      }
    }
    case "not-empty": {
      const pass = actual.length > 0
      return {
        pass,
        reason: pass ? "Output is not empty." : "Output is empty.",
      }
    }
    case "llm":
      // LLM graders must go through llmGraderEvaluate() in lib/llm-grader.ts
      return { pass: false, reason: "LLM grader requires async evaluation — use llmGraderEvaluate()." }
    default:
      return { pass: false, reason: "Unknown grader type." }
  }
}

// --- Seed data ---

// Physics starter dataset
const physicsDataset = store.addDataset("Physics Starter Dataset")
const physicsCases = [
  {
    input: "What is the SI unit of force?",
    expectedOutput: "Newton (N)",
  },
  {
    input: "A 2 kg object accelerates at 3 m/s². What net force acts on it?",
    expectedOutput: "6 N",
  },
  {
    input: "What is the relationship between electric potential difference, current, and resistance?",
    expectedOutput: "V = IR",
  },
]
for (const c of physicsCases) {
  const tc = store.addTestCase(physicsDataset.id)
  store.updateTestCase(physicsDataset.id, tc.id, {
    input: c.input,
    expectedOutput: c.expectedOutput,
  })
}

// Built-in graders
store.addGrader(
  "Exact Match",
  "Checks that the output exactly matches the expected answer (case-insensitive, trimmed).",
  "",
  "exact-match"
)

store.addGrader(
  "Numeric Tolerance",
  "Extracts numeric values and checks they are within ±10% of the expected number. Good for physics calculations.",
  "",
  "numeric-tolerance"
)

store.addGrader(
  "Contains Key Concept",
  "Checks that the output contains the key term or formula defined in the rubric.",
  "V = IR",
  "contains"
)
