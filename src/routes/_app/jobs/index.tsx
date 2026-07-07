import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { UserJobsPage } from "@/features/background-processes/pages/user-jobs-page";

export const Route = createFileRoute("/_app/jobs/")({
	validateSearch: (search: Record<string, unknown>) => {
		const page =
			typeof search.page === "number" ? search.page : Number(search.page ?? 1);

		return {
			page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
		};
	},
	component: UserJobsRoute,
});

function UserJobsRoute() {
	const navigate = useNavigate();
	const { page } = Route.useSearch();

	return (
		<UserJobsPage
			page={page}
			onPageChange={(nextPage) => {
				void navigate({
					to: "/jobs",
					search: { page: nextPage },
				});
			}}
		/>
	);
}
