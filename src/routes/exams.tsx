import {
	createFileRoute,
	Outlet,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/exams")({
	component: ExamsLayout,
});

function ExamsLayout() {
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const tabValue =
		pathname === "/exams/ingest"
			? "/exams/ingest"
			: pathname === "/exams/stats"
				? "/exams/stats"
				: "/exams";

	return (
		<Tabs
			value={tabValue}
			onValueChange={(value) => navigate({ to: value })}
			className="flex-1 overflow-hidden"
		>
			<TabsList>
				<TabsTrigger value="/exams">Exams</TabsTrigger>
				<TabsTrigger value="/exams/stats">Stats</TabsTrigger>
				<TabsTrigger value="/exams/ingest">Ingest</TabsTrigger>
			</TabsList>
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<Outlet />
			</div>
		</Tabs>
	);
}
