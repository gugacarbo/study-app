import { DBQueries } from "./base";

export type { DrizzleDB } from "./base";
export { DBQueries } from "./base";

export * from "./types";

import * as attemptsModule from "./attempts";
import * as attemptsStatsModule from "./attempts-stats";
import * as configModule from "./config";
import * as examsModule from "./exams";
import * as filesModule from "./files";
import * as llmLogsModule from "./llm-logs";
import * as questionsModule from "./questions";
import * as questionsListModule from "./questions-list";

Object.assign(DBQueries.prototype, configModule);
Object.assign(DBQueries.prototype, filesModule);
Object.assign(DBQueries.prototype, examsModule);
Object.assign(DBQueries.prototype, questionsModule);
Object.assign(DBQueries.prototype, questionsListModule);
Object.assign(DBQueries.prototype, attemptsModule);
Object.assign(DBQueries.prototype, attemptsStatsModule);
Object.assign(DBQueries.prototype, llmLogsModule);
