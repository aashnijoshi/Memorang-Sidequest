'use client';

import { useState } from 'react';
import { useStore } from '@/hooks/use-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GRADER_TYPES } from '@/lib/store';
import type { GraderType } from '@/hooks/use-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function GradersPage() {
  const { graders, store } = useStore();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rubric, setRubric] = useState('');
  const [type, setType] = useState<GraderType>('contains');
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!name.trim()) return;
    
    if (editingId) {
      store.updateGrader(editingId, {
        name: name.trim(),
        description: description.trim(),
        rubric: rubric.trim(),
        type,
      });
      setEditingId(null);
    } else {
      store.addGrader(name.trim(), description.trim(), rubric.trim(), type);
    }
    
    setName('');
    setDescription('');
    setRubric('');
    setType('contains');
  };

  const startEdit = (grader: any) => {
    setName(grader.name);
    setDescription(grader.description);
    setRubric(grader.rubric);
    setType(grader.type);
    setEditingId(grader.id);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Graders</h1>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Edit' : 'Add'} Grader</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Exact Match"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Type</label>
            <Select value={type} onValueChange={(v) => setType(v as GraderType)}>
              <SelectTrigger>
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
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Checks if output matches"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Rubric</label>
            <Textarea
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              placeholder="e.g. keyword or regex pattern"
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit}>
              {editingId ? 'Update' : 'Add'} Grader
            </Button>
            {editingId && (
              <Button variant="outline" onClick={() => {
                setEditingId(null);
                setName('');
                setDescription('');
                setRubric('');
                setType('contains');
              }}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {graders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No graders yet. Add one above.
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {graders.map((grader) => (
                  <tr key={grader.id}>
                    <td className="px-4 py-3 font-medium">{grader.name}</td>
                    <td className="px-4 py-3 text-sm">{grader.type}</td>
                    <td className="px-4 py-3 text-sm">{grader.description}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(grader)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => store.deleteGrader(grader.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}