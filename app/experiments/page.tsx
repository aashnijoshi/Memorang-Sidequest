'use client';

import { useState } from 'react';
import { useStore } from '@/hooks/use-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

export default function ExperimentsPage() {
  const { datasets, graders, setResults, results } = useStore();
  const [selectedGraders, setSelectedGraders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const runExperiment = async () => {
    setLoading(true);
    
    const selectedGraderObjs = graders.filter(g => 
      selectedGraders.includes(g.id)
    );

    try {
      const response = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasets,
          graders: selectedGraderObjs,
        }),
      });

      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to run experiment');
    } finally {
      setLoading(false);
    }
  };

  const toggleGrader = (id: string) => {
    setSelectedGraders(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const getResult = (datasetId: string, graderId: string) => {
    return results.find(r => r.datasetId === datasetId && r.graderId === graderId);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Experiments</h1>

      <Card>
        <CardHeader>
          <CardTitle>Select Graders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {graders.map((grader) => (
            <div key={grader.id} className="flex items-center gap-2">
              <Checkbox
                checked={selectedGraders.includes(grader.id)}
                onCheckedChange={() => toggleGrader(grader.id)}
              />
              <label className="text-sm">{grader.name}</label>
            </div>
          ))}
          
          <Button
            onClick={runExperiment}
            disabled={loading || selectedGraders.length === 0 || datasets.length === 0}
            className="w-full"
          >
            {loading ? 'Running...' : 'Run Experiment'}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="px-4 py-3 text-left">Input</th>
                  <th className="px-4 py-3 text-left">Expected</th>
                  {selectedGraders.map(gId => (
                    <th key={gId} className="px-4 py-3 text-left">
                      {graders.find(g => g.id === gId)?.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {datasets.map((dataset) => (
                  <tr key={dataset.id}>
                    <td className="px-4 py-3">{dataset.input}</td>
                    <td className="px-4 py-3">{dataset.expected_output}</td>
                    {selectedGraders.map(gId => {
                      const result = getResult(dataset.id, gId);
                      return (
                        <td key={gId} className="px-4 py-3">
                          {result ? (
                            <div>
                              <div className={result.passed ? 'text-green-600' : 'text-red-600'}>
                                {result.passed ? '✅ Pass' : '❌ Fail'}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                {result.reason}
                              </div>
                            </div>
                          ) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}