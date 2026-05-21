import { useSuspenseQuery } from '@tanstack/react-query'
import { getStats } from '../server-functions/stats'

export function StatsTable() {
  const { data: stats } = useSuspenseQuery({
    queryKey: ['stats'],
    queryFn: () => getStats(),
  })

  if (!stats.topics.length) {
    return (
      <div className="card text-center text-text-muted">
        No stats yet. Start taking quizzes to see your progress!
      </div>
    )
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 text-xs uppercase text-text-muted border-b border-border">Topic</th>
            <th className="text-left py-2 px-3 text-xs uppercase text-text-muted border-b border-border">Attempts</th>
            <th className="text-left py-2 px-3 text-xs uppercase text-text-muted border-b border-border">Correct</th>
            <th className="text-left py-2 px-3 text-xs uppercase text-text-muted border-b border-border">Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {stats.topics.map(topic => (
            <tr key={topic.topic}>
              <td className="py-2 px-3 border-b border-border">{topic.topic}</td>
              <td className="py-2 px-3 border-b border-border">{topic.total}</td>
              <td className="py-2 px-3 border-b border-border">{topic.correct}</td>
              <td className="py-2 px-3 border-b border-border">
                <span className={topic.accuracy >= 70 ? 'text-success' : topic.accuracy >= 40 ? 'text-warning' : 'text-error'}>
                  {topic.accuracy}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
