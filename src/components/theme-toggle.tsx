import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
	const { theme, setTheme } = useTheme();

	function toggleTheme() {
		if (theme === "dark") {
			setTheme("light");
		} else {
			setTheme("dark");
		}
	}

	return (
		<Button
			variant="outline"
			size="icon"
			onClick={toggleTheme}
			aria-label="Toggle theme"
		>
			{theme === "dark" ? (
				<Sun className="!h-5 !w-5" />
			) : (
				<Moon className="!h-5 !w-5" />
			)}
		</Button>
	);
}
