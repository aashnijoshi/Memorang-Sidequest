"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { DatasetManager } from "@/components/dataset-manager"
import { GradersLibrary } from "@/components/graders-library"
import { ExperimentRunner } from "@/components/experiment-runner"

const sectionTitles: Record<string, { title: string; description: string }> = {
  datasets: {
    title: "Datasets",
    description: "Define test cases for evaluating AI outputs.",
  },
  graders: {
    title: "Graders",
    description: "Build evaluation criteria with custom rubrics.",
  },
  experiment: {
    title: "Experiment",
    description: "Run evaluations and review results.",
  },
}

export default function Page() {
  const [activeTab, setActiveTab] = useState("datasets")
  const section = sectionTitles[activeTab]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {section.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {section.description}
            </p>
          </div>

          {activeTab === "datasets" && <DatasetManager />}
          {activeTab === "graders" && <GradersLibrary />}
          {activeTab === "experiment" && <ExperimentRunner />}
        </div>
      </main>
      <Footer />
    </div>
  )
}
