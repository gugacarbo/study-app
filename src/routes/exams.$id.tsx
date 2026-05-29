import { createFileRoute, useParams } from '@tanstack/react-router'
import { ExamDetail } from '../components/exam-detail/exam-detail'

export const Route = createFileRoute('/exams/$id')({
  component: ExamDetailPage,
})

function ExamDetailPage() {
  const { id } = useParams({ from: '/exams/$id' })
  return <ExamDetail examId={parseInt(id)} />
}
