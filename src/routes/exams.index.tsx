import { createFileRoute } from '@tanstack/react-router'
import { ExamsView } from '../components/exams-view'

export const Route = createFileRoute('/exams/')({
  component: ExamsIndexPage,
})

function ExamsIndexPage() {
  return <ExamsView />
}
