import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { getExams, getStats } from '../server-functions/stats'

export function Dashboard() {
  const { data: exams } = useSuspenseQuery({
    queryKey: ['exams'],
    queryFn: () => getExams(),
  })

  const { data: stats } = useSuspenseQuery({
    queryKey: ['stats'],
    queryFn: () => getStats(),
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="text-3xl font-bold">{stats.totalAttempts}</div>
          <div className="text-text-muted">Total Attempts</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold">{exams.length}</div>
          <div className="text-text-muted">Exams Imported</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold">{stats.topics.length}</div>
          <div className="text-text-muted">Topics Covered</div>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4">Imported Exams</h2>
      {exams.length === 0 ? (
        <div className="card text-center text-text-muted">
          No exams imported yet. <Link to="/upload" className="text-primary hover:underline">Upload one now</Link>
        </div>
      ) : (
        exams.map(exam => (
          <div key={exam.id} className="card flex justify-between items-center">
            <div>
              <div className="font-semibold">{exam.name}</div>
              <div className="text-xs text-text-muted">
                {new Date(exam.created_at).toLocaleDateString()}
              </div>
            </div>
            <Link to="/quiz/$id" params={{ id: exam.id.toString() }} className="btn">
              Start Quiz
            </Link>
          </div>
        ))
      )}
    </div>
  )
}
