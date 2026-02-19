import { create } from 'zustand';
import type { GraderType, ExperimentResult } from '@/lib/store';

// Test case within a dataset
export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  customFields: Record<string, string>;
}

// Dataset contains multiple test cases
export interface Dataset {
  id: string;
  name: string;
  testCases: TestCase[];
  customColumns: string[];
  createdAt: string;
}

// Grader definition — type is aligned with lib/store GraderType
export interface Grader {
  id: string;
  name: string;
  description: string;
  rubric: string;
  type: GraderType;
}

// Result from evaluation
export interface Result {
  datasetId: string;
  graderId: string;
  passed: boolean;
  reason: string;
}

// Store interface
interface StoreState {
  datasets: Dataset[];
  graders: Grader[];
  results: Result[];
  experiments: ExperimentResult[];

  // Store object with methods
  store: {
    addDataset: (name: string) => Dataset;
    deleteDataset: (id: string) => void;
    addTestCase: (datasetId: string) => void;
    updateTestCase: (datasetId: string, testCaseId: string, updates: Partial<TestCase>) => void;
    deleteTestCase: (datasetId: string, testCaseId: string) => void;
    addCustomColumn: (datasetId: string, columnName: string) => void;
    removeCustomColumn: (datasetId: string, columnName: string) => void;

    addGrader: (name: string, description: string, rubric: string, type: GraderType) => void;
    updateGrader: (id: string, updates: Partial<Grader>) => void;
    deleteGrader: (id: string) => void;

    setResults: (results: Result[]) => void;
    addExperiment: (experiment: ExperimentResult) => void;
  };
}

// Bootstrap Zustand store from the lib/store singleton seed data on first load
import { store as libStore } from '@/lib/store';
export type { GraderType } from '@/lib/store';
function seedFromLibStore() {
  return {
    datasets: libStore.datasets.map((d) => ({
      id: d.id,
      name: d.name,
      testCases: d.testCases.map((tc) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        customFields: tc.customFields,
      })),
      customColumns: d.customColumns,
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt),
    })),
    graders: libStore.graders.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      rubric: g.rubric,
      type: g.type,
    })),
  }
}

export const useStore = create<StoreState>((set, get) => ({
  ...seedFromLibStore(),
  results: [],
  experiments: [],

  store: {
    // Dataset methods
    addDataset: (name: string) => {
      const newDataset: Dataset = {
        id: Date.now().toString(),
        name,
        testCases: [],
        customColumns: [],
        createdAt: new Date().toISOString(),
      };
      
      set((state) => ({
        datasets: [...state.datasets, newDataset],
      }));
      
      return newDataset;
    },
    
    deleteDataset: (id: string) => {
      set((state) => ({
        datasets: state.datasets.filter((d) => d.id !== id),
      }));
    },
    
    addTestCase: (datasetId: string) => {
      set((state) => ({
        datasets: state.datasets.map((d) =>
          d.id === datasetId
            ? {
                ...d,
                testCases: [
                  ...d.testCases,
                  {
                    id: Date.now().toString(),
                    input: '',
                    expectedOutput: '',
                    customFields: {},
                  },
                ],
              }
            : d
        ),
      }));
    },
    
    updateTestCase: (datasetId: string, testCaseId: string, updates: Partial<TestCase>) => {
      set((state) => ({
        datasets: state.datasets.map((d) =>
          d.id === datasetId
            ? {
                ...d,
                testCases: d.testCases.map((tc) =>
                  tc.id === testCaseId ? { ...tc, ...updates } : tc
                ),
              }
            : d
        ),
      }));
    },
    
    deleteTestCase: (datasetId: string, testCaseId: string) => {
      set((state) => ({
        datasets: state.datasets.map((d) =>
          d.id === datasetId
            ? {
                ...d,
                testCases: d.testCases.filter((tc) => tc.id !== testCaseId),
              }
            : d
        ),
      }));
    },
    
    addCustomColumn: (datasetId: string, columnName: string) => {
      set((state) => ({
        datasets: state.datasets.map((d) =>
          d.id === datasetId
            ? {
                ...d,
                customColumns: [...d.customColumns, columnName],
              }
            : d
        ),
      }));
    },
    
    removeCustomColumn: (datasetId: string, columnName: string) => {
      set((state) => ({
        datasets: state.datasets.map((d) =>
          d.id === datasetId
            ? {
                ...d,
                customColumns: d.customColumns.filter((c) => c !== columnName),
                testCases: d.testCases.map((tc) => {
                  const { [columnName]: removed, ...rest } = tc.customFields;
                  return { ...tc, customFields: rest };
                }),
              }
            : d
        ),
      }));
    },
    
    // Grader methods
    addGrader: (name: string, description: string, rubric: string, type: GraderType) => {
      const newGrader: Grader = {
        id: Date.now().toString(),
        name,
        description,
        rubric,
        type,
      };
      
      set((state) => ({
        graders: [...state.graders, newGrader],
      }));
    },
    
    updateGrader: (id: string, updates: Partial<Grader>) => {
      set((state) => ({
        graders: state.graders.map((g) =>
          g.id === id ? { ...g, ...updates } : g
        ),
      }));
    },
    
    deleteGrader: (id: string) => {
      set((state) => ({
        graders: state.graders.filter((g) => g.id !== id),
      }));
    },
    
    // Results methods
    setResults: (results: Result[]) => {
      set({ results });
    },

    // Experiment methods
    addExperiment: (experiment: ExperimentResult) => {
      set((state) => ({
        experiments: [...state.experiments, experiment],
      }));
    },
  },
}));