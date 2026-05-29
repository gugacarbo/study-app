import { createFileRoute } from '@tanstack/react-router'
import { Quiz } from '../components/quiz/quiz'

export const Route = createFileRoute('/quiz/$id')({
  component: QuizPage,
})

function QuizPage() {
  const { id } = Route.useParams()
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Quiz</h1>
      <Quiz examId={parseInt(id)} />
    </div>
  )
}
