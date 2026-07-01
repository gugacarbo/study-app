export const QUESTION_IMPROVEMENT_RULES = [
	// --- Formatting ---
	"Use markdown formatting in question text, option text, explanation, and deepExplanation (e.g. **bold**, *italic*, `code`, lists).",
	"Do not wrap the entire question or options in markdown code fences or backticks.",

	// --- Option length ---
	"Ensure the correct answer is not noticeably longer than the distractors — similar option lengths reduce guessing bias. If the correct answer is much longer, either shorten it or expand the distractors.",
	"Keep option lengths within a reasonable range: no option should be more than 2.5x the length of the shortest option.",

	// --- Distractor quality ---
	"Every distractor must be plausible — a student who hasn't studied the topic should be able to believe it could be correct.",
	"Distractors must relate to the same topic as the question; avoid obviously out-of-scope options.",
	"Avoid using 'all of the above', 'none of the above', or other meta-options.",
	"Avoid using 'todas acima', 'nenhuma acima' or similar meta-options in Portuguese.",

	// --- Clarity and ambiguity ---
	"The question must have exactly one correct answer unless scoringMode is 'partial'.",
	"The question text must be unambiguous — avoid vague wording like 'maybe', 'possibly', or 'generally'.",
	"If the question uses negative wording (e.g. 'não', 'exceto', 'which is NOT'), ensure it is clearly marked and the negation is emphasized.",
	"Each option must be grammatically consistent with the question stem (e.g. if the stem ends with 'is', all options should complete that structure).",

	// --- Writing style ---
	"Write the question text concisely — avoid unnecessary preamble or redundant context.",
	"Write option text as parallel phrases of similar structure and length.",
	"Use formal, neutral academic language — avoid slang, colloquialisms, or overly casual tone.",
	"Avoid absolute terms like 'always', 'never', 'everyone', 'no one' unless they are factually correct in context.",
];
