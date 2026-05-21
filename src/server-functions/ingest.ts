import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { DBQueries } from '../db/queries';
import { getDB } from './db';
import { extractQuestionsFromText } from '../lib/ai';
import { providerConfigSchema } from '../lib/validation';

async function extractTextFromFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const text = new TextDecoder().decode(bytes);
  return text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').trim();
}

const ingestSchema = z.object({
  file: z.instanceof(File),
  config: providerConfigSchema,
});

export const ingestExam = createServerFn({ method: 'POST' })
  .inputValidator(ingestSchema)
  .handler(async (ctx) => {
    const { data } = ctx;
    const db = getDB(ctx);
    if (!db) {
      throw new Error('D1 database not available');
    }

    const queries = new DBQueries(db);
    const text = await extractTextFromFile(data.file);

    if (!text || text.length < 50) {
      throw new Error('Could not extract enough text from file. Try pasting text manually.');
    }

    const extracted = await extractQuestionsFromText(data.config, text);
    const examId = await queries.insertExam(data.file.name, 'upload');

    if (extracted.questions.length > 0) {
      await queries.insertQuestions(examId, extracted.questions);
    }

    return {
      questions: extracted.questions.length,
      topics: extracted.topics,
      examId,
    };
  });
