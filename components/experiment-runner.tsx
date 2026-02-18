"use client"

import { useState } from "react"
import { useStore } from "@/hooks/use-store"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Label } from "@/components/ui/label"
import { Play, CheckCircle2, XCircle, Beaker, Loader2 } from "lucide-react"
import { generateId } from "@/lib/store"
import type { ExperimentResult, GradeResult } from "@/lib/store"
import type { GradeResultPayload } from "@/app/api/grade/route"

// ─── UI Components ────────────────────────────────────────────────────────────

function PassFailBadge({ result }: { result: GradeResult }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center cursor-default">
          {result.pass ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              <CheckCircle2 className="size-3" />
              Pass
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              <XCircle className="size-3" />
              Fail
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="text-xs">{result.reason}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function SummaryStats({ experiment }: { experiment: ExperimentResult }) {
  let total = 0
  let passed = 0

  for (const testCaseResults of Object.values(experiment.results)) {
    for (const gradeResult of Object.values(testCaseResults)) {
      total++
      if (gradeResult.pass) passed++
    }
  }

  const rate = total > 0 ? Math.round((passed / total) * 100) : 0

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="font-medium text-foreground">{passed}/{total} passed</span>
      <span className="text-muted-foreground">({rate}%)</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ExperimentRunner() {
  const { datasets, graders } = useStore()
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("")
  const [selectedGraderIds, setSelectedGraderIds] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [latestExperiment, setLatestExperiment] = useState<ExperimentResult | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId)
  const selectedGraders = graders.filter((g) => selectedGraderIds.includes(g.id))

  function toggleGrader(graderId: string) {
    setSelectedGraderIds((prev) =>
      prev.includes(graderId) ? prev.filter((id) => id !== graderId) : [...prev, graderId]
    )
  }

  async function runExperiment() {
    if (!selectedDataset || selectedGraders.length === 0) return

    setRunning(true)
    setError(null)
    const total = selectedDataset.testCases.length * selectedGraders.length
    setProgress({ done: 0, total })

    try {
      const response = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testCases: selectedDataset.testCases,
          graders: selectedGraders,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? `Server error ${response.status}`)
      }

      const { results } = await response.json() as { results: GradeResultPayload[] }

      // Build the nested results map: testCaseId → graderId → GradeResult
      const resultsMap: Record<string, Record<string, GradeResult>> = {}
      for (const r of results) {
        if (!resultsMap[r.testCaseId]) resultsMap[r.testCaseId] = {}
        resultsMap[r.testCaseId][r.graderId] = { pass: r.pass, reason: r.reason }
      }

      setProgress({ done: total, total })

      const experiment: ExperimentResult = {
        id: generateId(),
        datasetId: selectedDataset.id,
        graderIds: selectedGraderIds,
        results: resultsMap,
        createdAt: new Date(),
      }

      setLatestExperiment(experiment)
    } catch (err) {
      console.error("[runExperiment]", err)
      setError(err instanceof Error ? err.message : "Failed to run experiment")
    } finally {
      setRunning(false)
    }
  }

  const canRun =
    selectedDataset && selectedDataset.testCases.length > 0 && selectedGraders.length > 0

  // Empty state
  if (datasets.length === 0 || graders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Beaker className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground mb-2">
          Not ready to run experiments
        </h2>
        <p className="text-muted-foreground text-sm mb-2 max-w-md text-center leading-relaxed">
          {datasets.length === 0 && graders.length === 0
            ? "Create a dataset and at least one grader first."
            : datasets.length === 0
              ? "Create a dataset with test cases first."
              : "Create at least one grader first."}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Configuration panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-5">
            {/* Dataset selector */}
            <div className="flex flex-col gap-2">
              <Label>Dataset</Label>
              <Select value={selectedDatasetId} onValueChange={setSelectedDatasetId}>
                <SelectTrigger className="w-full sm:w-[300px]">
                  <SelectValue placeholder="Select a dataset" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({d.testCases.length} test{d.testCases.length !== 1 ? "s" : ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grader multi-select */}
            <div className="flex flex-col gap-2">
              <Label>Graders</Label>
              <div className="flex flex-wrap gap-3">
                {graders.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedGraderIds.includes(g.id)}
                      onCheckedChange={() => toggleGrader(g.id)}
                    />
                    <span className="text-sm text-foreground">{g.name}</span>
                    {g.type === "llm" && (
                      <span className="text-xs text-muted-foreground">(LLM)</span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Run button */}
            <div className="flex items-center gap-4">
              <Button size="lg" disabled={!canRun || running} onClick={runExperiment}>
                {running ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Running ({progress.done}/{progress.total})
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    Run Experiment
                  </>
                )}
              </Button>
              {running && (
                <p className="text-sm text-muted-foreground">Evaluating test cases…</p>
              )}
            </div>

            {/* Error state */}
            {error && (
              <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
                {error}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {latestExperiment && selectedDataset && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-tight text-foreground">Results</h3>
            <SummaryStats experiment={latestExperiment} />
          </div>

          <div className="rounded-lg border border-border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead>Input</TableHead>
                  <TableHead>Expected</TableHead>
                  {selectedGraders.map((g) => (
                    <TableHead key={g.id} className="text-center min-w-[110px]">
                      {g.name}
                    </TableHead>
                  ))}
                  <TableHead className="min-w-[260px]">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedDataset.testCases.map((tc, idx) => {
                  const reasonParts = selectedGraders
                    .map((g) => {
                      const r = latestExperiment.results[tc.id]?.[g.id]
                      if (!r) return null
                      return `[${g.name}] ${r.reason}`
                    })
                    .filter(Boolean)

                  return (
                    <TableRow key={tc.id}>
                      <TableCell className="text-center text-muted-foreground text-xs font-mono">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {tc.input}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {tc.expectedOutput}
                      </TableCell>
                      {selectedGraders.map((g) => (
                        <TableCell key={g.id} className="text-center">
                          {latestExperiment.results[tc.id]?.[g.id] ? (
                            <PassFailBadge result={latestExperiment.results[tc.id][g.id]} />
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-xs text-muted-foreground leading-relaxed align-top py-3">
                        {reasonParts.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {reasonParts.map((r, i) => (
                              <p key={i} className="whitespace-pre-wrap">{r}</p>
                            ))}
                          </div>
                        ) : (
                          <span>--</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
