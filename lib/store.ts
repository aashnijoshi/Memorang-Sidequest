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

export type GraderType = "exact-match" | "contains" | "regex" | "shorter-than-input" | "not-empty"

export const GRADER_TYPES: { value: GraderType; label: string; description: string }[] = [
  { value: "exact-match", label: "Exact Match", description: "Output must exactly equal the expected output" },
  { value: "contains", label: "Contains", description: "Output must contain the expected output as a substring" },
  { value: "regex", label: "Regex", description: "Output must match the regex pattern in the rubric field" },
  { value: "shorter-than-input", label: "Shorter Than Input", description: "Output must be shorter in length than the input" },
  { value: "not-empty", label: "Not Empty", description: "Output must not be empty or whitespace-only" },
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

export function runLocalGrade(
  grader: Grader,
  testCase: TestCase
): GradeResult {
  const { input, expectedOutput } = testCase
  const output = expectedOutput.trim()
  const inp = input.trim()

  switch (grader.type) {
    case "exact-match": {
      const pass = output === inp || output === expectedOutput
      return {
        pass: output.length > 0 && output === expectedOutput.trim(),
        reason: pass
          ? "Output exactly matches expected output."
          : `Output does not exactly match. Expected "${expectedOutput.trim()}", got "${output}".`,
      }
    }
    case "contains": {
      const keyword = grader.rubric.trim().toLowerCase()
      if (!keyword) {
        return { pass: false, reason: "Rubric (keyword) is empty." }
      }
      const pass = output.toLowerCase().includes(keyword)
      return {
        pass,
        reason: pass
          ? `Output contains "${grader.rubric.trim()}".`
          : `Output does not contain "${grader.rubric.trim()}".`,
      }
    }
    case "regex": {
      const pattern = grader.rubric.trim()
      if (!pattern) {
        return { pass: false, reason: "Rubric (regex pattern) is empty." }
      }
      try {
        const re = new RegExp(pattern, "i")
        const pass = re.test(output)
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
    case "shorter-than-input": {
      const pass = output.length < inp.length && output.length > 0
      return {
        pass,
        reason: pass
          ? `Output (${output.length} chars) is shorter than input (${inp.length} chars).`
          : `Output (${output.length} chars) is not shorter than input (${inp.length} chars).`,
      }
    }
    case "not-empty": {
      const pass = output.length > 0
      return {
        pass,
        reason: pass
          ? "Output is not empty."
          : "Output is empty.",
      }
    }
    default:
      return { pass: false, reason: "Unknown grader type." }
  }
}

// --- Seed data ---

const exampleDataset = store.addDataset("Summarization QA")
const cases = [
  {
    input: "The mitochondria is the powerhouse of the cell. It produces ATP through cellular respiration, converting glucose and oxygen into energy.",
    expectedOutput: "Mitochondria produce ATP via cellular respiration, converting glucose and oxygen into energy.",
  },
  {
    input: "Water boils at 100 degrees Celsius at standard atmospheric pressure. At higher altitudes, water boils at lower temperatures due to decreased air pressure.",
    expectedOutput: "Water boils at 100C at standard pressure but at lower temperatures at higher altitudes due to reduced air pressure.",
  },
  {
    input: "Photosynthesis is the process by which green plants use sunlight, water, and carbon dioxide to create oxygen and glucose. It primarily occurs in the leaves.",
    expectedOutput: "Photosynthesis converts sunlight, water, and CO2 into oxygen and glucose, mainly in plant leaves.",
  },
]
for (const c of cases) {
  const tc = store.addTestCase(exampleDataset.id)
  store.updateTestCase(exampleDataset.id, tc.id, {
    input: c.input,
    expectedOutput: c.expectedOutput,
  })
}

store.addGrader(
  "Is Concise",
  "Checks that the expected output is shorter than the input.",
  "",
  "shorter-than-input"
)

store.addGrader(
  "Not Empty",
  "Checks that the expected output is not empty or whitespace.",
  "",
  "not-empty"
)

store.addGrader(
  "Mentions Energy",
  "Checks that the expected output mentions the word 'energy'.",
  "energy",
  "contains"
)
