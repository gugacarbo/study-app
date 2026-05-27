import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getObsidianStatus, exportQuestionsToVault, saveStatsToVault, searchVault } from '../server-functions/obsidian'
import { getExams } from '../server-functions/stats'
import { ObsidianConfigForm } from './ObsidianConfigForm'

export function ObsidianPanel() {
  const [statusMessage, setStatusMessage] = useState('')
  const [exporting, setExporting] = useState<number | null>(null)
  const [savingStats, setSavingStats] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ path: string; content: string }>>([])

  const { data: status } = useSuspenseQuery({
    queryKey: ['obsidian-status'],
    queryFn: () => getObsidianStatus(),
  })

  const { data: exams } = useSuspenseQuery({
    queryKey: ['exams'],
    queryFn: () => getExams(),
  })

  const handleExport = async (examId: number, examName: string) => {
    setExporting(examId)
    try {
      const result = await exportQuestionsToVault({ data: { examId, examName } })
      setStatusMessage(result.exported ? `Exported ${result.count} questions to ${result.path}` : result.message || 'Export failed')
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Export failed')
    }
    setExporting(null)
  }

  const handleSaveStats = async () => {
    setSavingStats(true)
    try {
      const result = await saveStatsToVault()
      setStatusMessage(result.saved ? `Stats saved to ${result.path}` : result.message || '')
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Failed to save stats')
    }
    setSavingStats(false)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    try {
      const result = await searchVault({ data: { query: searchQuery } })
      setSearchResults(result.results)
    } catch (err) {
      setStatusMessage('Search failed: ' + (err instanceof Error ? err.message : ''))
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Obsidian Integration</h2>

        <div className={`p-3 rounded mb-4 text-sm flex items-center gap-2 ${status.connected ? 'bg-success/10 text-success' : status.enabled ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'}`}>
          <span className={`w-2 h-2 rounded-full ${status.connected ? 'bg-success' : status.enabled ? 'bg-error' : 'bg-warning'}`} />
          {status.connected ? 'Connected' : status.enabled ? 'Disconnected' : 'Disabled'}
          {status.enabled && !status.connected && (
            <span className="text-xs ml-2">— Make sure the Obsidian Local REST API plugin is running</span>
          )}
        </div>

        <ObsidianConfigForm
          currentConfig={{
            host: status.host || 'localhost',
            port: status.port || 27124,
            enabled: status.enabled,
          }}
          onStatusChange={() => {}}
        />
      </div>

      {status.connected && (
        <>
          <div className="card">
            <h3 className="text-lg font-semibold mb-3">Recent Sessions & Memory</h3>
            <p className="text-sm text-text-muted mb-4">
              Quiz sessions are automatically saved to your Obsidian vault when you complete them.
            </p>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-3">Export Questions to Vault</h3>
            <p className="text-sm text-text-muted mb-4">
              Export question banks from your exams to Markdown files in the vault.
            </p>

            <div className="space-y-2">
              {exams.map(exam => (
                <div key={exam.id} className="flex items-center justify-between p-2 bg-bg rounded">
                  <span className="text-sm">{exam.name}</span>
                  <button
                    className="btn text-xs"
                    onClick={() => handleExport(exam.id, exam.name)}
                    disabled={exporting === exam.id}
                  >
                    {exporting === exam.id ? 'Exporting...' : 'Export'}
                  </button>
                </div>
              ))}
              {exams.length === 0 && (
                <p className="text-sm text-text-muted">No exams imported yet.</p>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-3">Save Stats Snapshot</h3>
            <p className="text-sm text-text-muted mb-4">
              Save current learning stats to the vault as a Markdown table.
            </p>
            <button className="btn" onClick={handleSaveStats} disabled={savingStats}>
              {savingStats ? 'Saving...' : 'Save Stats to Vault'}
            </button>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-3">Search Vault</h3>
            <p className="text-sm text-text-muted mb-4">
              Search your entire vault for relevant notes (used by AI for context).
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="input"
                placeholder="Search your notes..."
              />
              <button className="btn" onClick={handleSearch}>Search</button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {searchResults.map((r, i) => (
                  <div key={i} className="p-2 bg-bg rounded text-sm">
                    <div className="font-medium text-xs text-text-muted mb-1">{r.path}</div>
                    <div className="text-text">{r.content.slice(0, 200)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {statusMessage && (
        <div className="card">
          <p className="text-sm">{statusMessage}</p>
        </div>
      )}
    </div>
  )
}
