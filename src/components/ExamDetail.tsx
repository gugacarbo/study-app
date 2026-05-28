import { useState } from 'react'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import {
	ArrowLeft,
	Play,
	Trash2,
	FileText,
	Calendar,
	Tag,
	ListChecks,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	HelpCircle,
	BarChart3,
	Pencil,
	Save,
	X,
} from 'lucide-react'
import { getExamDetail, deleteExam, updateQuestion } from '../server-functions/exams'

function formatDate(dateStr: string | null): string {
	if (!dateStr) return '—'
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

function formatFileSize(bytes: number | null): string {
	if (bytes === null || bytes === undefined) return '—'
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function accuracyColor(accuracy: number): string {
	if (accuracy >= 70) return 'text-success'
	if (accuracy >= 40) return 'text-warning'
	return 'text-error'
}

interface ExamDetailProps {
	examId: number
}

export function ExamDetail({ examId }: ExamDetailProps) {
	const router = useRouter()
	const queryClient = useQueryClient()
	const [deleting, setDeleting] = useState(false)
	const [confirmDelete, setConfirmDelete] = useState(false)
	const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
		new Set(),
	)
	const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null)
	const [editForm, setEditForm] = useState<{
		question: string
		options: string[]
		answer: string
		explanation: string
		topic: string
	} | null>(null)
	const [saving, setSaving] = useState(false)

	const { data: exam } = useSuspenseQuery({
		queryKey: ['exam-detail', examId],
		queryFn: () => getExamDetail({ data: { id: examId } }),
	})

	const toggleQuestion = (id: number) => {
		setExpandedQuestions((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const handleDelete = async () => {
		setDeleting(true)
		try {
			await deleteExam({ data: { id: examId } })
			queryClient.invalidateQueries({ queryKey: ['exams-detailed'] })
			queryClient.invalidateQueries({ queryKey: ['exams'] })
			queryClient.invalidateQueries({ queryKey: ['stats'] })
			router.navigate({ to: '/exams' })
		} catch (err) {
			console.error('Failed to delete exam:', err)
		} finally {
			setDeleting(false)
		}
	}

	const startEditing = (q: typeof exam.questions[0]) => {
		setEditingQuestionId(q.id)
		setEditForm({
			question: q.question,
			options: [...q.options],
			answer: q.answer,
			explanation: q.explanation || '',
			topic: q.topic || '',
		})
	}

	const cancelEditing = () => {
		setEditingQuestionId(null)
		setEditForm(null)
	}

	const handleSave = async (questionId: number) => {
		if (!editForm) return
		setSaving(true)
		try {
			await updateQuestion({
				data: {
					id: questionId,
					question: editForm.question,
					options: editForm.options,
					answer: editForm.answer,
					explanation: editForm.explanation || '',
					topic: editForm.topic || '',
				},
			})
			queryClient.invalidateQueries({ queryKey: ['exam-detail', examId] })
			cancelEditing()
		} catch (err) {
			console.error('Failed to update question:', err)
		} finally {
			setSaving(false)
		}
	}

	const { stats } = exam

	return (
		<div>
			{/* Back link */}
			<Link
				to="/exams"
				className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text mb-4 transition-colors"
			>
				<ArrowLeft className="h-4 w-4" />
				Back to exams
			</Link>

			{/* Header */}
			<div className="flex items-start justify-between gap-4 mb-6">
				<div className="flex-1 min-w-0">
					<h1 className="text-2xl font-bold truncate">{exam.name}</h1>
					{exam.source && (
						<p className="text-sm text-text-muted mt-1 truncate">
							{exam.source}
						</p>
					)}
				</div>

				{/* Actions */}
				<div className="flex gap-2 shrink-0">
					<Link
						to="/quiz/$id"
						params={{ id: exam.id.toString() }}
						className="btn text-sm gap-1.5"
					>
						<Play className="h-4 w-4" />
						Start Quiz
					</Link>
					{confirmDelete ? (
						<div className="flex gap-1.5">
							<button
								type="button"
								onClick={handleDelete}
								disabled={deleting}
								className="rounded bg-error/20 px-3 py-2 text-xs font-medium text-error hover:bg-error/30 transition-colors disabled:opacity-50"
							>
								{deleting ? '...' : 'Confirm'}
							</button>
							<button
								type="button"
								onClick={() => setConfirmDelete(false)}
								className="rounded bg-surface-hover px-3 py-2 text-xs font-medium text-text-muted hover:text-text transition-colors"
							>
								Cancel
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={() => setConfirmDelete(true)}
							className="btn text-sm"
							style={{
								background: 'transparent',
								color: 'var(--text-muted)',
								border: '1px solid var(--border)',
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.background = 'var(--error)'
								e.currentTarget.style.color = 'white'
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

			{/* Info cards */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
				<div className="card !mb-0">
					<div className="flex items-center gap-2 text-text-muted text-xs mb-1.5">
						<Calendar className="h-3.5 w-3.5" />
						Uploaded
					</div>
					<div className="font-medium text-sm">{formatDate(exam.created_at)}</div>
				</div>
				<div className="card !mb-0">
					<div className="flex items-center gap-2 text-text-muted text-xs mb-1.5">
						<ListChecks className="h-3.5 w-3.5" />
						Questions
					</div>
					<div className="font-medium text-sm">
						{exam.questionCount}
					</div>
				</div>
				<div className="card !mb-0">
					<div className="flex items-center gap-2 text-text-muted text-xs mb-1.5">
						<BarChart3 className="h-3.5 w-3.5" />
						Total Attempts
					</div>
					<div className="font-medium text-sm">
						{stats.totalAttempts}
					</div>
				</div>
				<div className="card !mb-0">
					<div className="flex items-center gap-2 text-text-muted text-xs mb-1.5">
						<HelpCircle className="h-3.5 w-3.5" />
						Accuracy
					</div>
					<div className={`font-medium text-sm ${accuracyColor(stats.overallAccuracy)}`}>
						{stats.totalAttempts > 0
							? `${stats.overallAccuracy}%`
							: '—'}
					</div>
				</div>
			</div>

			{/* Files */}
			{exam.files.length > 0 && (
				<div className="card">
					<h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
						<FileText className="h-4 w-4" />
						Source Files
					</h3>
					<div className="space-y-1.5">
						{exam.files.map((file) => (
							<div
								key={file.id}
								className="flex items-center gap-2 text-sm text-text-muted"
							>
								<FileText className="h-3.5 w-3.5 shrink-0" />
								<span className="truncate">{file.name}</span>
								<span className="text-xs">
									({formatFileSize(file.size)})
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Topics */}
			{exam.topics.length > 0 && (
				<div className="card">
					<h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
						<Tag className="h-4 w-4" />
						Topics
					</h3>
					<div className="flex flex-wrap gap-1.5">
						{exam.topics.map((topic) => (
							<span
								key={topic}
								className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
							>
								{topic}
							</span>
						))}
					</div>
				</div>
			)}

			{/* Topic Stats */}
			{stats.topicStats.length > 0 && stats.totalAttempts > 0 && (
				<div className="card">
					<h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
						<BarChart3 className="h-4 w-4" />
						Performance by Topic
					</h3>
					<div className="space-y-3">
						{stats.topicStats.map((topic) => (
							<div key={topic.topic}>
								<div className="flex items-center justify-between text-sm mb-1">
									<span className="text-text truncate">{topic.topic}</span>
									<span className={`font-medium text-xs ${accuracyColor(topic.accuracy)}`}>
										{topic.correct}/{topic.total} ({topic.accuracy}%)
									</span>
								</div>
								<div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
									<div
										className={`h-full rounded-full transition-all ${
											topic.accuracy >= 70
												? 'bg-success'
												: topic.accuracy >= 40
													? 'bg-warning'
													: 'bg-error'
										}`}
										style={{ width: `${topic.accuracy}%` }}
									/>
								</div>
							</div>
						))}

						{/* Overall bar */}
						<div className="pt-2 border-t border-border">
							<div className="flex items-center justify-between text-sm mb-1">
								<span className="font-semibold text-text">Overall</span>
								<span className={`font-semibold text-xs ${accuracyColor(stats.overallAccuracy)}`}>
									{stats.correctAttempts}/{stats.totalAttempts} ({stats.overallAccuracy}%)
								</span>
							</div>
							<div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-hover">
								<div
									className={`h-full rounded-full transition-all ${
										stats.overallAccuracy >= 70
											? 'bg-success'
											: stats.overallAccuracy >= 40
												? 'bg-warning'
												: 'bg-error'
									}`}
									style={{ width: `${stats.overallAccuracy}%` }}
								/>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Questions */}
			<div className="card">
				<div className="flex items-center justify-between mb-3">
					<h3 className="text-sm font-semibold flex items-center gap-1.5">
						<HelpCircle className="h-4 w-4" />
						Questions ({exam.questions.length})
					</h3>
					<button
						type="button"
						onClick={() => {
							if (expandedQuestions.size === exam.questions.length) {
								setExpandedQuestions(new Set())
							} else {
								setExpandedQuestions(new Set(exam.questions.map((q) => q.id)))
							}
						}}
						className="text-xs text-primary hover:underline"
					>
						{expandedQuestions.size === exam.questions.length
							? 'Collapse all'
							: 'Expand all'}
					</button>
				</div>

				{exam.questions.length === 0 ? (
					<p className="text-sm text-text-muted">No questions found.</p>
				) : (
					<div className="space-y-2">
						{exam.questions.map((q, idx) => {
							const isExpanded = expandedQuestions.has(q.id)
							return (
								<div
									key={q.id}
									className="rounded-lg border border-border overflow-hidden"
								>
									{/* Question header (always visible) */}
									<button
										type="button"
										onClick={() => toggleQuestion(q.id)}
										className="w-full flex items-start gap-3 p-3 text-left hover:bg-surface-hover transition-colors"
									>
										<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
											{idx + 1}
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-sm leading-relaxed line-clamp-2">
												{q.question}
											</p>
											{q.topic && (
												<span className="inline-block mt-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
													{q.topic}
												</span>
											)}
										</div>
										<div className="shrink-0 mt-0.5">
											{isExpanded ? (
												<ChevronUp className="h-4 w-4 text-text-muted" />
											) : (
												<ChevronDown className="h-4 w-4 text-text-muted" />
											)}
										</div>
									</button>

									{/* Expanded content */}
									{isExpanded && (
										<div className="px-3 pb-3 pt-0 border-t border-border">
											{editingQuestionId === q.id && editForm ? (
												/* Edit mode */
												<div className="mt-3 space-y-3">
													{/* Question text */}
													<div>
														<label className="text-xs font-semibold text-text-muted mb-1 block">
															Question
														</label>
														<textarea
															value={editForm.question}
															onChange={(e) =>
																setEditForm({ ...editForm, question: e.target.value })
															}
															className="w-full rounded-lg border border-border bg-surface p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y min-h-[60px]"
														/>
													</div>

													{/* Options */}
													<div>
														<label className="text-xs font-semibold text-text-muted mb-1 block">
															Options
														</label>
														<div className="space-y-1.5">
															{editForm.options.map((opt, optIdx) => {
																const letter = String.fromCharCode(65 + optIdx)
																return (
																	<div key={optIdx} className="flex items-center gap-2">
																		<input
																			type="radio"
																			name={`correct-${q.id}`}
																			checked={editForm.answer === opt}
																			onChange={() =>
																				setEditForm({ ...editForm, answer: opt })
																			}
																			className="shrink-0 accent-primary"
																		/>
																		<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-surface text-[11px] font-bold text-text-muted">
																			{letter}
																		</span>
																		<input
																			type="text"
																			value={opt}
																			onChange={(e) => {
																				const newOptions = [...editForm.options]
																				newOptions[optIdx] = e.target.value
																				setEditForm({
																					...editForm,
																					options: newOptions,
																					answer:
																						editForm.answer === opt
																							? e.target.value
																							: editForm.answer,
																				})
																			}}
																			className="flex-1 rounded-lg border border-border bg-surface p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
																		/>
																		{editForm.options.length > 2 && (
																			<button
																				type="button"
																				onClick={() => {
																					const newOptions = editForm.options.filter(
																						(_, i) => i !== optIdx,
																					)
																					const newAnswer =
																						editForm.answer === opt
																							? newOptions[0] ?? ''
																							: editForm.answer
																					setEditForm({
																						...editForm,
																						options: newOptions,
																						answer: newAnswer,
																					})
																				}}
																				className="text-text-muted hover:text-error transition-colors"
																			>
																				<X className="h-4 w-4" />
																			</button>
																		)}
																	</div>
																)
															})}
														</div>
														<button
															type="button"
															onClick={() =>
																setEditForm({
																	...editForm,
																	options: [...editForm.options, ''],
																})
															}
															className="mt-1.5 text-xs text-primary hover:underline"
														>
															+ Add option
														</button>
													</div>

													{/* Explanation */}
													<div>
														<label className="text-xs font-semibold text-text-muted mb-1 block">
															Explanation
														</label>
														<textarea
															value={editForm.explanation}
															onChange={(e) =>
																setEditForm({ ...editForm, explanation: e.target.value })
															}
															className="w-full rounded-lg border border-border bg-surface p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y min-h-[50px]"
														/>
													</div>

													{/* Actions */}
													<div className="flex gap-2">
														<button
															type="button"
															onClick={() => handleSave(q.id)}
															disabled={saving || !editForm.question || editForm.options.length < 2 || !editForm.answer}
															className="btn text-sm gap-1.5"
														>
															<Save className="h-4 w-4" />
															{saving ? 'Saving...' : 'Save'}
														</button>
														<button
															type="button"
															onClick={cancelEditing}
															className="rounded bg-surface-hover px-3 py-2 text-xs font-medium text-text-muted hover:text-text transition-colors"
														>
															Cancel
														</button>
													</div>
												</div>
											) : (
												/* View mode */
												<>
													<div className="flex justify-end mt-2">
														<button
															type="button"
															onClick={() => startEditing(q)}
															className="flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
														>
															<Pencil className="h-3.5 w-3.5" />
															Edit
														</button>
													</div>

													{/* Options */}
													<div className="space-y-1.5">
														{q.options.map((opt, optIdx) => {
															const letter = String.fromCharCode(65 + optIdx)
															const isCorrect = opt === q.answer
															return (
																<div
																	key={optIdx}
																	className={`flex items-start gap-2.5 rounded-lg p-2.5 text-sm ${
																		isCorrect
																			? 'bg-success/10 border border-success/30'
																			: 'bg-surface-hover'
																	}`}
																>
																	<span
																		className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold ${
																			isCorrect
																				? 'bg-success text-white'
																				: 'bg-surface text-text-muted'
																		}`}
																	>
																		{letter}
																	</span>
																	<span className="flex-1">{opt}</span>
																	{isCorrect && (
																		<CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
																	)}
																</div>
															)
														})}
													</div>

													{/* Explanation */}
													{q.explanation && (
														<div className="mt-3 rounded-lg bg-surface-hover p-3 text-sm">
															<p className="text-xs font-semibold text-text-muted mb-1">
																Explanation
															</p>
															<p className="leading-relaxed">{q.explanation}</p>
														</div>
													)}
												</>
											)}
										</div>
									)}
								</div>
							)
						})}
					</div>
				)}
			</div>
		</div>
	)
}
