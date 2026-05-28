import { createFileRoute } from '@tanstack/react-router'
import { ExamsView } from '../components/ExamsView'

export const Route = createFileRoute('/exams')({
  component: ExamsPage,
})

function ExamsPage() {
  return <ExamsView />
}
