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
							"rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
							active
								? "text-foreground font-medium"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{item.label}
					</Link>
				);
			})}
		</nav>
	);
}
