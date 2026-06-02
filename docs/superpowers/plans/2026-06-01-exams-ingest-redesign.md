# /exams/ingest Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `/exams/ingest` page into focused components with Sidebar+Main Stage layout, fixed pipeline flow, and stage-click log filtering.

**Architecture:** Extract 6 presentational components from the monolithic route file. Route component becomes a thin orchestrator that holds local state for active tab and selected stage filter. Pipeline flow is clickable and switches to Logs tab with filter applied.

**Tech Stack:** React 19, TanStack Store, Tailwind CSS v4, shadcn/ui (Card, Badge, Button, Tabs), Lucide icons

---

## File Structure

```
src/routes/exams.ingest.tsx          # Route component (thin orchestrator)
src/components/ingest/
  ├── UploadCard.tsx                  # File upload + review toggle
  ├── QueueList.tsx                   # Job queue sidebar
  ├── JobDetailPanel.tsx              # Main stage container
  ├── PipelineFlow.tsx                # Horizontal clickable stage flow
  ├── OutputPanel.tsx                 # Scrollable output
  └── LogsPanel.tsx                   # Scrollable logs with stage filter
```

---

### Task 1: Create `PipelineFlow` Component

**Files:**
- Create: `src/components/ingest/PipelineFlow.tsx`

**Context:** Extract the `FlowStageCard` logic from `exams.ingest.tsx` into a reusable horizontal flow component. Each stage is clickable.

- [ ] **Step 1: Write the component**

```tsx
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FlowStage } from "@/stores/ingestStore";

interface PipelineFlowProps {
  stages: FlowStage[];
  activeStageId: string | null;
  onStageClick: (stageId: string) => void;
}

const statusColors: Record<FlowStage["status"], string> = {
  done: "border-green-500/50 bg-green-500/10",
  running: "border-blue-500/50 bg-blue-500/10",
  warning: "border-amber-500/50 bg-amber-500/10",
  error: "border-red-500/50 bg-red-500/10",
  pending: "border-muted-foreground/20 bg-muted/30",
};

const indicatorColors: Record<FlowStage["status"], string> = {
  done: "bg-green-500",
  running: "bg-blue-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  pending: "bg-muted-foreground/40",
};

export function PipelineFlow({ stages, activeStageId, onStageClick }: PipelineFlowProps) {
  if (stages.length === 0) {
    return (
      <p className="text-center text-xs text-muted-foreground py-4">
        No flow stages yet
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {stages.map((stage, i) => (
        <div key={stage.stageId} className="flex items-center gap-0.5">
          <Card
            size="sm"
            className={cn(
              "flex flex-col items-center gap-1 p-2 text-center cursor-pointer transition-all",
              statusColors[stage.status],
              activeStageId === stage.stageId && "ring-2 ring-primary",
            )}
            onClick={() => onStageClick(stage.stageId)}
          >
            <div className="flex items-center gap-1">
              {stage.status === "running" ? (
                <Loader2 className="size-2.5 animate-spin text-blue-500" />
              ) : (
                <div
                  className={cn(
                    "size-1.5 rounded-full",
                    indicatorColors[stage.status],
                  )}
                />
              )}
              <span className="text-[0.625rem] font-medium whitespace-nowrap">
                {stage.label}
              </span>
            </div>
          </Card>
          {i < stages.length - 1 && (
            <span className="text-[0.625rem] text-muted-foreground">→</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ingest/PipelineFlow.tsx
git commit -m "feat(ingest): add PipelineFlow component"
```

---

### Task 2: Create `UploadCard` Component

**Files:**
- Create: `src/components/ingest/UploadCard.tsx`

**Context:** Extract the upload area from `exams.ingest.tsx` — file picker, review toggle, and upload button.

- [ ] **Step 1: Write the component**

```tsx
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface UploadCardProps {
  onUpload: (file: File, enableReview: boolean) => void;
}

export function UploadCard({ onUpload }: UploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [enableReview, setEnableReview] = useState(true);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  function handleUpload() {
    if (!selectedFile) return;
    onUpload(selectedFile, enableReview);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingest Exams</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-1 size-3.5" />
            {selectedFile ? selectedFile.name : "Choose file (.pdf, .txt, .md)"}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <Label htmlFor="ingest-review-toggle" className="text-xs">
            Revisao critica
          </Label>
          <button
            id="ingest-review-toggle"
            type="button"
            role="switch"
            aria-checked={enableReview}
            onClick={() => setEnableReview((prev) => !prev)}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
              enableReview ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-background transition-transform",
                enableReview ? "translate-x-4" : "translate-x-0.5",
              )}
            />
          </button>
        </div>
        <Button onClick={handleUpload} disabled={!selectedFile} size="sm">
          Upload &amp; Extract
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ingest/UploadCard.tsx
git commit -m "feat(ingest): add UploadCard component"
```

---

### Task 3: Create `QueueList` Component

**Files:**
- Create: `src/components/ingest/QueueList.tsx`

**Context:** Extract the job queue list from `exams.ingest.tsx`. Shows jobs in reverse order with status badges and cancel buttons.

- [ ] **Step 1: Write the component**

```tsx
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IngestJob } from "@/stores/ingestStore";

interface QueueListProps {
  jobs: IngestJob[];
  focusedJobId: string | null;
  onFocusJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
}

export function QueueList({ jobs, focusedJobId, onFocusJob, onCancelJob }: QueueListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Queue ({jobs.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No jobs yet</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {[...jobs].reverse().map((job) => (
              <JobRow
                key={job.id}
                job={job}
                isFocused={job.id === focusedJobId}
                onFocus={() => onFocusJob(job.id)}
                onCancel={() => onCancelJob(job.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JobRow({
  job,
  isFocused,
  onFocus,
  onCancel,
}: {
  job: IngestJob;
  isFocused: boolean;
  onFocus: () => void;
  onCancel: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onFocus}
      className={cn(
        "flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
        isFocused
          ? "bg-primary/10 ring-1 ring-primary/30"
          : "hover:bg-muted/50",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-medium">{job.fileName}</span>
        <StatusBadge status={job.status} />
      </div>
      {(job.status === "queued" || job.status === "running") && (
        <Button
          variant="ghost"
          size="sm"
          className="ml-2 h-5 px-1.5 text-[0.625rem] text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
        >
          Cancel
        </Button>
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: IngestJob["status"] }) {
  const variantMap: Record<
    IngestJob["status"],
    {
      variant: "default" | "secondary" | "destructive" | "outline";
      label: string;
    }
  > = {
    queued: { variant: "secondary", label: "Queued" },
    running: { variant: "default", label: "Running" },
    success: { variant: "outline", label: "Success" },
    error: { variant: "destructive", label: "Error" },
    canceled: { variant: "secondary", label: "Canceled" },
  };
  const { variant, label } = variantMap[status];

  return (
    <Badge variant={variant} className="shrink-0">
      {status === "running" && (
        <Loader2 className="mr-0.5 inline size-2 animate-spin" />
      )}
      {label}
    </Badge>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ingest/QueueList.tsx
git commit -m "feat(ingest): add QueueList component"
```

---

### Task 4: Create `OutputPanel` Component

**Files:**
- Create: `src/components/ingest/OutputPanel.tsx`

**Context:** Extract the Output tab content from `exams.ingest.tsx`.

- [ ] **Step 1: Write the component**

```tsx
import { Badge } from "@/components/ui/badge";
import type { TokenTotals } from "@/stores/ingestStore";

interface OutputPanelProps {
  text: string;
  tokenTotals: TokenTotals;
  isRunning: boolean;
}

export function OutputPanel({ text, tokenTotals, isRunning }: OutputPanelProps) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-2 flex items-center gap-2">
        <Badge variant="secondary" className="text-[0.625rem]">
          Tokens: {tokenTotals.total.toLocaleString()}
        </Badge>
      </div>
      <div className="flex-1 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-[0.7rem] leading-relaxed whitespace-pre-wrap">
        {text || (
          <span className="text-muted-foreground">
            {isRunning ? "Waiting for output..." : "No output yet"}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ingest/OutputPanel.tsx
git commit -m "feat(ingest): add OutputPanel component"
```

---

### Task 5: Create `LogsPanel` Component

**Files:**
- Create: `src/components/ingest/LogsPanel.tsx`

**Context:** Extract the Logs tab content with stage filtering support. When `filteredStageId` is set, only show logs that contain the stage label.

- [ ] **Step 1: Write the component**

```tsx
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FlowStage } from "@/stores/ingestStore";

interface LogsPanelProps {
  logs: string[];
  stages: FlowStage[];
  filteredStageId: string | null;
  onClearFilter: () => void;
}

export function LogsPanel({ logs, stages, filteredStageId, onClearFilter }: LogsPanelProps) {
  const filteredStage = stages.find((s) => s.stageId === filteredStageId);
  
  const displayLogs = filteredStage
    ? logs.filter((log) =>
        log.toLowerCase().includes(filteredStage.label.toLowerCase())
      )
    : logs;

  return (
    <div className="flex flex-1 flex-col">
      {filteredStage && (
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="secondary" className="text-[0.625rem]">
            Filtered: {filteredStage.label}
          </Badge>
          <button
            onClick={onClearFilter}
            className="inline-flex items-center gap-1 text-[0.625rem] text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
            Clear filter
          </button>
        </div>
      )}
      <div className="flex-1 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-[0.7rem] leading-relaxed">
        {displayLogs.length === 0 ? (
          <span className="text-muted-foreground">
            {filteredStage ? "No logs for this stage yet" : "No logs yet"}
          </span>
        ) : (
          <LogLines logs={displayLogs} />
        )}
      </div>
    </div>
  );
}

function LogLines({ logs }: { logs: string[] }) {
  return logs.map((line, i) => (
    <div
      key={`${line}-${i}`}
      className={
        line.includes("Error") || line.includes("Warning")
          ? "text-destructive"
          : ""
      }
    >
      {line}
    </div>
  ));
}
```

- [ ] **Step 2: Verify types**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ingest/LogsPanel.tsx
git commit -m "feat(ingest): add LogsPanel component with stage filtering"
```

---

### Task 6: Create `JobDetailPanel` Component

**Files:**
- Create: `src/components/ingest/JobDetailPanel.tsx`

**Context:** Extract the right-column job detail from `exams.ingest.tsx`. Combines PipelineFlow, Tabs, OutputPanel, and LogsPanel.

- [ ] **Step 1: Write the component**

```tsx
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { IngestJob } from "@/stores/ingestStore";
import { LogsPanel } from "./LogsPanel";
import { OutputPanel } from "./OutputPanel";
import { PipelineFlow } from "./PipelineFlow";

interface JobDetailPanelProps {
  job: IngestJob;
  activeTab: "output" | "logs";
  selectedStageId: string | null;
  onTabChange: (tab: "output" | "logs") => void;
  onStageClick: (stageId: string) => void;
  onClearStageFilter: () => void;
}

export function JobDetailPanel({
  job,
  activeTab,
  selectedStageId,
  onTabChange,
  onStageClick,
  onClearStageFilter,
}: JobDetailPanelProps) {
  return (
    <Card className="flex flex-1 flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="truncate">{job.fileName}</span>
          <StatusBadge status={job.status} />
          <Badge variant="secondary" className="text-[0.625rem]">
            Review: {job.enableReview ? "on" : "off"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {/* Pipeline Flow — fixed at top */}
        <div className="rounded-md border bg-muted/30 p-3">
          <PipelineFlow
            stages={job.flowStages}
            activeStageId={selectedStageId}
            onStageClick={onStageClick}
          />
        </div>

        {/* Tabs + Content */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => onTabChange(v as "output" | "logs")}
          className="flex flex-1 flex-col"
        >
          <TabsList className="mb-3">
            <TabsTrigger value="output">Output</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent
            value="output"
            className="flex flex-1 flex-col data-[state=active]:flex data-[state=active]:flex-col"
          >
            <OutputPanel
              text={job.streamText}
              tokenTotals={job.tokenTotals}
              isRunning={job.status === "running"}
            />
          </TabsContent>

          <TabsContent
            value="logs"
            className="flex flex-1 flex-col data-[state=active]:flex data-[state=active]:flex-col"
          >
            <LogsPanel
              logs={job.logs}
              stages={job.flowStages}
              filteredStageId={selectedStageId}
              onClearFilter={onClearStageFilter}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: IngestJob["status"] }) {
  const variantMap: Record<
    IngestJob["status"],
    { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
  > = {
    queued: { variant: "secondary", label: "Queued" },
    running: { variant: "default", label: "Running" },
    success: { variant: "outline", label: "Success" },
    error: { variant: "destructive", label: "Error" },
    canceled: { variant: "secondary", label: "Canceled" },
  };
  const { variant, label } = variantMap[status];

  return (
    <Badge variant={variant} className="shrink-0 text-[0.625rem]">
      {label}
    </Badge>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ingest/JobDetailPanel.tsx
git commit -m "feat(ingest): add JobDetailPanel component"
```

---

### Task 7: Refactor `exams.ingest.tsx` Route

**Files:**
- Modify: `src/routes/exams.ingest.tsx`

**Context:** Replace the monolithic route component with the thin orchestrator that uses all extracted components. Add local state for `activeTab` and `selectedStageId`.

- [ ] **Step 1: Rewrite the route component**

Replace the entire file content with:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  cancelJob,
  enqueueIngest,
  focusJob,
  ingestStore,
} from "@/stores/ingestStore";
import { JobDetailPanel } from "@/components/ingest/JobDetailPanel";
import { QueueList } from "@/components/ingest/QueueList";
import { UploadCard } from "@/components/ingest/UploadCard";

export const Route = createFileRoute("/exams/ingest")({
  component: IngestPage,
});

function IngestPage() {
  const { jobs, focusedJobId } = useStore(ingestStore, (s) => ({
    jobs: s.jobs,
    focusedJobId: s.focusedJobId,
  }));

  const [activeTab, setActiveTab] = useState<"output" | "logs">("output");
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  const focusedJob =
    focusedJobId != null
      ? (jobs.find((j) => j.id === focusedJobId) ?? null)
      : null;

  async function handleUpload(file: File, enableReview: boolean) {
    const buffer = await file.arrayBuffer();
    enqueueIngest(
      file.name,
      Array.from(new Uint8Array(buffer)),
      enableReview,
    );
  }

  function handleStageClick(stageId: string) {
    setSelectedStageId(stageId);
    setActiveTab("logs");
  }

  function handleClearStageFilter() {
    setSelectedStageId(null);
  }

  return (
    <div className="container py-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left: Upload + Queue */}
        <div className="flex flex-col gap-4">
          <UploadCard onUpload={handleUpload} />
          <QueueList
            jobs={jobs}
            focusedJobId={focusedJobId}
            onFocusJob={focusJob}
            onCancelJob={cancelJob}
          />
        </div>

        {/* Right: Focused Job Details */}
        <div className="flex flex-col gap-4">
          {!focusedJob ? (
            <Card>
              <CardContent className="py-8 text-center text-xs text-muted-foreground">
                Select a job from the queue
              </CardContent>
            </Card>
          ) : (
            <JobDetailPanel
              job={focusedJob}
              activeTab={activeTab}
              selectedStageId={selectedStageId}
              onTabChange={setActiveTab}
              onStageClick={handleStageClick}
              onClearStageFilter={handleClearStageFilter}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: No errors

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run dev server smoke test**

Run: `npm run dev` (in background) or just verify build passes.

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/routes/exams.ingest.tsx
git commit -m "refactor(ingest): rewrite exams.ingest route with extracted components"
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| Sidebar + Main Stage layout | Task 7 |
| UploadCard component | Task 2 |
| QueueList component | Task 3 |
| PipelineFlow fixed at top | Task 6 |
| PipelineFlow clickable → filter logs | Task 1, 5, 6, 7 |
| Output scrollable | Task 4, 6 |
| Logs filterable by stage | Task 5, 6, 7 |
| All UI extracted to components | Tasks 1-6 |

## Placeholder Scan

- No TBDs, TODOs, or vague requirements.
- All code blocks contain complete, runnable code.
- All file paths are exact.
- All commands have expected outputs.

## Type Consistency Check

- `FlowStage` imported from `@/stores/ingestStore` — used in Tasks 1, 5, 6
- `IngestJob` imported from `@/stores/ingestStore` — used in Tasks 3, 6, 7
- `TokenTotals` imported from `@/stores/ingestStore` — used in Task 4
- `activeTab` type `"output" | "logs"` — consistent across Tasks 6, 7
- `selectedStageId` type `string | null` — consistent across Tasks 1, 5, 6, 7
