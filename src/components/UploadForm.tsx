import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { ingestExam } from '../server-functions/ingest'
import { getConfig } from '../server-functions/config'

export function UploadForm() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [hasFile, setHasFile] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressStep, setProgressStep] = useState('')

  const form = useForm({
    defaultValues: {
      file: null as File | null,
    },
    onSubmit: async ({ value }) => {
      if (!value.file) return

      setStatus('uploading')
      setMessage('')
      setProgress(10)
      setProgressStep('Carregando configuração da IA...')
      try {
        const config = await getConfig()
        setProgress(25)
        setProgressStep('Lendo arquivo...')
        const buffer = await value.file.arrayBuffer()
        setProgress(40)
        setProgressStep('Preparando conteúdo para extração...')
        const result = await ingestExam({ data: { buffer: Array.from(new Uint8Array(buffer)), fileName: value.file.name, config } })
        setProgress(90)
        setProgressStep('Finalizando e atualizando resultados...')
        setStatus('success')
        setProgress(100)
        setProgressStep('Concluído')
        setMessage(`Extracted ${result.questions} questions from ${result.topics.join(', ')}`)
        queryClient.invalidateQueries({ queryKey: ['exams'] })
      } catch (err) {
        setStatus('error')
        setProgress(0)
        setProgressStep('')
        setMessage(err instanceof Error ? err.message : 'Unknown error')
      }
    },
  })

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4">Upload Exam</h2>
      <form
        onSubmit={e => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <form.Field name="file">
          {field => (
            <div className="mb-4">
              <input
                type="file"
                id="file-upload"
                accept=".pdf,.txt,.md"
                onChange={e => {
                  const file = e.target.files?.[0] || null
                  field.handleChange(file)
                  setHasFile(!!file)
                  if (file) {
                    setStatus('idle')
                    setMessage('')
                    setProgress(0)
                    setProgressStep('')
                  }
                }}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="btn cursor-pointer inline-block text-center w-full"
              >
                {field.state.value ? field.state.value.name : 'Select a file...'}
              </label>
            </div>
          )}
        </form.Field>

        <button
          type="submit"
          className="btn w-full mt-2"
          disabled={status === 'uploading' || !hasFile}
        >
          {status === 'uploading' ? 'Processing...' : 'Upload & Extract Questions'}
        </button>
      </form>

      {status === 'uploading' && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-sm text-text-muted">
            <span>{progressStep}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-surface-hover">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {status !== 'idle' && (
        <div
          className={`mt-4 p-3 rounded ${
            status === 'success' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
          }`}
        >
          {message}
        </div>
      )}
    </div>
  )
}
