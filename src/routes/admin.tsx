import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminLayout } from "@/features/admin/components/admin-layout";

export const Route = createFileRoute("/admin")({
	component: AdminRouteLayout,
});

function AdminRouteLayout() {
	return (
		<AdminLayout>
			<Outlet />
		</AdminLayout>
	);
}
