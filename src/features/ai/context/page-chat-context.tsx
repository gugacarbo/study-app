import { useRouterState } from "@tanstack/react-router";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import type { ParsedClientTools } from "@/routes/api/chat/-schema";
import {
	getPageChatRegistration,
	type PageChatContextRegistration,
	registerPageChatContext,
	subscribePageChatRegistry,
	unregisterPageChatContext,
} from "./page-chat-registry";

export interface PageChatContext {
	contextKey: string;
	pageType: string;
	label: string;
	route: string;
	examId?: string;
	questionId?: string;
	summary?: string;
	clientTools?: ParsedClientTools;
}

/** Serializable subset sent to the server in metadata.pageContext */
export type PageChatContextPayload = Omit<PageChatContext, "clientTools">;

const PageChatContextValue = createContext<PageChatContext>({
	contextKey: "global",
	pageType: "global",
	label: "Geral",
	route: "/",
});

export function usePageChatContext(): PageChatContext {
	return useContext(PageChatContextValue);
}

export function useRegisterPageChatContext(
	registration: PageChatContextRegistration,
): void {
	const { contextKey } = usePageChatContext();
	const { summary, examId, questionId, clientTools } = registration;

	useEffect(() => {
		registerPageChatContext(contextKey, {
			summary,
			examId,
			questionId,
			clientTools,
		});
		return () => unregisterPageChatContext(contextKey);
	}, [contextKey, summary, examId, questionId, clientTools]);
}

function detectRouteContext(pathname: string, params: Record<string, string>): {
	contextKey: string;
	pageType: string;
	label: string;
	examId?: string;
} {
	if (pathname.startsWith("/exams/") && params.id) {
		return {
			contextKey: `exam:${params.id}`,
			pageType: "exam",
			label: `Prova #${params.id}`,
			examId: params.id,
		};
	}

	if (pathname.startsWith("/quiz/") && params.id) {
		return {
			contextKey: `quiz:${params.id}`,
			pageType: "quiz",
			label: `Quiz #${params.id}`,
			examId: params.id,
		};
	}

	if (pathname.startsWith("/exams/upload")) {
		return {
			contextKey: "ingest",
			pageType: "ingest",
			label: "Upload / Ingestão",
		};
	}

	if (pathname.startsWith("/memory")) {
		return {
			contextKey: "memory",
			pageType: "memory",
			label: "Memória",
		};
	}

	if (pathname === "/" || pathname === "") {
		return {
			contextKey: "global",
			pageType: "dashboard",
			label: "Dashboard",
		};
	}

	return {
		contextKey: "global",
		pageType: "global",
		label: "Geral",
	};
}

function registrationToClientTools(
	registration: PageChatContextRegistration | undefined,
): ParsedClientTools | undefined {
	if (!registration?.clientTools?.length) return undefined;

	return Object.fromEntries(
		registration.clientTools.map((tool) => [
			tool.name,
			{
				...(tool.description !== undefined
					? { description: tool.description }
					: {}),
				parameters: tool.parameters,
			},
		]),
	);
}

export function PageChatContextProvider({ children }: { children: ReactNode }) {
	const routerState = useRouterState();
	const pathname = routerState.location.pathname;
	const params = routerState.matches.at(-1)?.params ?? {};
	const routeParams = Object.fromEntries(
		Object.entries(params).map(([key, value]) => [key, String(value)]),
	);

	const [, bumpRegistry] = useState(0);
	useEffect(() => subscribePageChatRegistry(() => bumpRegistry((n) => n + 1)), []);

	const baseContext = useMemo(
		() => detectRouteContext(pathname, routeParams),
		[pathname, routeParams],
	);

	const registration = getPageChatRegistration(baseContext.contextKey);

	const value = useMemo<PageChatContext>(() => {
		const clientTools = registrationToClientTools(registration);
		return {
			...baseContext,
			route: pathname,
			examId: registration?.examId ?? baseContext.examId,
			questionId: registration?.questionId,
			summary: registration?.summary,
			...(clientTools ? { clientTools } : {}),
		};
	}, [baseContext, pathname, registration]);

	return (
		<PageChatContextValue.Provider value={value}>
			{children}
		</PageChatContextValue.Provider>
	);
}
