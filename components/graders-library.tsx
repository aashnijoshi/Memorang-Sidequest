"use client"

import { useState } from "react"
import { useStore } from "@/hooks/use-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2, Scale, Sparkles } from "lucide-react"
import { GRADER_TYPES } from "@/lib/store"
import type { Grader, GraderType } from "@/lib/store"

interface GraderFormState {
  name: string
  description: string
  rubric: string
  type: GraderType
}

const emptyForm: GraderFormState = { name: "", description: "", rubric: "", type: "contains" }

function GraderCard({
  grader,
  onEdit,
  onDelete,
}: {
  grader: Grader
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card className="group relative transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {grader.name}
          </h3>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onEdit}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Edit ${grader.name}`}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${grader.name}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Badge variant="secondary" className="w-fit text-xs">
          {GRADER_TYPES.find((t) => t.value === grader.type)?.label ?? grader.type}
        </Badge>
        {grader.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {grader.description}
          </p>
        )}
        {grader.rubric && (
          <div className="rounded-md bg-muted px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              {grader.type === "llm" ? "Instructions" : "Pattern"}
            </p>
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed">
              {grader.rubric}
            </pre>
          </div>
        )}
        {grader.type === "llm" && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="size-3" />
            <span>Evaluated by Claude</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function GradersLibrary() {
  const { graders, store: appStore } = useStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<GraderFormState>(emptyForm)

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(grader: Grader) {
    setEditingId(grader.id)
    setForm({
      name: grader.name,
      description: grader.description,
      rubric: grader.rubric,
      type: grader.type,
    })
    setDialogOpen(true)
  }

  function handleSave() {
    const rubricRequired = form.type === "contains" || form.type === "regex" || form.type === "llm"
    if (!form.name.trim()) return
    if (rubricRequired && !form.rubric.trim()) return

    if (editingId) {
      appStore.updateGrader(editingId, {
        name: form.name.trim(),
        description: form.description.trim(),
        rubric: form.rubric.trim(),
        type: form.type,
      })
    } else {
      appStore.addGrader(
        form.name.trim(),
        form.description.trim(),
        form.rubric.trim(),
        form.type
      )
    }

    setForm(emptyForm)
    setEditingId(null)
    setDialogOpen(false)
  }

  // Empty state
  if (graders.length === 0 && !dialogOpen) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Scale className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground mb-2">
          No graders yet
        </h2>
        <p className="text-muted-foreground text-sm mb-6 max-w-sm text-center leading-relaxed">
          Create graders with rubrics to evaluate AI outputs against your
          criteria.
        </p>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Create Grader
        </Button>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Grader</DialogTitle>
              <DialogDescription>
                Define a grader with a name, description, and evaluation rubric.
              </DialogDescription>
            </DialogHeader>
            <GraderForm form={form} setForm={setForm} />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {graders.length} grader{graders.length !== 1 ? "s" : ""} defined
        </p>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Create Grader
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {graders.map((grader) => (
          <GraderCard
            key={grader.id}
            grader={grader}
            onEdit={() => openEdit(grader)}
            onDelete={() => appStore.deleteGrader(grader.id)}
          />
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Grader" : "Create Grader"}
            </DialogTitle>
            <DialogDescription>
              Define a grader with a name, description, and evaluation rubric.
            </DialogDescription>
          </DialogHeader>
          <GraderForm form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function GraderForm({
  form,
  setForm,
}: {
  form: GraderFormState
  setForm: (f: GraderFormState) => void
}) {
  const selectedType = GRADER_TYPES.find((t) => t.value === form.type)
  const needsRubric = form.type === "contains" || form.type === "regex" || form.type === "llm"

  const rubricLabel =
    form.type === "regex" ? "Pattern" :
    form.type === "llm" ? "Grading Instructions (rubric)" :
    "Keyword"

  const rubricPlaceholder =
    form.type === "contains"
      ? "Keyword to search for in expected output..."
      : form.type === "regex"
        ? "Regex pattern, e.g. \\d+ \\w+"
        : form.type === "llm"
          ? "Describe how Claude should decide pass/fail.\nE.g. 'Pass if the answer includes the correct SI unit and value. Fail if units are missing or value is wrong.'"
          : ""

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="grader-name">Name</Label>
        <Input
          id="grader-name"
          placeholder="e.g. Accuracy Check"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="grader-type">Type</Label>
        <Select
          value={form.type}
          onValueChange={(val) => setForm({ ...form, type: val as GraderType, rubric: "" })}
        >
          <SelectTrigger id="grader-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRADER_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedType && (
          <p className="text-xs text-muted-foreground">{selectedType.description}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="grader-description">Description</Label>
        <Input
          id="grader-description"
          placeholder="What does this grader evaluate?"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      {needsRubric && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="grader-rubric">{rubricLabel}</Label>
          {form.type === "llm" ? (
            <Textarea
              id="grader-rubric"
              placeholder={rubricPlaceholder}
              value={form.rubric}
              onChange={(e) => setForm({ ...form, rubric: e.target.value })}
              className="text-sm min-h-[100px] resize-y"
            />
          ) : (
            <Input
              id="grader-rubric"
              placeholder={rubricPlaceholder}
              value={form.rubric}
              onChange={(e) => setForm({ ...form, rubric: e.target.value })}
              className="font-mono text-sm"
            />
          )}
        </div>
      )}
    </div>
  )
}
