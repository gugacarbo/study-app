import { useState } from 'react'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Trash2, Play, FileText, Calendar, Tag, ListChecks, ChevronRight } from 'lucide-react'
import { getExamsDetailed, deleteExam } from '../server-functions/exams'

function formatFileSize(bytes: number | null): string {
	if (bytes === null || bytes === undefined) return 'Unknown'
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string | null): string {
	if (!dateStr) return 'Unknown'
	try {
		return new Date(dateStr).toLocaleDateString('pt-BR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		})
	} catch {
		return dateStr
	}
}

export function ExamsView() {
	const queryClient = useQueryClient()
	const [deletingId, setDeletingId] = useState<number | null>(null)
	const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

	const { data: exams } = useSuspenseQuery({
		queryKey: ['exams-detailed'],
		queryFn: () => getExamsDetailed(),
	})

	const handleDelete = async (id: number) => {
		setDeletingId(id)
		try {
			await deleteExam({ data: { id } })
			queryClient.invalidateQueries({ queryKey: ['exams-detailed'] })
			queryClient.invalidateQueries({ queryKey: ['exams'] })
			queryClient.invalidateQueries({ queryKey: ['stats'] })
		} catch (err) {
			console.error('Failed to delete exam:', err)
		} finally {
			setDeletingId(null)
			setConfirmDelete(null)
		}
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-bold">Exams</h1>
				<span className="text-sm text-text-muted">
					{exams.length} {exams.length === 1 ? 'exam' : 'exams'}
				</span>
			</div>

			{exams.length === 0 ? (
				<div className="card text-center py-12">
					<FileText className="mx-auto mb-4 h-12 w-12 text-text-muted" />
					<p className="text-text-muted mb-4">
						No exams uploaded yet.
					</p>
					<Link to="/upload" className="btn">
						Upload your first exam
					</Link>
				</div>
			) : (
				<div className="space-y-4">
					{exams.map((exam) => (
						<div key={exam.id} className="card">
							<div className="flex items-start justify-between gap-4">
								<Link
									to="/exams/$id"
									params={{ id: exam.id.toString() }}
									className="flex-1 min-w-0 group"
								>
									{/* Exam name */}
									<h2 className="text-lg font-semibold truncate group-hover:text-primary transition-colors">
										{exam.name}
									</h2>

									{/* Meta info */}
									<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-muted">
										<span className="inline-flex items-center gap-1">
											<Calendar className="h-3.5 w-3.5" />
											{formatDate(exam.created_at)}
										</span>
										<span className="inline-flex items-center gap-1">
											<ListChecks className="h-3.5 w-3.5" />
											{exam.questionCount}{' '}
											{exam.questionCount === 1 ? 'question' : 'questions'}
										</span>
										{exam.source && (
											<span className="inline-flex items-center gap-1 truncate max-w-[200px]">
												<FileText className="h-3.5 w-3.5 shrink-0" />
												<span className="truncate">{exam.source}</span>
											</span>
										)}
									</div>

									{/* Topics */}
									{exam.topics.length > 0 && (
										<div className="mt-3 flex flex-wrap items-center gap-1.5">
											<Tag className="h-3.5 w-3.5 text-text-muted shrink-0" />
											{exam.topics.map((topic) => (
												<span
													key={topic}
													className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
												>
													{topic}
												</span>
											))}
										</div>
									)}

									{/* File info */}
									{exam.files.length > 0 && (
										<div className="mt-3 space-y-1">
											{exam.files.map((file) => (
												<div
													key={file.id}
													className="flex items-center gap-2 text-xs text-text-muted"
												>
													<FileText className="h-3 w-3 shrink-0" />
													<span className="truncate">{file.name}</span>
													{file.size !== null && file.size !== undefined && (
														<span>({formatFileSize(file.size)})</span>
													)}
												</div>
											))}
										</div>
									)}
								</Link>

								{/* Actions */}
								<div className="flex flex-col gap-2 shrink-0">
									<Link
										to="/quiz/$id"
										params={{ id: exam.id.toString() }}
										className="btn text-sm gap-1.5"
									>
										<Play className="h-4 w-4" />
										Quiz
									</Link>
									<Link
										to="/exams/$id"
										params={{ id: exam.id.toString() }}
									className="btn text-sm gap-1.5 bg-transparent text-text-muted border-border"
								>
									<ChevronRight className="h-4 w-4" />
									Details
								</Link>
									{confirmDelete === exam.id ? (
										<div className="flex gap-1.5">
											<button
												type="button"
												onClick={() => handleDelete(exam.id)}
												disabled={deletingId === exam.id}
												className="flex-1 rounded bg-error/20 px-2.5 py-1.5 text-xs font-medium text-error hover:bg-error/30 transition-colors disabled:opacity-50"
											>
												{deletingId === exam.id ? '...' : 'Confirm'}
											</button>
											<button
												type="button"
												onClick={() => setConfirmDelete(null)}
												className="flex-1 rounded bg-surface-hover px-2.5 py-1.5 text-xs font-medium text-text-muted hover:text-text transition-colors"
											>
												Cancel
											</button>
										</div>
									) : (
										<button
											type="button"
											onClick={() => setConfirmDelete(exam.id)}
											className="btn text-sm gap-1.5"
											style={{
												background: 'transparent',
												color: 'var(--text-muted)',
												border: '1px solid var(--border)',
											}}
											onMouseEnter={(e) => {
												e.currentTarget.style.background = 'var(--error)'
												e.currentTarget.style.color = 'var(--primary-foreground)'
												e.currentTarget.style.borderColor = 'transparent'
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.background = 'transparent'
												e.currentTarget.style.color = 'var(--text-muted)'
												e.currentTarget.style.borderColor = 'var(--border)'
											}}
										>
											<Trash2 className="h-4 w-4" />
										</button>
									)}
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
