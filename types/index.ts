// A single dataset row (one test case)
export interface Dataset {
  id: string;
  input: string;
  expected_output: string;
  [key: string]: string; // allows custom fields
}

// A grader definition
export interface Grader {
  id: string;
  name: string;
  description: string;
  rubric: string;
}

// Result from the API
export interface Result {
  datasetId: string;
  graderId: string;
  passed: boolean;
  reason: string;
}

// Used by the grading API
export interface GradeResult {
  passed: boolean;
  reason: string;
  input: string;
  expected: string;
  datasetId: string;
  graderId: string;
}