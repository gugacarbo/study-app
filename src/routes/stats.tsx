import { createFileRoute } from '@tanstack/react-router'
import { StatsTable } from '../components/StatsTable'

export const Route = createFileRoute('/stats')({
  component: StatsPage,
})

function StatsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Statistics</h1>
      <StatsTable />
    </div>
  )
}
