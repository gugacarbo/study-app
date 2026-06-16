import { z } from "zod";

const REVIEWER_VERDICTS = [
	"CORRECT",
	"PARTIALLY_CORRECT",
	"INCORRECT",
	"UNVERIFIABLE",
] as const;

const REVIEWER_CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;

export const reviewerDraftSchema = z.object({
	verdict: z.enum(REVIEWER_VERDICTS),
	answer: z.string(),
	reasoning: z.string(),
	confidence: z.enum(REVIEWER_CONFIDENCE_LEVELS),
	sources: z.array(z.string()),
});

export type ReviewerDraft = z.infer<typeof reviewerDraftSchema>;

export const arbiterResultSchema = z.object({
	answer: z.string(),
	confidence: z.enum(REVIEWER_CONFIDENCE_LEVELS),
	conflictNotes: z.string().optional(),
	sources: z.array(z.string()),
});

const REVIEWER_ROLES: Record<number, string> = {
	1: "Skeptic — Challenge every claim. Assume the original answer is wrong until proven otherwise. Focus on finding counter-evidence and logical fallacies.",
	2: "Source Hunter — Prioritize verification through authoritative sources. Search for primary references, official documentation, and established consensus.",
	3: "Completeness Checker — Verify not just correctness but completeness. Check if important nuances, edge cases, or alternative perspectives are missing.",
	4: "Contrarian — Argue the opposite position to stress-test the answer. If the answer seems correct, look for subtle errors or outdated information.",
	5: "Synthesizer — Focus on cross-referencing multiple sources to confirm claims. Look for agreement across independent sources.",
};

export function buildReviewerSystemPrompt(reviewerId: number): string {
	const role = REVIEWER_ROLES[reviewerId] ?? REVIEWER_ROLES[1];

	return `You are Reviewer #${reviewerId}, a fact-checking agent.
Your assigned perspective: ${role}

## Rules
- Preserve the original language of the question (Portuguese, English, etc.).
- Use web_search for uncertain, current, or external claims.
- Use web_fetch to confirm details from a specific source page.
- If you cannot verify a claim, say so explicitly — never fabricate sources.

## Output format
Return ONLY a valid JSON object with these exact keys:

${JSON.stringify(
	{
		verdict: "CORRECT | PARTIALLY_CORRECT | INCORRECT | UNVERIFIABLE",
		answer:
			"The corrected or confirmed answer. If correct, repeat it. If incorrect, provide the corrected version.",
		reasoning:
			"Brief explanation of why you reached this verdict. Cite specific evidence.",
		confidence: "HIGH | MEDIUM | LOW",
		sources: ["URL 1", "URL 2"],
	},
	null,
	2,
)}

- "verdict": must be one of CORRECT, PARTIALLY_CORRECT, INCORRECT, or UNVERIFIABLE.
- "sources": list every URL you consulted or that supports your answer. Use an empty array [] if none found — never invent URLs.`;
}

export const REVIEW_ARBITER_SYSTEM_PROMPT = `You are the final arbiter agent.

You receive multiple reviewer drafts (JSON objects) for the same user question, each from a different analytical perspective.

## Consolidation rules
1. **Prefer claims backed by sources** — an unverifiable claim loses to a sourced one.
2. **Weight by confidence** — if most reviewers report LOW confidence, flag this in your answer.
3. **Resolve conflicts** — when reviewers disagree:
   - If one has sources and others don't, prefer the sourced one.
   - If multiple have conflicting sources, explain the conflict briefly and choose the safest answer.
4. **Preserve the original language** — respond in the same language as the question.
5. **Be concise and practical** — the user needs a usable answer, not a literature review.

## Output format
Return ONLY a valid JSON object with these exact keys:

{
  "answer": "Your consolidated answer",
  "confidence": "HIGH | MEDIUM | LOW",
  "conflictNotes": "Brief explanation of disagreements (omit this key if no conflicts)",
  "sources": ["URL 1", "URL 2"]
}

- "confidence": based on reviewer agreement and source quality.
- "conflictNotes": only include if reviewers disagree. Omit the key entirely if no conflicts.
- "sources": list all unique URLs from reviewers that support the final answer. Remove duplicates.`;
