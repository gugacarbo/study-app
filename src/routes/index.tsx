import { createFileRoute } from '@tanstack/react-router'
import { Dashboard } from '../components/dashboard'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  return <Dashboard />
}
