import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IngestEventsGroupedList } from "@/features/background-processes/components/ingest-events-grouped-list";
import { INGEST_DATA_PART } from "@/features/ai/jobs/ingest/ingest-events";
import { PHASE_TEXT } from "@/features/ai/jobs/ingest/run-ingest/constants";
import { INITIALIZATION_GROUP_LABEL } from "@/features/background-processes/lib/group-ingest-events";
import { INGEST_PHASE, JOB_STATUS } from "@/lib/job-kinds";

afterEach(() => {
	cleanup();
});

describe("IngestEventsGroupedList", () => {
	it("renders humanized labels in grouped sections without raw JSON", () => {
		render(
			<IngestEventsGroupedList
				isLoading={false}
				status={JOB_STATUS.RUNNING}
				phase={INGEST_PHASE.READING_FILE}
				error={null}
				events={[
					{
						seq: 1,
						payload: { type: "text", text: PHASE_TEXT[INGEST_PHASE.READING_FILE] },
						createdAt: null,
					},
					{
						seq: 2,
						payload: {
							type: INGEST_DATA_PART.PHASE,
							data: { phase: INGEST_PHASE.READING_FILE },
						},
						createdAt: null,
					},
					{
						seq: 3,
						payload: { type: "text", text: "Arquivo lido: 100 caracteres" },
						createdAt: null,
					},
				]}
			/>,
		);

		expect(screen.getByText(INITIALIZATION_GROUP_LABEL)).toBeInTheDocument();
		expect(screen.getByText("Lendo arquivo")).toBeInTheDocument();
		expect(screen.getByText(/#3/)).toBeInTheDocument();
		expect(screen.getByText(/arquivo lido/i)).toBeInTheDocument();
		expect(screen.queryByText(/"type":/)).not.toBeInTheDocument();
	});

	it("expands the active group and collapses completed groups by default", () => {
		const { container } = render(
			<IngestEventsGroupedList
				isLoading={false}
				status={JOB_STATUS.RUNNING}
				phase={INGEST_PHASE.EXTRACTING}
				error={null}
				events={[
					{
						seq: 1,
						payload: {
							type: INGEST_DATA_PART.PHASE,
							data: { phase: INGEST_PHASE.READING_FILE },
						},
						createdAt: null,
					},
					{
						seq: 2,
						payload: { type: "text", text: "Arquivo lido: 50 caracteres" },
						createdAt: null,
					},
					{
						seq: 3,
						payload: {
							type: INGEST_DATA_PART.PHASE,
							data: { phase: INGEST_PHASE.EXTRACTING },
						},
						createdAt: null,
					},
					{
						seq: 4,
						payload: { type: "text", text: "Chamando modelo para extração…" },
						createdAt: null,
					},
				]}
			/>,
		);

		const view = within(container);
		const initTrigger = view.getByRole("button", {
			name: new RegExp(INITIALIZATION_GROUP_LABEL, "i"),
		});
		const readingTrigger = view.getByRole("button", { name: /lendo arquivo/i });
		const extractingTrigger = view.getByRole("button", {
			name: /extraindo questões/i,
		});

		expect(initTrigger).toHaveAttribute("data-state", "closed");
		expect(readingTrigger).toHaveAttribute("data-state", "closed");
		expect(extractingTrigger).toHaveAttribute("data-state", "open");
		expect(within(extractingTrigger).getByText("1")).toBeInTheDocument();
	});

	it("shows failed state on the active group with error message", () => {
		const { container } = render(
			<IngestEventsGroupedList
				isLoading={false}
				status={JOB_STATUS.FAILED}
				phase={INGEST_PHASE.EXTRACTING}
				error="Falha na extração"
				events={[
					{
						seq: 1,
						payload: {
							type: INGEST_DATA_PART.PHASE,
							data: { phase: INGEST_PHASE.EXTRACTING },
						},
						createdAt: null,
					},
					{
						seq: 2,
						payload: { type: "text", text: "Chamando modelo para extração…" },
						createdAt: null,
					},
				]}
			/>,
		);

		const extractingTrigger = within(container).getByRole("button", {
			name: /extraindo questões/i,
		});
		expect(extractingTrigger).toHaveAttribute("data-state", "open");
		expect(within(container).getByRole("alert")).toHaveTextContent(
			"Falha na extração",
		);
	});

	it("shows empty state when there are no events", () => {
		render(
			<IngestEventsGroupedList
				events={[]}
				isLoading={false}
				status={null}
				phase={null}
				error={null}
			/>,
		);
		expect(
			screen.getByText(/nenhum evento registrado ainda/i),
		).toBeInTheDocument();
	});

	it("renders system message with distinct visual per kind", () => {
		render(
			<IngestEventsGroupedList
				isLoading={false}
				status={JOB_STATUS.RUNNING}
				phase={null}
				error={null}
				events={[
					{
						seq: 1,
						payload: {
							type: "data-ingest-system-info",
							data: { kind: "file-read", payload: { charCount: 100 } },
						},
						createdAt: null,
					},
				]}
			/>,
		);

		expect(screen.getByText(/arquivo lido: 100 caracteres/i)).toBeInTheDocument();
		expect(screen.queryByText("Sistema")).not.toBeInTheDocument();
		const label = screen.getByText(/arquivo lido: 100 caracteres/i);
		const row = label.closest("li");
		expect(row).toBeInTheDocument();
		expect(row).toHaveClass("border-l-2");
		expect(row).not.toHaveTextContent(/#1/);
	});

	it("deduplicates system messages by kind within group", () => {
		render(
			<IngestEventsGroupedList
				isLoading={false}
				status={JOB_STATUS.RUNNING}
				phase={INGEST_PHASE.READING_FILE}
				error={null}
				events={[
					{
						seq: 1,
						payload: {
							type: "data-ingest-system-info",
							data: { kind: "file-read", payload: { charCount: 100 } },
						},
						createdAt: null,
					},
					{
						seq: 2,
						payload: {
							type: INGEST_DATA_PART.PHASE,
							data: { phase: INGEST_PHASE.READING_FILE },
						},
						createdAt: null,
					},
					{
						seq: 3,
						payload: {
							type: "data-ingest-system-info",
							data: { kind: "file-read", payload: { charCount: 200 } },
						},
						createdAt: null,
					},
				]}
			/>,
		);

		expect(screen.getByText(/arquivo lido: 200 caracteres/i)).toBeInTheDocument();
		expect(screen.queryByText(/arquivo lido: 100 caracteres/i)).not.toBeInTheDocument();
	});

	it("system messages appear in correct phase group", () => {
		render(
			<IngestEventsGroupedList
				isLoading={false}
				status={JOB_STATUS.RUNNING}
				phase={INGEST_PHASE.READING_FILE}
				error={null}
				events={[
					{
						seq: 1,
						payload: {
							type: "data-ingest-system-info",
							data: { kind: "phase", payload: { phase: INGEST_PHASE.READING_FILE } },
						},
						createdAt: null,
					},
					{
						seq: 2,
						payload: {
							type: "data-ingest-system-info",
							data: { kind: "file-read", payload: { charCount: 50 } },
						},
						createdAt: null,
					},
				]}
			/>,
		);

		expect(screen.getByText("Lendo arquivo")).toBeInTheDocument();
		expect(screen.getByText(/arquivo lido: 50 caracteres/i)).toBeInTheDocument();
	});
});
