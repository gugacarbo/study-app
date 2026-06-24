import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { RoleToggle } from "@/features/admin/components/role-toggle";
import type { AdminUser } from "@/features/admin/hooks/use-admin-users";
import { formatMutationError } from "@/features/admin/lib/mutation-error";
import type { SetUserRoleInput } from "@/features/admin/schemas/set-user-role";

type UsersTableProps = {
	users: AdminUser[];
	currentUserId?: string;
	onSetRole: (input: SetUserRoleInput) => Promise<void>;
};

export function UsersTable({
	users,
	currentUserId,
	onSetRole,
}: UsersTableProps) {
	const [error, setError] = useState<string | null>(null);
	const [pendingUserId, setPendingUserId] = useState<string | null>(null);

	async function toggleAdmin(user: AdminUser, checked: boolean) {
		setPendingUserId(user.id);
		setError(null);
		try {
			await onSetRole({
				userId: user.id,
				roleKey: "admin",
				action: checked ? "add" : "remove",
			});
		} catch (cause) {
			setError(await formatMutationError(cause));
		} finally {
			setPendingUserId(null);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Usuários</CardTitle>
				<CardDescription>
					Atribua ou remova a role admin. O último admin não pode ser removido.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{error ? (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				) : null}
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Email</TableHead>
							<TableHead>Roles</TableHead>
							<TableHead>Admin</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{users.length === 0 ? (
							<TableRow>
								<TableCell colSpan={3} className="text-muted-foreground">
									Nenhum usuário encontrado.
								</TableCell>
							</TableRow>
						) : (
							users.map((user) => (
								<TableRow key={user.id}>
									<TableCell className="font-medium">{user.email}</TableCell>
									<TableCell>
										{user.roles.length === 0 ? "—" : user.roles.join(", ")}
									</TableCell>
									<TableCell>
										<RoleToggle
											user={user}
											roleKey="admin"
											currentUserId={currentUserId}
											disabled={pendingUserId === user.id}
											onToggle={(checked) => toggleAdmin(user, checked)}
										/>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
