import { createFileRoute } from '@tanstack/react-router'
import { ObsidianPanel } from '../components/ObsidianPanel'

export const Route = createFileRoute('/obsidian')({
  component: ObsidianPage,
})

function ObsidianPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Obsidian Integration</h1>
      <ObsidianPanel />
    </div>
  )
}
