'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function TestGrading() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runTest = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasets: [
            { 
              id: '1', 
              input: 'What is 2+2?', 
              expected_output: '4' 
            }
          ],
          graders: [
            {
              id: 'g1',
              name: 'Exact Match',
              rubric: 'The expected output must exactly match the number 4'
            }
          ]
        })
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test LLM Grading</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runTest} disabled={loading}>
          {loading ? 'Grading...' : 'Run Test'}
        </Button>
        
        {result && (
          <pre className="bg-muted p-4 rounded text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}