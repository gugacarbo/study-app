import { createServerFn } from '@tanstack/react-start';
import type { D1Database } from '@cloudflare/workers-types';
import { DBQueries } from '../db/queries';
import { extractQuestionsFromText } from '../lib/ai';
import { providerConfigSchema, type ProviderConfig } from '../lib/validation';

function getDB(): D1Database {
  return (globalThis as any).env?.DB;
}

async function extractTextFromFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const text = new TextDecoder().decode(bytes);

  return text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').trim();
}

export const ingestExam = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: { file: File; config: ProviderConfig } }) => {
    const validatedConfig = providerConfigSchema.parse(data.config);

    const db = getDB();
    if (!db) {
      throw new Error('D1 database not available');
    }

    const queries = new DBQueries(db);

    const text = await extractTextFromFile(data.file);

    if (!text || text.length < 50) {
      throw new Error('Could not extract enough text from file. Try pasting text manually.');
    }

    const extracted = await extractQuestionsFromText(validatedConfig, text);

    const examId = await queries.insertExam(data.file.name, 'upload');

    if (extracted.questions.length > 0) {
      await queries.insertQuestions(examId, extracted.questions);
    }

    return {
      questions: extracted.questions.length,
      topics: extracted.topics,
      examId,
    };
  }
);
