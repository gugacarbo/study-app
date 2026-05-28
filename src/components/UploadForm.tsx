import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import type { ProviderConfig } from '../lib/validation'
import { getConfig } from '../server-functions/config'

type IngestProgressEvent = {
  progress: number
  step: string
}

type IngestResultEvent = {
  questions: number
  topics: string[]
  examId: number
  fileId: number
}

function parseEventBlock(block: string): { event: string; data: string } | null {
  const lines = block.split(/\r?\n/)
  let event = 'message'
  const dataLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim()
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim())
    }
  }

  if (dataLines.length === 0) return null
  return { event, data: dataLines.join('\n') }
}

async function ingestWithProgress(
  payload: { buffer: number[]; fileName: string; config: ProviderConfig },
  onProgress: (event: IngestProgressEvent) => void,
): Promise<IngestResultEvent> {
  const response = await fetch('/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Ingest request failed (${response.status})`)
  }

  if (!response.body) {
    throw new Error('Ingest stream is not available')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: IngestResultEvent | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    let separatorIndex = buffer.indexOf('\n\n')

    while (separatorIndex >= 0) {
      const block = buffer.slice(0, separatorIndex).trim()
      buffer = buffer.slice(separatorIndex + 2)

      if (block) {
        const parsed = parseEventBlock(block)
        if (parsed) {
          let data: unknown
          try {
            data = JSON.parse(parsed.data)
          } catch {
            data = null
          }

          if (parsed.event === 'progress' && data && typeof data === 'object') {
            const event = data as IngestProgressEvent
            onProgress(event)
          }

          if (parsed.event === 'result' && data && typeof data === 'object') {
            result = data as IngestResultEvent
          }

          if (parsed.event === 'error' && data && typeof data === 'object') {
            const message = (data as { message?: string }).message || 'Unknown ingest error'
            throw new Error(message)
          }
        }
      }

      separatorIndex = buffer.indexOf('\n\n')
    }
  }

  if (!result) {
    throw new Error('Ingest stream finished without a result')
  }

  return result
}

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
        setProgress(15)
        setProgressStep('Lendo arquivo...')
        const buffer = await value.file.arrayBuffer()
        setProgress(18)
        setProgressStep('Enviando arquivo para processamento...')
        const result = await ingestWithProgress(
          {
            buffer: Array.from(new Uint8Array(buffer)),
            fileName: value.file.name,
            config,
          },
          event => {
            setProgress(event.progress)
            setProgressStep(event.step)
          },
        )
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
