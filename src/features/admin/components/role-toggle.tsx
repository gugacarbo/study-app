import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { AdminUser } from "@/features/admin/hooks/use-admin-users";

type RoleToggleProps = {
	user: AdminUser;
	roleKey: "admin";
	currentUserId?: string;
	disabled?: boolean;
	onToggle: (checked: boolean) => void;
};

export function RoleToggle({
	user,
	roleKey,
	currentUserId,
	disabled,
	onToggle,
}: RoleToggleProps) {
	const hasRole = user.roles.includes(roleKey);
	const isSelf = currentUserId === user.id;
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [pendingChecked, setPendingChecked] = useState(hasRole);

	function handleSwitchChange(checked: boolean) {
		if (checked === hasRole) return;
		setPendingChecked(checked);
		setConfirmOpen(true);
	}

	function confirm() {
		setConfirmOpen(false);
		onToggle(pendingChecked);
	}

	function cancel() {
		setConfirmOpen(false);
	}

	const disabledReason = isSelf
		? "Você não pode alterar a role admin da própria conta"
		: undefined;

	return (
		<>
			<div className="flex items-center gap-2" title={disabledReason}>
				<Switch
					checked={hasRole}
					disabled={disabled || isSelf}
					onCheckedChange={handleSwitchChange}
					aria-label={`${roleKey} para ${user.email}`}
				/>
				<Badge variant={hasRole ? "default" : "outline"}>{roleKey}</Badge>
			</div>
			<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{pendingChecked
								? "Tornar administrador?"
								: "Remover administrador?"}
						</DialogTitle>
						<DialogDescription>
							{pendingChecked
								? `Deseja conceder a role ${roleKey} para ${user.email}?`
								: `Deseja remover a role ${roleKey} de ${user.email}? Ao remover, o usuário receberá a role user para manter acesso ao app.`}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={cancel}>
							Cancelar
						</Button>
						<Button
							variant={pendingChecked ? "default" : "destructive"}
							onClick={confirm}
						>
							{pendingChecked ? "Conceder" : "Remover"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
