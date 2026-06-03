import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
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
	return (
		<ThemeProvider defaultTheme="system" storageKey="theme">
			<TooltipProvider>
				<QueryClientProvider client={queryClient}>
					{children}
				</QueryClientProvider>
			</TooltipProvider>
		</ThemeProvider>
	);
}
