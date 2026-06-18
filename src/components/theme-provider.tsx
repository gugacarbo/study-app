import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
	children: React.ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
};

type ThemeProviderState = {
	theme: Theme;
	setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
	undefined,
);

function applyTheme(theme: Theme) {
	const root = document.documentElement;
	root.classList.remove("light", "dark");

	if (theme === "system") {
		const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
			.matches
			? "dark"
			: "light";
		root.classList.add(systemTheme);
		return;
	}

	root.classList.add(theme);
}

export function ThemeProvider({
	children,
	defaultTheme = "system",
	storageKey = "study-app-theme",
}: ThemeProviderProps) {
	const [theme, setThemeState] = useState<Theme>(defaultTheme);

	useEffect(() => {
		const stored = localStorage.getItem(storageKey) as Theme | null;
		if (stored) {
			setThemeState(stored);
		}
	}, [storageKey]);

	useEffect(() => {
		applyTheme(theme);
	}, [theme]);

	useEffect(() => {
		if (theme !== "system") {
			return;
		}

		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyTheme("system");
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, [theme]);

	const setTheme = useCallback(
		(nextTheme: Theme) => {
			localStorage.setItem(storageKey, nextTheme);
			setThemeState(nextTheme);
		},
		[storageKey],
	);

	const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

	return (
		<ThemeProviderContext.Provider value={value}>
			{children}
		</ThemeProviderContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeProviderContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
