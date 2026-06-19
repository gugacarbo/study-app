import { useNavigate } from "@tanstack/react-router";
import { MenuIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { APP_NAV_ITEMS } from "@/lib/app-nav";
import { cn } from "@/lib/utils";

type AppNavMobileProps = {
	pathname: string;
};

export function AppNavMobile({ pathname }: AppNavMobileProps) {
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);

	function handleNavigate(to: "/" | "/exams" | "/exams/new") {
		navigate({ to });
		setOpen(false);
	}

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					className="md:hidden"
					aria-label="Menu"
				>
					<MenuIcon />
				</Button>
			</SheetTrigger>
			<SheetContent side="left" className="w-72">
				<SheetHeader>
					<SheetTitle className="sr-only">Navegação</SheetTitle>
				</SheetHeader>
				<nav
					aria-label="Navegação principal"
					className="flex flex-col gap-1 px-4"
				>
					{APP_NAV_ITEMS.map((item) => {
						const active = item.match(pathname);
						const Icon = item.icon;

						return (
							<button
								key={item.to}
								type="button"
								aria-current={active ? "page" : undefined}
								onClick={() => handleNavigate(item.to)}
								className={cn(
									"flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
									active
										? "text-foreground font-medium"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<Icon />
								{item.label}
							</button>
						);
					})}
				</nav>
			</SheetContent>
		</Sheet>
	);
}
