"use client"

import { cn } from "@/lib/utils"
import { FlaskConical } from "lucide-react"

interface HeaderProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const tabs = [
  { id: "datasets", label: "Datasets" },
  { id: "graders", label: "Graders" },
  { id: "experiment", label: "Experiment" },
]

export function Header({ activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
        <div className="flex items-center gap-2 mr-8">
          <FlaskConical className="size-5 text-primary" />
          <span className="text-base font-semibold tracking-tight text-foreground">
            Eval Harness
          </span>
        </div>
        <nav className="flex items-center gap-1" role="tablist" aria-label="Main navigation">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative px-3 py-4 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
