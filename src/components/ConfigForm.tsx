import { useState, useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { getConfig, setConfig } from '../server-functions/config'
import type { ProviderConfig } from '../lib/validation'

export function ConfigForm() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

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

        <button type="submit" className="btn" disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving...' : 'Save Configuration'}
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
