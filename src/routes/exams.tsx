import {
	createFileRoute,
	Outlet,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FileRoutesByTo } from "@/routeTree.gen";

export const Route = createFileRoute("/exams")({
	component: ExamsLayout,
});

function ExamsLayout() {
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	if (pathname === "/exams/upload") {
		return <Outlet />;
	}

	const tabValue: keyof FileRoutesByTo =
		pathname === "/exams/stats" ? "/exams/stats" : "/exams";

	return (
		<Tabs
			value={tabValue}
			onValueChange={(value) => navigate({ to: value as keyof FileRoutesByTo })}
			className="flex-1 overflow-hidden"
		>
			<TabsList>
				<TabsTrigger value="/exams">Exams</TabsTrigger>
				<TabsTrigger value="/exams/stats">Stats</TabsTrigger>
			</TabsList>
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<Outlet />
			</div>
		</Tabs>
	);
}
