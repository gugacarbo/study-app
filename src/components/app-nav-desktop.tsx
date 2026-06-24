import { Link } from "@tanstack/react-router";
import { APP_NAV_ITEMS } from "@/lib/app-nav";
import { cn } from "@/lib/utils";

type AppNavDesktopProps = {
	pathname: string;
};

export function AppNavDesktop({ pathname }: AppNavDesktopProps) {
	return (
		<nav
			aria-label="Navegação principal"
			className="hidden items-center gap-1 md:flex"
		>
			{APP_NAV_ITEMS.map((item) => {
				const active = item.match(pathname);

				return (
					<Link
						key={item.to}
						to={item.to}
						aria-current={active ? "page" : undefined}
						className={cn(
							"inline-flex h-9 items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-accent/50 data-[active]:bg-accent/50",
							active
								? "bg-accent text-accent-foreground"
								: "text-muted-foreground",
						)}
					>
						{item.label}
					</Link>
				);
			})}
		</nav>
	);
}
