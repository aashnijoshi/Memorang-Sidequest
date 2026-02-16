"use client"

import { useState } from "react"
import { useStore } from "@/hooks/use-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Trash2, Database, Columns3 } from "lucide-react"
import type { Dataset } from "@/lib/store"

function EditableCell({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 border-transparent bg-transparent hover:border-input focus:border-input shadow-none"
      placeholder="Enter value..."
    />
  )
}

function DatasetTable({ dataset }: { dataset: Dataset }) {
  const { store } = useStore()

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-10 text-center">#</TableHead>
            <TableHead>Input</TableHead>
            <TableHead>Expected Output</TableHead>
            {dataset.customColumns.map((col) => (
              <TableHead key={col}>
                <div className="flex items-center gap-1">
                  <span>{col}</span>
                  <button
                    onClick={() => store.removeCustomColumn(dataset.id, col)}
                    className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                    aria-label={`Remove column ${col}`}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </TableHead>
            ))}
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dataset.testCases.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={3 + dataset.customColumns.length + 1}
                className="h-24 text-center text-muted-foreground"
              >
                No test cases yet. Add one to get started.
              </TableCell>
            </TableRow>
          ) : (
            dataset.testCases.map((tc, idx) => (
              <TableRow key={tc.id} className="group">
                <TableCell className="text-center text-muted-foreground text-xs font-mono">
                  {idx + 1}
                </TableCell>
                <TableCell>
                  <EditableCell
                    value={tc.input}
                    onChange={(v) =>
                      store.updateTestCase(dataset.id, tc.id, { input: v })
                    }
                  />
                </TableCell>
                <TableCell>
                  <EditableCell
                    value={tc.expectedOutput}
                    onChange={(v) =>
                      store.updateTestCase(dataset.id, tc.id, {
                        expectedOutput: v,
                      })
                    }
                  />
                </TableCell>
                {dataset.customColumns.map((col) => (
                  <TableCell key={col}>
                    <EditableCell
                      value={tc.customFields[col] || ""}
                      onChange={(v) =>
                        store.updateTestCase(dataset.id, tc.id, {
                          customFields: { ...tc.customFields, [col]: v },
                        })
                      }
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => store.deleteTestCase(dataset.id, tc.id)}
                    aria-label="Delete test case"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function DatasetManager() {
  const { datasets, store: appStore } = useStore()
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    null
  )
  const [showNewDataset, setShowNewDataset] = useState(false)
  const [newDatasetName, setNewDatasetName] = useState("")
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState("")

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId)

  function handleCreateDataset() {
    if (!newDatasetName.trim()) return
    const dataset = appStore.addDataset(newDatasetName.trim())
    setSelectedDatasetId(dataset.id)
    setNewDatasetName("")
    setShowNewDataset(false)
  }

  function handleAddColumn() {
    if (!newColumnName.trim() || !selectedDataset) return
    appStore.addCustomColumn(selectedDataset.id, newColumnName.trim())
    setNewColumnName("")
    setShowAddColumn(false)
  }

  // Empty state
  if (datasets.length === 0 && !showNewDataset) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Database className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground mb-2">
          No datasets yet
        </h2>
        <p className="text-muted-foreground text-sm mb-6 max-w-sm text-center leading-relaxed">
          Create your first dataset to define test cases for AI evaluation.
        </p>
        <Button onClick={() => setShowNewDataset(true)}>
          <Plus className="size-4" />
          Create Dataset
        </Button>

        <Dialog open={showNewDataset} onOpenChange={setShowNewDataset}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Dataset</DialogTitle>
              <DialogDescription>
                Name your dataset to organize test cases for evaluation.
              </DialogDescription>
            </DialogHeader>
            <Input
              placeholder="Dataset name"
              value={newDatasetName}
              onChange={(e) => setNewDatasetName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateDataset()}
              autoFocus
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowNewDataset(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateDataset}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={selectedDatasetId || ""}
          onValueChange={setSelectedDatasetId}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select a dataset" />
          </SelectTrigger>
          <SelectContent>
            {datasets.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={() => setShowNewDataset(true)}>
          <Plus className="size-4" />
          New Dataset
        </Button>

        {selectedDataset && (
          <>
            <Button
              variant="outline"
              onClick={() => appStore.addTestCase(selectedDataset.id)}
            >
              <Plus className="size-4" />
              Add Row
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAddColumn(true)}
            >
              <Columns3 className="size-4" />
              Add Column
            </Button>
            <div className="ml-auto">
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => {
                  appStore.deleteDataset(selectedDataset.id)
                  setSelectedDatasetId(null)
                }}
              >
                <Trash2 className="size-4" />
                Delete Dataset
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Dataset table */}
      {selectedDataset ? (
        <DatasetTable dataset={selectedDataset} />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm">Select a dataset or create a new one.</p>
        </div>
      )}

      {/* New Dataset Dialog */}
      <Dialog open={showNewDataset} onOpenChange={setShowNewDataset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Dataset</DialogTitle>
            <DialogDescription>
              Name your dataset to organize test cases for evaluation.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Dataset name"
            value={newDatasetName}
            onChange={(e) => setNewDatasetName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateDataset()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewDataset(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDataset}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Column Dialog */}
      <Dialog open={showAddColumn} onOpenChange={setShowAddColumn}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Column</DialogTitle>
            <DialogDescription>
              Add a custom metadata column to this dataset.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Column name"
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddColumn()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddColumn(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddColumn}>Add Column</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
