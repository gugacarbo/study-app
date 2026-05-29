import { useState, useRef, useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import type { ProviderConfig } from '../lib/validation'
import { getConfig } from '../server-functions/config'
import { Loader2 } from 'lucide-react'

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

async function ingestStream(
  payload: { buffer: number[]; fileName: string; config: ProviderConfig },
  callbacks: {
    onStep: (step: string) => void
    onChunk: (text: string) => void
    onToken: (promptTokens: number, completionTokens: number, totalTokens: number) => void
  },
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
            const { step } = data as { step: string }
            callbacks.onStep(step)
          }

          if (parsed.event === 'chunk' && data && typeof data === 'object') {
            const { text } = data as { text: string }
            callbacks.onChunk(text)
          }

          if (parsed.event === 'token' && data && typeof data === 'object') {
            const { promptTokens, completionTokens, totalTokens } = data as {
              promptTokens: number
              completionTokens: number
              totalTokens: number
            }
            callbacks.onToken(promptTokens, completionTokens, totalTokens)
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

export function UploadForm({ onSuccess }: { onSuccess?: () => void }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [hasFile, setHasFile] = useState(false)
  const [stepText, setStepText] = useState('')
  const [streamText, setStreamText] = useState('')
  const [totalTokens, setTotalTokens] = useState(0)
  const streamEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (streamEndRef.current) {
      streamEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [streamText])

  const form = useForm({
    defaultValues: {
      file: null as File | null,
    },
    onSubmit: async ({ value }) => {
      if (!value.file) return

      setStatus('uploading')
      setMessage('')
      setStepText('Carregando configuração da IA...')
      setStreamText('')
      setTotalTokens(0)

      try {
        const config = await getConfig()
        setStepText('Lendo arquivo...')
        const buffer = await value.file.arrayBuffer()
        setStepText('Enviando arquivo para processamento...')
        const result = await ingestStream(
          {
            buffer: Array.from(new Uint8Array(buffer)),
            fileName: value.file.name,
            config,
          },
          {
            onStep: setStepText,
            onChunk: (text) => {
              setStreamText(text)
              // ~4 chars per token — estimativa em tempo real
              const estimated = Math.round(text.length / 4)
              setTotalTokens((prev) => Math.max(prev, estimated))
            },
            onToken: (_p, _c, total) => setTotalTokens((prev) => Math.max(prev, total)),
          },
        )
        setStatus('success')
        setStepText('Concluído')
        setMessage(`Extracted ${result.questions} questions from ${result.topics.join(', ')}`)
        queryClient.invalidateQueries({ queryKey: ['exams'] })
        queryClient.invalidateQueries({ queryKey: ['exams-detailed'] })
        queryClient.invalidateQueries({ queryKey: ['stats'] })
        onSuccess?.()
      } catch (err) {
        setStatus('error')
        setStepText('')
        setStreamText('')
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
                    setStepText('')
                    setStreamText('')
                    setTotalTokens(0)
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
          className="btn w-full mt-2 flex items-center justify-center gap-2"
          disabled={status === 'uploading' || !hasFile}
        >
          {status === 'uploading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Upload & Extract Questions'
          )}
        </button>
      </form>

      {status === 'uploading' && (
        <div className="mt-4 space-y-3">
          {/* Spinner + step text */}
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
            <span className="text-sm text-text-muted">{stepText}</span>
          </div>

          {/* Streaming AI response */}
          {streamText && (
            <div className="max-h-32 overflow-y-auto rounded border border-border bg-surface/50 p-3 font-mono text-[11px] leading-relaxed text-text-muted">
              <code>{streamText}</code>
              <div ref={streamEndRef} />
            </div>
          )}

          {/* Token counter — sempre visível durante upload */}
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {totalTokens > 0 ? `${totalTokens.toLocaleString()} tokens` : '0 tokens'}
            </span>
          </div>
        </div>
      )}

      {status !== 'idle' && status !== 'uploading' && (
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
