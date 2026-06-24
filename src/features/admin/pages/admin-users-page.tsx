import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { UsersTable } from "@/features/admin/components/users-table";
import { useAdminUsers } from "@/features/admin/hooks/use-admin-users";
import { getSession } from "@/functions/auth/require-session";

function UsersSkeleton() {
	return <Skeleton className="h-48 w-full" />;
}

export function AdminUsersPageContent() {
	const { data: users, setUserRole } = useAdminUsers();
	const { data: session } = useQuery({
		queryKey: ["session"],
		queryFn: () => getSession(),
	});

	return (
		<UsersTable
			users={users}
			currentUserId={session?.user.id}
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
