import type { ToolSet } from "ai";
import type { DBQueries } from "../../../../db/queries";
import { createAttemptTools } from "./attempt-tools";
import { createExamTools } from "./exam-tools";
import { createQuestionKeysTools } from "./question-keys-tools";
import { createQuestionListTools } from "./question-list-tools";

export function createChatDbTools(queries: DBQueries): ToolSet {
	return {
		...createExamTools(queries),
		...createQuestionListTools(queries),
		...createQuestionKeysTools(queries),
		...createAttemptTools(queries),
	};
}
