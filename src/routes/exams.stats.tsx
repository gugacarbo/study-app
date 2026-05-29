import { createFileRoute } from '@tanstack/react-router'
import { StatsTable } from '../components/stats-table'

export const Route = createFileRoute('/exams/stats')({
  component: ExamsStatsPage,
})

function ExamsStatsPage() {
  return <StatsTable />
}
