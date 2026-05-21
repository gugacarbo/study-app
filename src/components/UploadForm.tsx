import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { ingestExam } from '../server-functions/ingest'
import { getConfig } from '../server-functions/config'

export function UploadForm() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const form = useForm({
    defaultValues: {
      file: null as File | null,
    },
    onSubmit: async ({ value }) => {
      if (!value.file) return

      setStatus('uploading')
      try {
        const config = await getConfig()
        const result = await ingestExam({ data: { file: value.file!, config } })
        setStatus('success')
        setMessage(`Extracted ${result.questions} questions from ${result.topics.join(', ')}`)
        queryClient.invalidateQueries({ queryKey: ['exams'] })
      } catch (err) {
        setStatus('error')
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
                accept=".pdf,.txt"
                onChange={e => field.handleChange(e.target.files?.[0] || null)}
                className="input"
              />
            </div>
          )}
        </form.Field>

        <button type="submit" className="btn" disabled={status === 'uploading'}>
          {status === 'uploading' ? 'Processing...' : 'Upload & Extract Questions'}
        </button>
      </form>

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
