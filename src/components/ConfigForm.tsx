import { useState, useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { getConfig, setConfig, testConnection } from '../server-functions/config'
import type { ProviderConfig } from '../lib/validation'

export function ConfigForm() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [dialogData, setDialogData] = useState<{ prompt: string; response: string } | null>(null)

  const { data: currentConfig } = useSuspenseQuery({
    queryKey: ['config'],
    queryFn: () => getConfig(),
  })

  const form = useForm({
    defaultValues: {
      provider: 'openrouter' as ProviderConfig['provider'],
      model: '',
      baseUrl: '',
      apiKey: '',
    },
    onSubmit: async ({ value }) => {
      setStatus('saving')
      try {
        await setConfig({ data: value as ProviderConfig })
        setStatus('success')
        setMessage('Config saved successfully')
        queryClient.invalidateQueries({ queryKey: ['config'] })
      } catch (err) {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Unknown error')
      }
    },
  })

  useEffect(() => {
    if (currentConfig) {
      form.setFieldValue('provider', currentConfig.provider)
      form.setFieldValue('model', currentConfig.model)
      form.setFieldValue('baseUrl', currentConfig.baseUrl || '')
      form.setFieldValue('apiKey', currentConfig.apiKey)
    }
  }, [currentConfig])

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4">AI Provider Configuration</h2>
      <form
        onSubmit={e => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <form.Field name="provider">
          {field => (
            <div className="mb-4">
              <label className="block text-sm mb-1">Provider</label>
              <select
                value={field.state.value}
                onChange={e => field.handleChange(e.target.value as ProviderConfig['provider'])}
                className="input"
              >
                <option value="openrouter">OpenRouter</option>
                <option value="openai">OpenAI</option>
                <option value="groq">Groq</option>
                <option value="ollama">Ollama</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          )}
        </form.Field>

        <form.Field name="model">
          {field => (
            <div className="mb-4">
              <label className="block text-sm mb-1">Model</label>
              <input
                type="text"
                value={field.state.value}
                onChange={e => field.handleChange(e.target.value)}
                className="input"
                placeholder="openai/gpt-4o-mini"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="baseUrl">
          {field => (
            <div className="mb-4">
              <label className="block text-sm mb-1">Base URL (optional)</label>
              <input
                type="text"
                value={field.state.value || ''}
                onChange={e => field.handleChange(e.target.value)}
                className="input"
                placeholder="http://localhost:11434/v1"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="apiKey">
          {field => (
            <div className="mb-4">
              <label className="block text-sm mb-1">API Key</label>
              <input
                type="password"
                value={field.state.value}
                onChange={e => field.handleChange(e.target.value)}
                className="input"
                placeholder="sk-..."
              />
            </div>
          )}
        </form.Field>

        <div className="flex gap-3">
          <button type="submit" className="btn" disabled={status === 'saving'}>
            {status === 'saving' ? 'Saving...' : 'Save Configuration'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={testStatus === 'testing'}
            onClick={async () => {
              setTestStatus('testing')
              try {
                const values = form.getFieldValue('provider') ? {
                  provider: form.getFieldValue('provider'),
                  model: form.getFieldValue('model'),
                  baseUrl: form.getFieldValue('baseUrl') || undefined,
                  apiKey: form.getFieldValue('apiKey'),
                } as ProviderConfig : undefined

                if (!values) return

                const result = await testConnection({ data: values })
                setDialogData({ prompt: result.prompt, response: result.response })
                setTestStatus('success')
              } catch (err) {
                setDialogData({
                  prompt: '',
                  response: err instanceof Error ? err.message : 'Connection failed',
                })
                setTestStatus('error')
              }
            }}
          >
            {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
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

      {dialogData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setDialogData(null)}
        >
          <div
            className="bg-surface border border-border rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {testStatus === 'error' ? 'Connection Failed' : 'Connection Test Result'}
              </h3>
              <button
                className="text-text-muted hover:text-text text-xl leading-none"
                onClick={() => setDialogData(null)}
              >
                &times;
              </button>
            </div>

            {testStatus === 'error' ? (
              <div className="bg-error/10 text-error p-3 rounded">{dialogData.response}</div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm text-text-muted mb-1">Sent to LLM</label>
                  <pre className="bg-bg border border-border rounded p-3 text-sm whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                    {dialogData.prompt}
                  </pre>
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-1">Response from LLM</label>
                  <pre className="bg-bg border border-border rounded p-3 text-sm whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                    {dialogData.response}
                  </pre>
                </div>
              </>
            )}

            <button
              className="btn mt-4"
              onClick={() => setDialogData(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
