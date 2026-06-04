import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import type { IngestJob } from "@/features/ingest/store";
import { focusJob, ingestStore } from "@/features/ingest/store";
import ThemeToggle from "@/features/theme/components/theme-toggle";
import type { FileRoutesByTo } from "@/routeTree.gen";

const navItems = [
	{ to: "/", label: "Dashboard" },
	{ to: "/exams", label: "Exams" },
	{ to: "/memory", label: "Memory" },
	{ to: "/chat", label: "Chat" },
	{ to: "/config", label: "Config" },
] as const satisfies ReadonlyArray<{ to: keyof FileRoutesByTo; label: string }>;

function IngestIndicator() {
	const jobs = useStore(ingestStore, (s) => s.jobs);
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const navigate = useNavigate();

	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	const activeCount = jobs.filter(
		(j) => j.status === "queued" || j.status === "running",
	).length;

	const recentJobs = [...jobs]
		.sort((a, b) => b.createdAt - a.createdAt)
		.slice(0, 10);

	const statusLabel: Record<IngestJob["status"], string> = {
		running: "Running",
		queued: "Queued",
		success: "Done",
		error: "Error",
		canceled: "Canceled",
	};

	const statusColor: Record<IngestJob["status"], string> = {
		running: "bg-blue-500 text-white dark:bg-blue-600 dark:text-blue-100",
		queued: "bg-amber-500 text-white dark:bg-amber-600 dark:text-amber-100",
		success: "bg-green-500 text-white dark:bg-green-600 dark:text-green-100",
		error: "bg-red-500 text-white dark:bg-red-600 dark:text-red-100",
		canceled: "bg-gray-400 text-white dark:bg-gray-600 dark:text-gray-200",
	};

	function formatTime(ts: number) {
		const diff = (Date.now() - ts) / 1000;
		if (diff < 60) return "< 1 min ago";
		if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
		return new Date(ts).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	function truncate(name: string, max = 25) {
		return name.length > max ? `${name.slice(0, max)}...` : name;
	}

	function handleItemClick(job: IngestJob) {
		focusJob(job.id);
		setOpen(false);
		navigate({ to: "/exams/upload" });
	}

	return (
		<div ref={containerRef} className="relative">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="relative inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
			>
				<Upload className="size-4" />
				<span className="hidden sm:inline">Upload</span>
				{activeCount > 0 && (
					<Badge
						variant="default"
						className="min-w-4 h-4 px-1 text-[0.6rem] animate-pulse"
					>
						{activeCount}
					</Badge>
				)}
			</button>

			{open && (
				<div className="absolute right-0 top-full mt-1 w-72 rounded-md border border-border bg-popover shadow-lg z-50">
					<div className="p-2 border-b border-border">
						<span className="text-xs font-semibold text-foreground">
							Recent Upload Jobs
						</span>
					</div>
					{recentJobs.length === 0 ? (
						<div className="p-4 text-center text-sm text-muted-foreground">
							No upload jobs yet
						</div>
					) : (
						<div className="max-h-80 overflow-y-auto">
							{recentJobs.map((job) => (
								<button
									key={job.id}
									type="button"
									onClick={() => handleItemClick(job)}
									className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
								>
									<span className="flex-1 truncate text-foreground">
										{truncate(job.fileName)}
									</span>
									<span
										className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium ${statusColor[job.status]}`}
									>
										{statusLabel[job.status]}
									</span>
									<span className="shrink-0 text-xs text-muted-foreground">
										{formatTime(job.createdAt)}
									</span>
								</button>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export function RootNav() {
	const routerState = useRouterState();
	const pathname = routerState.location.pathname;

	return (
		<header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
			<div className="flex h-14 items-center px-6">
				<NavigationMenu>
					<NavigationMenuList>
						{navItems.map((item) => (
							<NavigationMenuItem key={item.to}>
								<NavigationMenuLink
									asChild
									active={pathname === item.to}
									className={navigationMenuTriggerStyle()}
								>
									<Link to={item.to}>{item.label}</Link>
								</NavigationMenuLink>
							</NavigationMenuItem>
						))}
					</NavigationMenuList>
				</NavigationMenu>
				<div className="ml-auto flex items-center gap-2">
					<IngestIndicator />
					<ThemeToggle />
				</div>
			</div>
		</header>
	);
}
