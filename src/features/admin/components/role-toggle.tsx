import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { AdminUser } from "@/features/admin/hooks/use-admin-users";

type RoleToggleProps = {
	user: AdminUser;
	roleKey: "admin";
	disabled?: boolean;
	onToggle: (checked: boolean) => void;
};

export function RoleToggle({
	user,
	roleKey,
	disabled,
	onToggle,
}: RoleToggleProps) {
	const hasRole = user.roles.includes(roleKey);

	return (
		<div className="flex items-center gap-2">
			<Switch
				checked={hasRole}
				disabled={disabled}
				onCheckedChange={onToggle}
				aria-label={`${roleKey} para ${user.email}`}
			/>
			<Badge variant={hasRole ? "default" : "outline"}>{roleKey}</Badge>
		</div>
	);
}
