import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
	{ to: "/admin/config" as const, label: "Config" },
	{ to: "/admin/users" as const, label: "Users" },
];

type AdminShellProps = {
	title: string;
	description?: string;
	children: React.ReactNode;
};

export function AdminShell({ title, description, children }: AdminShellProps) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
		<div className="mx-auto min-h-dvh w-full max-w-4xl px-4 py-8">
			<div className="space-y-6">
				<header className="space-y-4">
					<div className="space-y-1">
						<h1 className="text-2xl font-semibold">{title}</h1>
						{description ? (
							<p className="text-sm text-muted-foreground">{description}</p>
						) : null}
					</div>
					<nav className="flex gap-2">
						{NAV_ITEMS.map((item) => {
							const active = pathname.startsWith(item.to);
							return (
								<Link
									key={item.to}
									to={item.to}
									className={cn(
										"rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
										active
											? "bg-primary text-primary-foreground"
											: "text-muted-foreground hover:bg-muted hover:text-foreground",
									)}
								>
									{item.label}
								</Link>
							);
						})}
					</nav>
				</header>
				{children}
			</div>
		</div>
	);
}
