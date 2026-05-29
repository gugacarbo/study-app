import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { generateQuiz, submitAnswer } from '../server-functions/quiz'
import { getConfig } from '../server-functions/config'
import { saveQuizSessionToMemory } from '../server-functions/memory'
import { quizStore, resetQuiz, selectAnswer, nextQuestion, recordAnswer, hydrateQuiz } from '../stores/quizStore'
import type { ProviderConfig, Question } from '../lib/validation'

interface QuizProps {
  examId?: number
  topic?: string
}

interface QuizQuestion extends Question {
  id: number
}

interface AnswerRecord {
  question: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  explanation: string
  topic: string
}

interface PersistedQuizState {
  quizState: ReturnType<typeof getQuizStateSnapshot>
  answers: AnswerRecord[]
}

function getQuizStateSnapshot() {
  return quizStore.state
}

export function Quiz({ examId, topic }: QuizProps) {
  const queryClient = useQueryClient()
  const [config, setConfig] = useState<ProviderConfig | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [longExplanation, setLongExplanation] = useState('')
  const answersRef = useRef<AnswerRecord[]>([])
  const storageKey = `study-app:quiz:${examId ?? 'topic'}:${topic ?? 'general'}`

  useEffect(() => {
    getConfig().then(setConfig)
  }, [])

  const { data: questions } = useQuery({
    queryKey: ['quiz', examId, topic],
    queryFn: () => {
      if (!config) throw new Error('Config not loaded')
      return generateQuiz({ data: { examId, topic, count: 10, config } })
    },
    enabled: !!config,
  })

  const submitMutation = useMutation({
    mutationFn: (vars: { questionId: number; userAnswer: string; correctAnswer: string; question: string; topic?: string }) => {
      return submitAnswer({ data: { questionId: vars.questionId, userAnswer: vars.userAnswer } })
    },
    onSuccess: (data, vars) => {
      answersRef.current.push({
        question: vars.question,
        userAnswer: vars.userAnswer,
        correctAnswer: vars.correctAnswer,
        isCorrect: data.correct,
        explanation: data.explanation,
        topic: vars.topic || 'General',
      })
      recordAnswer(data.correct, data.explanation)
      setLongExplanation(data.longExplanation || '')

      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (err) => {
      console.error('Failed to submit answer:', err)
    },
  })

  const quizState = useStore(quizStore, (state) => state)
  const questionsRef = useRef(questions)
  const quizStateRef = useRef(quizState)
  const submitMutationRef = useRef(submitMutation)

  useEffect(() => { questionsRef.current = questions }, [questions])
  useEffect(() => { quizStateRef.current = quizState }, [quizState])
  useEffect(() => { submitMutationRef.current = submitMutation }, [submitMutation])

  useEffect(() => {
    if (!questions?.length || isInitialized) return
    const fallbackToReset = () => {
      resetQuiz(questions.length)
      answersRef.current = []
      setIsInitialized(true)
    }

    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) {
        fallbackToReset()
        return
      }

      const persisted = JSON.parse(raw) as PersistedQuizState
      const savedState = persisted?.quizState
      const savedAnswers = persisted?.answers

      const isStateValid =
        !!savedState &&
        typeof savedState.total === 'number' &&
        savedState.total === questions.length &&
        savedState.currentQuestionIndex >= 0 &&
        savedState.currentQuestionIndex <= questions.length

      if (!isStateValid) {
        fallbackToReset()
        return
      }

      hydrateQuiz(savedState)
      answersRef.current = Array.isArray(savedAnswers) ? savedAnswers : []
      setIsInitialized(true)
    } catch {
      fallbackToReset()
    }
  }, [questions, isInitialized, storageKey])

  useEffect(() => {
    if (!isInitialized) return
    const sub = quizStore.subscribe(() => {
      const payload: PersistedQuizState = {
        quizState: getQuizStateSnapshot(),
        answers: answersRef.current,
      }
      localStorage.setItem(storageKey, JSON.stringify(payload))
    })
    return () => sub.unsubscribe()
  }, [isInitialized, storageKey])

  const saveSession = useCallback(async () => {
    const state = quizStore.state
    if (!state.isComplete || answersRef.current.length === 0) return

    await saveQuizSessionToMemory({
      data: {
        examName: examId ? `Exam #${examId}` : topic || 'General',
        topic: topic || 'General',
        totalQuestions: state.total,
        correctAnswers: state.score,
        questions: answersRef.current,
      },
    }).catch(() => {})

    localStorage.removeItem(storageKey)
  }, [examId, topic])

  useEffect(() => {
    const sub = quizStore.subscribe(() => {
      const newState = quizStore.state
      if (newState.isComplete && newState.currentQuestionIndex >= newState.total) {
        saveSession()
      }
    })
    return () => sub.unsubscribe()
  }, [saveSession])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const currentQuestions = questionsRef.current
    const currentState = quizStateRef.current
    const currentMutation = submitMutationRef.current

    if (!currentQuestions || !currentQuestions[currentState.currentQuestionIndex]) return

    const currentQuestion = currentQuestions[currentState.currentQuestionIndex] as QuizQuestion

    if (['1', '2', '3', '4'].includes(e.key)) {
      const index = parseInt(e.key) - 1
      if (currentQuestion.options[index]) {
        selectAnswer(currentQuestion.options[index])
      }
    }

    if (e.key === 'Enter') {
      if (currentMutation.isPending) return
      if (currentState.selectedAnswer && !currentState.showExplanation) {
        setLongExplanation('')
        currentMutation.mutate({
          questionId: currentQuestion.id,
          userAnswer: currentState.selectedAnswer,
          correctAnswer: currentQuestion.answer,
          question: currentQuestion.question,
          topic: currentQuestion.topic,
        })
      } else if (currentState.showExplanation) {
        nextQuestion()
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!config) return <div>Loading config...</div>
  if (!isInitialized) return <div>Loading...</div>
  if (!questions) return <div>Loading...</div>
  if (quizState.isComplete) {
    const total = quizState.total
    const correct = quizState.score
    const incorrect = Math.max(total - correct, 0)
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
    const wrongAnswers = answersRef.current.filter((answer) => !answer.isCorrect)

    return (
      <div className="card">
        <div className="mt-4">
          <h2 className="text-xl font-bold">Quiz Complete!</h2>
          <p className="text-text-muted mt-1">Resumo do seu desempenho</p>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="rounded border border-border bg-surface p-3">
              <p className="text-xs text-text-muted">Acertos</p>
              <p className="text-lg font-semibold text-success">{correct}</p>
            </div>
            <div className="rounded border border-border bg-surface p-3">
              <p className="text-xs text-text-muted">Erros</p>
              <p className="text-lg font-semibold text-error">{incorrect}</p>
            </div>
            <div className="rounded border border-border bg-surface p-3">
              <p className="text-xs text-text-muted">Taxa de acerto</p>
              <p className="text-lg font-semibold">{accuracy}%</p>
            </div>
            <div className="rounded border border-border bg-surface p-3">
              <p className="text-xs text-text-muted">Resultado</p>
              <p className="text-lg font-semibold">{correct} / {total}</p>
            </div>
          </div>

          {wrongAnswers.length > 0 && (
            <details className="mt-4 rounded border border-border bg-surface p-3">
              <summary className="cursor-pointer text-sm font-medium text-text-muted">
                Revisar questões erradas ({wrongAnswers.length})
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                {wrongAnswers.map((item, index) => (
                  <div key={`${item.question}-${index}`} className="rounded border border-border p-3">
                    <p className="text-sm font-medium">{item.question}</p>
                    <p className="text-xs text-text-muted mt-1">Sua resposta: {item.userAnswer}</p>
                    <p className="text-xs text-text-muted">Correta: {item.correctAnswer}</p>
                    <p className="text-xs text-text-muted mt-2">{item.explanation}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    )
  }
  if (!questions[quizState.currentQuestionIndex]) return <div>Loading...</div>

  const currentQuestion = questions[quizState.currentQuestionIndex] as QuizQuestion

  return (
    <div className="card">
      <div className="flex justify-between mb-4">
        <span className="text-text-muted">
          Question {quizState.currentQuestionIndex + 1} of {quizState.total}
        </span>
        <span className="text-success">Score: {quizState.score}</span>
      </div>

      <h3 className="text-lg font-semibold mb-4">{currentQuestion.question}</h3>

      <div className="flex flex-col gap-2">
        {currentQuestion.options.map((option: string, i: number) => (
          <button
            key={i}
            className={`btn justify-start ${
              quizState.selectedAnswer === option
                ? 'ring-2 ring-primary bg-primary text-primary-foreground border-primary'
                : 'bg-surface text-text border-border'
            }`}
            onClick={() => selectAnswer(option)}
          >
            <span className="mr-2 font-bold">{String.fromCharCode(97 + i)})</span>
            {option}
          </button>
        ))}
      </div>

      {!quizState.showExplanation && (
        <>
          <button
            className="btn w-full mt-4"
            disabled={!quizState.selectedAnswer || submitMutation.isPending}
            onClick={() => {
              setLongExplanation('')
              submitMutation.mutate({
                questionId: currentQuestion.id,
                userAnswer: quizState.selectedAnswer!,
                correctAnswer: currentQuestion.answer,
                question: currentQuestion.question,
                topic: currentQuestion.topic,
              })
            }}
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit Answer (Enter)'}
          </button>
          {submitMutation.isError && (
            <p className="text-error text-sm mt-2">
              Error submitting: {submitMutation.error.message}
            </p>
          )}
        </>
      )}

      {quizState.showExplanation && (
        <div className="mt-4">
          <div
            className={`p-3 rounded mb-2 ${
              quizState.isCorrect ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
            }`}
          >
            {quizState.isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </div>
          <p className="text-text-muted text-sm">{quizState.explanation}</p>
          {longExplanation && (
            <details className="mt-2 rounded border border-border bg-surface p-3">
              <summary className="cursor-pointer text-sm font-medium text-text-muted">
                Ver explicação completa
              </summary>
              <div className="mt-2 whitespace-pre-wrap text-sm text-text-muted">
                {longExplanation}
              </div>
            </details>
          )}
          <button className="btn mt-2" onClick={nextQuestion}>
            Next Question (Enter)
          </button>
        </div>
      )}

      <div className="mt-4 text-xs text-text-muted">
        Hotkeys: 1-4 to select answer, Enter to submit/next
      </div>
    </div>
  )
}
