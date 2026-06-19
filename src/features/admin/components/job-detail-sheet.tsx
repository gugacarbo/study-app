import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { JobDetailContent } from "@/features/admin/components/job-detail-content";
import { useAdminJobDetail } from "@/features/admin/hooks/use-admin-jobs";

type JobDetailSheetProps = {
	jobId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCancel: (jobId: string) => Promise<void>;
};

export function JobDetailSheet({
	jobId,
	open,
	onOpenChange,
	onCancel,
}: JobDetailSheetProps) {
	const {
		data: detail,
		isLoading,
		isError,
	} = useAdminJobDetail(open ? jobId : null);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="flex w-full flex-col sm:max-w-lg">
				<SheetHeader>
					<SheetTitle>Detalhe do job</SheetTitle>
					<SheetDescription>
						{jobId ? (
							<span className="font-mono text-xs">{jobId}</span>
						) : (
							"Selecione um job na tabela."
						)}
					</SheetDescription>
				</SheetHeader>

				{isLoading ? (
					<p className="px-4 text-sm text-muted-foreground">Carregando…</p>
				) : isError || !detail ? (
					<p className="px-4 text-sm text-destructive">
						Não foi possível carregar o job.
					</p>
				) : (
					<JobDetailContent
						detail={detail}
						onCancel={() => onCancel(detail.id)}
					/>
				)}
			</SheetContent>
		</Sheet>
	);
}
