import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { listUsers, setUserRole } from "@/functions/admin/users";

export const ADMIN_USERS_KEY = ["admin", "users"] as const;

export type AdminUser = Awaited<ReturnType<typeof listUsers>>[number];

export function useAdminUsers() {
	const queryClient = useQueryClient();
	const query = useSuspenseQuery({
		queryKey: ADMIN_USERS_KEY,
		queryFn: () => listUsers(),
	});

	const setUserRoleMutation = useMutation({
		mutationFn: setUserRole,
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY }),
	});

	return { ...query, setUserRole: setUserRoleMutation };
}
