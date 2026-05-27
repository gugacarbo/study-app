import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { DBQueries } from '../db/queries';
import { getDB } from './db';
import { extractQuestionsFromText } from '../lib/ai';
import { providerConfigSchema } from '../lib/validation';
import { getMemoryContext } from './obsidian';

function extractTextFromBytes(bytes: Uint8Array): string {
  const text = new TextDecoder().decode(bytes);
  return text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').trim();
}

const ingestSchema = z.object({
  buffer: z.array(z.number()),
  fileName: z.string(),
  config: providerConfigSchema,
});

export const ingestExam = createServerFn({ method: 'POST' })
  .inputValidator(ingestSchema)
  .handler(async (ctx) => {
    const { data } = ctx;
    const db = await getDB(ctx);
    if (!db) {
      throw new Error('D1 database not available');
    }

    const queries = new DBQueries(db);
    const bytes = new Uint8Array(data.buffer);
    const text = extractTextFromBytes(bytes);

    if (!text || text.length < 50) {
      throw new Error('Could not extract enough text from file. Try pasting text manually.');
    }

    const extracted = await extractQuestionsFromText(data.config, text);

    const topics = extracted.topics;
    const memoryResult = await getMemoryContext({ data: { topics } }).catch(() => ({ context: '' }));
    const extractedWithMemory = memoryResult.context
      ? await extractQuestionsFromText(data.config, text, memoryResult.context)
      : extracted;

    const finalExtracted = memoryResult.context ? extractedWithMemory : extracted;
    const examId = await queries.insertExam(data.fileName, 'upload');

    if (finalExtracted.questions.length > 0) {
      await queries.insertQuestions(examId, finalExtracted.questions);
    }

    return {
      questions: finalExtracted.questions.length,
      topics: finalExtracted.topics,
      examId,
    };
  });
