import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { hydrateLayoutUIStore } from "@/features/ai/stores/ui-store";
import { BackgroundProcessProvider } from "@/features/background-processes/provider/background-process-provider";
import { ThemeProvider } from "@/features/theme/components/theme-provider";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 5,
			retry: 1,
		},
	},
});

export function RootProviders({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		hydrateLayoutUIStore();
	}, []);

	return (
		<ThemeProvider defaultTheme="system" storageKey="theme">
			<TooltipProvider>
				<QueryClientProvider client={queryClient}>
					<BackgroundProcessProvider>{children}</BackgroundProcessProvider>
				</QueryClientProvider>
			</TooltipProvider>
		</ThemeProvider>
	);
}
