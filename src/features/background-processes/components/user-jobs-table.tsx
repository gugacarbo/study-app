import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { UserJobListItem } from "@/functions/jobs/list-user-jobs";
import {
	formatJobKind,
	formatJobPhase,
	formatJobStatus,
	formatJobTimestamp,
	truncateText,
} from "@/features/admin/lib/job-labels";
import { statusBadgeVariant } from "@/lib/job-kinds";

type UserJobsTableProps = {
	jobs: UserJobListItem[];
	page: number;
	pageSize: number;
	total: number;
	onPageChange: (page: number) => void;
};

export function UserJobsTable({
	jobs,
	page,
	pageSize,
	total,
	onPageChange,
}: UserJobsTableProps) {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const startRow = total > 0 ? (page - 1) * pageSize + 1 : 0;
	const endRow = Math.min(page * pageSize, total);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Meus jobs</CardTitle>
				<CardDescription>
					Acompanhe os processamentos da sua conta e abra o monitor de cada job.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Job</TableHead>
								<TableHead>Tipo</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Criado</TableHead>
								<TableHead>Erro</TableHead>
								<TableHead className="text-right">Ação</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{jobs.length === 0 ? (
								<TableRow>
									<TableCell colSpan={6} className="text-muted-foreground">
										Nenhum job encontrado.
									</TableCell>
								</TableRow>
							) : (
								jobs.map((job) => (
									<TableRow key={job.id}>
										<TableCell className="font-medium">{job.title}</TableCell>
										<TableCell>{formatJobKind(job.kind)}</TableCell>
										<TableCell>
											<div className="flex flex-col gap-1">
											{(() => {
													const sv = statusBadgeVariant(job.status);
													return (
														<Badge variant={sv.variant} className={sv.className}>
															{formatJobStatus(job.status)}
														</Badge>
													);
												})()}
												{job.phase ? (
													<span className="text-xs text-muted-foreground">
														{formatJobPhase(job.phase)}
													</span>
												) : null}
											</div>
										</TableCell>
										<TableCell className="whitespace-nowrap text-sm">
											{formatJobTimestamp(job.createdAt)}
										</TableCell>
										<TableCell className="max-w-[14rem] text-sm text-muted-foreground">
											{truncateText(job.error)}
										</TableCell>
										<TableCell className="text-right">
											<Button asChild size="sm" variant="outline">
												<Link to="/jobs/$jobId" params={{ jobId: job.id }}>
													Abrir
												</Link>
											</Button>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>

					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<span className="text-sm text-muted-foreground">
							{total > 0 ? `${startRow}–${endRow} de ${total}` : "0 resultados"}
						</span>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={page <= 1}
								onClick={() => onPageChange(page - 1)}
							>
								Anterior
							</Button>
							<span className="text-sm text-muted-foreground">
								Página {page} de {totalPages}
							</span>
							<Button
								variant="outline"
								size="sm"
								disabled={page >= totalPages}
								onClick={() => onPageChange(page + 1)}
							>
								Próxima
							</Button>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
