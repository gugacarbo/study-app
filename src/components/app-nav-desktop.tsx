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
							"relative inline-flex h-9 items-center justify-center px-3 py-2 text-sm font-medium tracking-[-0.01em] text-muted-foreground transition-colors hover:text-foreground focus:outline-none",
							active && "font-semibold text-foreground",
						)}
					>
						{item.label}
						{active ? (
							<span className="absolute bottom-0.5 left-3 right-3 h-px bg-accent-foreground/40" />
						) : null}
					</Link>
				);
			})}
		</nav>
	);
}
