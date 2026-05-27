import { useState, useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { getObsidianStatus, setObsidianConfig } from '../server-functions/obsidian'

interface ObsidianConfigFormProps {
  currentConfig: {
    host: string
    port: number
    apiKey?: string
    enabled: boolean
  }
  onStatusChange: (connected: boolean) => void
}

export function ObsidianConfigForm({ currentConfig, onStatusChange }: ObsidianConfigFormProps) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [testing, setTesting] = useState(false)

  const form = useForm({
    defaultValues: {
      host: currentConfig.host,
      port: currentConfig.port,
      apiKey: currentConfig.apiKey || '',
      enabled: currentConfig.enabled,
    },
    onSubmit: async ({ value }) => {
      setStatus('saving')
      try {
        await setObsidianConfig({
          data: {
            host: value.host,
            port: value.port,
            apiKey: value.apiKey || undefined,
            enabled: value.enabled,
          },
        })
        setStatus('success')
        setMessage('Obsidian config saved')
        queryClient.invalidateQueries({ queryKey: ['obsidian-status'] })
      } catch (err) {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Unknown error')
      }
    },
  })

  useEffect(() => {
    form.setFieldValue('host', currentConfig.host)
    form.setFieldValue('port', currentConfig.port)
    form.setFieldValue('apiKey', currentConfig.apiKey || '')
    form.setFieldValue('enabled', currentConfig.enabled)
  }, [currentConfig])

  const handleTest = async () => {
    setTesting(true)
    try {
      const result = await getObsidianStatus()
      onStatusChange(result.connected)
      setMessage(result.connected ? 'Connected!' : result.message)
      setStatus(result.connected ? 'success' : 'error')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Connection failed')
      setStatus('error')
      onStatusChange(false)
    }
    setTesting(false)
  }

  return (
    <div>
      <form
        onSubmit={e => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <form.Field name="enabled">
          {field => (
            <div className="mb-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="obsidian-enabled"
                checked={field.state.value}
                onChange={e => field.handleChange(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="obsidian-enabled" className="text-sm">Enable Obsidian Integration</label>
            </div>
          )}
        </form.Field>

        <form.Field name="host">
          {field => (
            <div className="mb-4">
              <label className="block text-sm mb-1">Host</label>
              <input
                type="text"
                value={field.state.value}
                onChange={e => field.handleChange(e.target.value)}
                className="input"
                disabled={!currentConfig.enabled}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="port">
          {field => (
            <div className="mb-4">
              <label className="block text-sm mb-1">Port</label>
              <input
                type="number"
                value={field.state.value}
                onChange={e => field.handleChange(Number(e.target.value))}
                className="input"
                disabled={!currentConfig.enabled}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="apiKey">
          {field => (
            <div className="mb-4">
              <label className="block text-sm mb-1">API Key (optional)</label>
              <input
                type="password"
                value={field.state.value || ''}
                onChange={e => field.handleChange(e.target.value)}
                className="input"
                placeholder="Leave empty if not configured"
                disabled={!currentConfig.enabled}
              />
            </div>
          )}
        </form.Field>

        <div className="flex gap-2">
          <button type="submit" className="btn" disabled={status === 'saving'}>
            {status === 'saving' ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            className="btn"
            style={{ background: 'var(--text-muted)' }}
            onClick={handleTest}
            disabled={testing || !currentConfig.enabled}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
      </form>

      {status !== 'idle' && (
        <div
          className={`mt-4 p-3 rounded text-sm ${
            status === 'success' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
          }`}
        >
          {message}
        </div>
      )}
    </div>
  )
}
