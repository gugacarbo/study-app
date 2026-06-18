import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { UsersTable } from "@/features/admin/components/users-table";
import { useAdminUsers } from "@/features/admin/hooks/use-admin-users";

function UsersSkeleton() {
	return <Skeleton className="h-48 w-full" />;
}

export function AdminUsersPageContent() {
	const { data: users, setUserRole } = useAdminUsers();

	return (
		<UsersTable
			users={users}
			onSetRole={(input) => setUserRole.mutateAsync({ data: input })}
		/>
	);
}

export function AdminUsersPage() {
	return (
		<Suspense fallback={<UsersSkeleton />}>
			<AdminUsersPageContent />
		</Suspense>
	);
}
