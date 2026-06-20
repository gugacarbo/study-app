# Exam detail hub — design summary

**Date:** 2026-06-19  
**Spec:** SPEC-0008 (`docs/specs/exams/0008-catalogo-exames.md`)

## Goal

Authenticated users open `/exams/$examId` as a study hub: exam metadata, placeholder CTAs for quiz/explanations, and a collapsible question list with local “reveal answer” state.

## Architecture

| Layer | Responsibility |
| ----- | -------------- |
| Route | `src/routes/_app/exams/$examId/index.tsx` — passes `examId` to page |
| Page | `ExamDetailPage` — Suspense + skeleton; `ExamDetailPageContent` fetches via `useExam` |
| Server fn | `getExam` → `getExamWithQuestions` + `parseQuestionRow` (invalid JSON rows omitted) |
| D1 | `getExamWithQuestions` composes `getExamById` + `listQuestionsByExam` |
| Types | `ExamDetail` / `QuestionDetail` in `features/exams/types/exam-detail.ts` |

## UI layout (option A)

1. Header — name, question count, created date (pt-BR)
2. Actions — “Iniciar quiz” / “Explicações” disabled with “Em breve”
3. Question list — collapsible cards; trigger `Q{n} · {topic ?? "Geral"}`; expanded shows stem + options; ghost “Revelar resposta” toggles correct keys locally

## Navigation entry points

- **List:** `ExamsList` cards navigate SPA to `/exams/$examId`
- **Job monitor:** completed ingest with `metadata.examId` shows primary “Ver prova” (no auto-redirect)

## Auth & errors

`requireSession`; exam filtered by `user_id`. Missing or cross-user exam → HTTP 404 from `getExamHandler`.

## Out of scope (v1)

Quiz (SPEC-0009), explanations (SPEC-0011), exam edit/delete, list filters/search.
