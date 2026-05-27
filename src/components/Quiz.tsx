import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { generateQuiz, submitAnswer } from '../server-functions/quiz'
import { getConfig } from '../server-functions/config'
import { saveQuizSessionToMemory } from '../server-functions/obsidian'
import { quizStore, resetQuiz, selectAnswer, nextQuestion, recordAnswer } from '../stores/quizStore'
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

export function Quiz({ examId, topic }: QuizProps) {
  const queryClient = useQueryClient()
  const [config, setConfig] = useState<ProviderConfig | null>(null)
  const answersRef = useRef<AnswerRecord[]>([])

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
      if (!config) throw new Error('Config not loaded')
      return submitAnswer({ data: { ...vars, config } })
    },
    onSuccess: (data, vars) => {
      recordAnswer(data.correct, data.explanation)

      answersRef.current.push({
        question: vars.question,
        userAnswer: vars.userAnswer,
        correctAnswer: vars.correctAnswer,
        isCorrect: data.correct,
        explanation: data.explanation,
        topic: vars.topic || 'General',
      })

      queryClient.invalidateQueries({ queryKey: ['stats'] })
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
    if (questions?.length) {
      resetQuiz(questions.length)
      answersRef.current = []
    }
  }, [questions])

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
      if (currentState.selectedAnswer && !currentState.showExplanation) {
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
  if (!questions || !questions[quizState.currentQuestionIndex]) return <div>Loading...</div>

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
              quizState.selectedAnswer === option ? 'ring-2 ring-primary' : ''
            }`}
            style={{
              background: quizState.selectedAnswer === option ? 'var(--primary)' : 'var(--surface)',
              border: `1px solid ${quizState.selectedAnswer === option ? 'var(--primary)' : 'var(--border)'}`,
            }}
            onClick={() => selectAnswer(option)}
          >
            <span className="mr-2 font-bold">{String.fromCharCode(97 + i)})</span>
            {option}
          </button>
        ))}
      </div>

      {!quizState.showExplanation && (
        <button
          className="btn w-full mt-4"
          disabled={!quizState.selectedAnswer}
          onClick={() => {
            submitMutation.mutate({
              questionId: currentQuestion.id,
              userAnswer: quizState.selectedAnswer!,
              correctAnswer: currentQuestion.answer,
              question: currentQuestion.question,
              topic: currentQuestion.topic,
            })
          }}
        >
          Submit Answer (Enter)
        </button>
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
          <button className="btn mt-2" onClick={nextQuestion}>
            Next Question (Enter)
          </button>
        </div>
      )}

      {quizState.isComplete && (
        <div className="mt-4 text-center">
          <h2 className="text-xl font-bold">Quiz Complete!</h2>
          <p className="text-2xl font-bold mt-2">
            {quizState.score} / {quizState.total}
          </p>
        </div>
      )}

      <div className="mt-4 text-xs text-text-muted">
        Hotkeys: 1-4 to select answer, Enter to submit/next
      </div>
    </div>
  )
}
