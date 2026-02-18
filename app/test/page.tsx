import { TestGrading } from '@/components/TestGrading';

export default function TestPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight mb-6">Test LLM Grading</h1>
      <TestGrading />
    </div>
  );
}