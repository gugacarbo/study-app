# Quiz Start Screen Design

## Summary

Add a mandatory start screen before the quiz player for exam-based quizzes at `/quiz/$id`.
The start screen should always appear first, even when there is no saved progress.
It should act as a preparation and resume hub with contextual exam information and actions for starting, continuing, or resetting a quiz attempt.

## Goals

- Always show a pre-quiz screen before the active quiz attempt begins.
- Preserve the existing local quiz persistence and resume behavior.
- Make the current progress state visible before the user enters the player.
- Avoid creating or resuming an active attempt implicitly on route load.

## Non-Goals

- Changing topic-based quiz routes or adding a new multi-step router flow.
- Reworking quiz grading, completion summary, or memory-save behavior.
- Introducing server-side attempt bootstrapping before the first answered question.

## Current State

- Dashboard and exam detail `Start Quiz` actions navigate directly to `/quiz/$id`.
- The `/quiz/$id` route renders the quiz player immediately.
- `useQuizState()` loads config and fetches questions as soon as the player mounts.
- `useQuizPersistence()` restores quiz state from `localStorage` and clears it after completion.
- A server-side attempt row is only created when the first answer is submitted, which should remain true.

## Proposed Approach

Keep `/quiz/$id` as the entry route, but turn it into an orchestrator with two explicit phases:

1. Start screen phase
2. Active quiz player phase

The start screen becomes the default phase for every visit to `/quiz/$id`.
The player mounts only after the user chooses an action.

## UX Design

### Start Screen Content

The screen should show:

- Exam name
- Planned question count for this session
- Short helper copy explaining that the attempt starts only after an explicit action
- Current progress status
- Action buttons based on saved progress

### Saved Progress Card

When a local quiz snapshot exists for the exam, show a progress card with:

- Answered questions count
- Total questions
- Current score so far
- A status label such as `Attempt in progress`

When no snapshot exists, show a lighter empty state such as `No attempt started yet`.

### Actions

Without saved progress:

- `Start new attempt`

With saved progress:

- `Continue attempt`
- `Restart from scratch`

Behavior rules:

- `Start new attempt` clears any stale local state for the exam and opens a fresh player session.
- `Continue attempt` opens the player and lets the existing persistence layer hydrate the prior snapshot.
- `Restart from scratch` clears the local snapshot, resets client quiz state, and opens a fresh player session.

## Technical Design

### Route Structure

Keep `src/routes/quiz.$id.tsx` as the only route for exam quiz entry.
Move route-level orchestration there or into a dedicated feature component under `src/features/quiz/components/`.

### Component Split

Add a dedicated start-screen component, for example `QuizStartScreen`.
Keep the existing quiz player logic in a focused player component.

Recommended structure:

- `QuizPage` or route wrapper: loads exam context and controls which phase is visible
- `QuizStartScreen`: renders metadata, progress summary, and action buttons
- `Quiz`: existing player, mounted only after start/continue/reset

### Data Flow

The start screen needs lightweight exam metadata plus local snapshot information.

- Exam metadata should come from the existing exam data layer or a small query added for the route.
- Saved progress should be derived from the same `localStorage` key pattern already used by `useQuizPersistence()`.

To avoid drift, the storage key format should be centralized in a shared helper used by:

- Start screen state detection
- Quiz persistence restore/save
- Reset/restart actions

### Quiz Loading

The player should defer `generateQuiz()` until the user enters the active phase.
This keeps the start screen as a true pre-attempt step and avoids loading quiz questions before the user commits.

### Persistence Compatibility

Existing persistence behavior should stay intact once the player is active:

- restore prior quiz state on continue
- save updates during the attempt
- clear storage on completion
- keep memory-save behavior tied to quiz completion

`Restart from scratch` must clear both:

- saved `localStorage` snapshot
- current in-memory `quizStore` state

## Error Handling

- If the saved snapshot is malformed or incompatible with the current question count, treat it as no saved progress.
- If quiz generation fails after the user starts or continues, show the existing loading/error path from the player layer.
- If exam metadata cannot be loaded, keep the route-level error behavior consistent with existing query usage.

## Testing Strategy

Add tests for the new route-phase behavior and persistence integration:

- start screen renders first on `/quiz/$id`
- no saved progress shows only the fresh-start action
- saved progress shows continue and restart actions
- continue mounts the player with persisted state
- restart clears saved progress before mounting the player
- completion still clears storage and preserves current post-quiz behavior

## Risks And Mitigations

- Risk: duplicate storage-key logic between the start screen and persistence hook.
  Mitigation: extract a shared helper for exam/topic quiz storage keys and snapshot parsing.

- Risk: player-side effects still fire before the user starts.
  Mitigation: gate player mounting and question fetching behind an explicit `mode` or `hasStarted` flag.

- Risk: restart could leave stale in-memory state behind.
  Mitigation: use an explicit reset path that clears both `quizStore` and the saved snapshot before mounting the player.

## Implementation Notes

- Preserve current links from dashboard and exam detail to `/quiz/$id`.
- Prefer small compositional changes over adding another route.
- Keep the design mobile-friendly since the start screen becomes the default quiz entry experience.
