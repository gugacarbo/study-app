# /exams/ingest Page Redesign — Design Spec

**Date:** 2026-06-01
**Status:** Approved

## Overview

Redesign the `/exams/ingest` page layout to improve visual hierarchy, separate concerns into components, and add interactive pipeline stage logging.

## Goals

- Improve visual organization of upload, queue, and job detail areas
- Make the pipeline flow (stages) a fixed, prominent element
- Allow users to click a pipeline stage to filter logs by that stage
- Keep output area scrollable independently
- Extract all UI into focused, reusable components

## Layout: Sidebar + Main Stage

The page uses a **two-column layout**:

- **Left sidebar** (~280px): Upload area + Queue list
- **Right main stage** (flex-1): Active job detail with flow, tabs, and output

```
┌─────────────────┬──────────────────────────────────────┐
│  Upload         │  exam_2024.pdf    [Running]          │
│  ┌───────────┐  │                                      │
│  │ Drop file │  │  ┌────────────────────────────────┐  │
│  │   here    │  │  │ Pipeline Flow (clickable)      │  │
│  └───────────┘  │  │  Decode → Extract → Refine...  │  │
│  [Review toggle]│  └────────────────────────────────┘  │
│  [Upload]       │                                      │
│                 │  [Output] [Logs]  [Filtered: Refine ✕]│
│  Queue (3)      │  ┌────────────────────────────────┐  │
│  ┌───────────┐  │  │ [scrollable output/logs area]  │  │
│  │ exam.pdf  │  │  │                                │  │
│  │ notes.md  │  │  │                                │  │
│  └───────────┘  │  └────────────────────────────────┘  │
└─────────────────┴──────────────────────────────────────┘
```

## Components

### 1. `IngestPage` (route component)

- Reads `ingestStore` for jobs and focused job
- Renders the two-column grid
- Delegates to child components; minimal logic

### 2. `UploadCard`

**Props:** `onUpload(file, enableReview)`

**Responsibilities:**
- File input (hidden) + trigger button
- Drag & drop zone visual (optional enhancement)
- "Revisão crítica" toggle switch
- Upload button (disabled when no file)

**States:**
- Idle (no file)
- File selected (show filename)

### 3. `QueueList`

**Props:** `jobs: IngestJob[], focusedJobId: string | null`

**Responsibilities:**
- Reverse-chronological list of jobs
- Each row shows filename + status badge
- Click to focus job
- Cancel button for queued/running jobs
- Empty state when no jobs

### 4. `JobDetailPanel`

**Props:** `job: IngestJob`

**Responsibilities:**
- Header with filename, status badge, review badge
- Renders `PipelineFlow`
- Renders tab switcher (Output / Logs)
- Renders scrollable content area

### 5. `PipelineFlow`

**Props:** `stages: FlowStage[], activeStageId: string | null, onStageClick: (stageId) => void`

**Responsibilities:**
- Horizontal row of stage cards
- Each stage shows dot indicator + label
- Color by status: done (green), running (blue), warning (amber), error (red), pending (gray)
- Clicking a stage calls `onStageClick`
- Active/selected stage gets a ring highlight

### 6. `OutputPanel`

**Props:** `text: string, tokenTotals: TokenTotals`

**Responsibilities:**
- Token count badge
- Scrollable monospace output area
- Empty state placeholder

### 7. `LogsPanel`

**Props:** `logs: string[], filteredStageId: string | null, onClearFilter: () => void`

**Responsibilities:**
- If `filteredStageId` is set, show filter chip + clear button
- Filter logs to only those containing the stage label (or use stage metadata if available)
- Scrollable monospace log list
- Color lines containing "Error" / "Warning"

## Data Flow

1. User selects file → `UploadCard` calls `onUpload` → `enqueueIngest()`
2. `ingestStore` updates → `IngestPage` re-renders
3. User clicks job in `QueueList` → `focusJob()`
4. `JobDetailPanel` receives job → renders `PipelineFlow`
5. User clicks stage in `PipelineFlow` → `JobDetailPanel` switches to Logs tab + sets filter
6. `LogsPanel` filters logs by stage

## State (local to route)

```typescript
interface IngestPageState {
  activeTab: "output" | "logs";
  selectedStageId: string | null; // for log filtering
}
```

This state lives in `IngestPage` and is passed down as props.

## Interaction Details

### Stage Click → Filter Logs

1. User clicks a stage in `PipelineFlow`
2. `IngestPage` sets `activeTab = "logs"` and `selectedStageId = stageId`
3. `JobDetailPanel` renders `LogsPanel` with filter
4. `LogsPanel` shows chip: "Filtered: Refine" with ✕ to clear
5. Clearing filter sets `selectedStageId = null`

### Log Filtering Logic

Logs are plain strings like `[14:32:01] Starting memory refinement...`. Since logs don't have structured stage metadata, filtering is **best-effort**:

- Option A: Filter by substring match against stage label (e.g., logs containing "refine" when stage "Refine" is selected)
- Option B: Store stage association in log metadata (requires store change)

**Decision:** Start with Option A (substring match). If too noisy, enhance store to tag logs with stageId.

## Styling

- Uses existing Tailwind + shadcn/ui components (`Card`, `Badge`, `Button`, `Tabs`)
- Dark mode compatible (relies on existing CSS variables)
- Scroll areas use `overflow-auto` with `max-h` or `flex-1` in flex column

## File Structure

```
src/routes/exams.ingest.tsx          # Route component (thin)
src/components/ingest/
  ├── UploadCard.tsx                  # File upload + toggle
  ├── QueueList.tsx                   # Job queue sidebar
  ├── JobDetailPanel.tsx              # Main stage container
  ├── PipelineFlow.tsx                # Horizontal stage flow
  ├── OutputPanel.tsx                 # Scrollable output
  └── LogsPanel.tsx                   # Scrollable logs with filter
```

## Open Questions

None — all decisions made during brainstorming.
