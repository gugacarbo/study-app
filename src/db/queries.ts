import type { D1Database } from '@cloudflare/workers-types';
import type { Question } from '../lib/validation';

export interface ExamRecord {
  id: number;
  name: string;
  source: string | null;
  created_at: string;
}

export interface AttemptRecord {
  id: number;
  question_id: number;
  user_answer: string;
  correct: boolean;
  timestamp: string;
}

export interface TopicStats {
  topic: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface RawQuestion {
  id: number;
  exam_id: number;
  question: string;
  options: string;
  answer: string;
  explanation: string;
  topic: string;
}

interface ParsedQuestion extends Omit<RawQuestion, 'options'> {
  options: string[];
}

export class DBQueries {
  constructor(private db: D1Database) {}

  async insertExam(name: string, source?: string): Promise<number> {
    const result = await this.db
      .prepare('INSERT INTO exams (name, source) VALUES (?, ?)')
      .bind(name, source || null)
      .run();
    return result.meta.last_row_id;
  }

  async getExams(): Promise<ExamRecord[]> {
    const result = await this.db
      .prepare('SELECT * FROM exams ORDER BY created_at DESC')
      .all<ExamRecord>();
    return result.results;
  }

  async insertQuestions(examId: number, questions: Question[]): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT INTO questions (exam_id, question, options, answer, explanation, topic) VALUES (?, ?, ?, ?, ?, ?)'
    );

    for (const q of questions) {
      await stmt.bind(
        examId,
        q.question,
        JSON.stringify(q.options),
        q.answer,
        q.explanation || '',
        q.topic || 'General'
      ).run();
    }
  }

  async getQuestionsByExam(examId: number): Promise<ParsedQuestion[]> {
    const result = await this.db
      .prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY id')
      .bind(examId)
      .all<RawQuestion>();
    return result.results.map((q): ParsedQuestion => ({
      ...q,
      options: JSON.parse(q.options),
    }));
  }

  async getRandomQuestions(count: number, topic?: string): Promise<ParsedQuestion[]> {
    let sql = 'SELECT * FROM questions';
    const params: (string | number)[] = [];

    if (topic) {
      sql += ' WHERE topic = ?';
      params.push(topic);
    }

    sql += ' ORDER BY RANDOM() LIMIT ?';
    params.push(count);

    const result = await this.db
      .prepare(sql)
      .bind(...params)
      .all<RawQuestion>();
    return result.results.map((q): ParsedQuestion => ({
      ...q,
      options: JSON.parse(q.options),
    }));
  }

  async recordAttempt(questionId: number, userAnswer: string, correct: boolean): Promise<void> {
    await this.db
      .prepare('INSERT INTO attempts (question_id, user_answer, correct) VALUES (?, ?, ?)')
      .bind(questionId, userAnswer, correct)
      .run();
  }

  async getStats(): Promise<{ totalAttempts: number; topics: TopicStats[] }> {
    const totalResult = await this.db
      .prepare('SELECT COUNT(*) as count FROM attempts')
      .first<{ count: number }>();

    const topicsResult = await this.db
      .prepare(`
        SELECT q.topic, COUNT(*) as total, SUM(a.correct) as correct
        FROM attempts a
        JOIN questions q ON a.question_id = q.id
        GROUP BY q.topic
      `)
      .all<{ topic: string; total: number; correct: number }>();

    return {
      totalAttempts: totalResult?.count || 0,
      topics: topicsResult.results.map((t): TopicStats => ({
        topic: t.topic,
        total: t.total,
        correct: t.correct,
        accuracy: t.total ? Math.round((t.correct / t.total) * 100) : 0,
      })),
    };
  }

  async getConfig(key: string): Promise<string | null> {
    const result = await this.db
      .prepare('SELECT value FROM config WHERE key = ?')
      .bind(key)
      .first<{ value: string }>();
    return result?.value || null;
  }

  async setConfig(key: string, value: string): Promise<void> {
    await this.db
      .prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)')
      .bind(key, value)
      .run();
  }

  async getAllConfig(): Promise<Record<string, string>> {
    const results = await this.db
      .prepare('SELECT key, value FROM config')
      .all<{ key: string; value: string }>();
    const config: Record<string, string> = {};
    for (const row of results.results) {
      config[row.key] = row.value;
    }
    return config;
  }
}
