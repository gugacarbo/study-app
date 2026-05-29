import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from '@/components/ui/markdown'

interface QuizExplanationProps {
  isCorrect: boolean
  explanation: string
  longExplanation: string
  onNext: () => void
}

export function QuizExplanation({ isCorrect, explanation, longExplanation, onNext }: QuizExplanationProps) {
  return (
    <div className="mt-4">
      <Badge variant={isCorrect ? 'default' : 'destructive'} className="mb-2">
        {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
      </Badge>
      <MarkdownRenderer content={explanation} className="text-sm" />
      {longExplanation && (
        <details className="mt-2 rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Ver explicação completa
          </summary>
          <div className="mt-2 text-sm text-muted-foreground">
            <MarkdownRenderer content={longExplanation} />
          </div>
        </details>
      )}
      <Button className="mt-2" onClick={onNext}>
        Next Question (Enter)
      </Button>
    </div>
  )
}
