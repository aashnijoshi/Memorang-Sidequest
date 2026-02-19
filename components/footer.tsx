import { FlaskConical } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Memorang mini</span>
        </div>
        
      </div>
    </footer>
  )
}
