import { ObsidianClient, type ObsidianConnectionConfig } from './obsidian';

const VAULT_BASE = 'study-app';

export interface QuizSessionData {
  examName: string;
  topic: string;
  totalQuestions: number;
  correctAnswers: number;
  questions: Array<{
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string;
    topic: string;
  }>;
  duration?: number;
}

export interface MemoryContext {
  profileNotes: string;
  recentSessions: string;
  topicNotes: string;
  relevantSearchResults: string;
}

export class MemoryManager {
  private obsidian: ObsidianClient;
  private vaultBase = VAULT_BASE;

  constructor(config?: Partial<ObsidianConnectionConfig>) {
    this.obsidian = new ObsidianClient(config);
  }

  private path(sub: string) {
    return `${this.vaultBase}/${sub}`;
  }

  async ensureStructure(): Promise<void> {
    const dirs = [
      'memory/sessions',
      'memory/topics',
      'questions',
      'stats',
    ];
    for (const dir of dirs) {
      try {
        await this.obsidian.listFiles(this.path(dir));
      } catch {
        await this.obsidian.writeNote(this.path(`${dir}/.keep`), '');
      }
    }
  }

  async saveQuizSession(session: QuizSessionData): Promise<string> {
    const date = new Date().toISOString().slice(0, 10);
    const slug = session.topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const fileName = `${date}-quiz-${slug}.md`;
    const filePath = this.path(`memory/sessions/${fileName}`);

    const accuracy = session.totalQuestions > 0
      ? Math.round((session.correctAnswers / session.totalQuestions) * 100)
      : 0;

    const content = `---
type: quiz-session
date: ${date}
topic: ${session.topic}
exam: ${session.examName}
total: ${session.totalQuestions}
correct: ${session.correctAnswers}
accuracy: ${accuracy}%
duration: ${session.duration ?? 'N/A'}
---

# Quiz Session: ${session.topic}

**Date:** ${date}
**Exam:** ${session.examName}
**Score:** ${session.correctAnswers}/${session.totalQuestions} (${accuracy}%)

## Questions

${session.questions.map((q, i) => `
### ${i + 1}. ${q.question}

- **Your answer:** ${q.userAnswer}
- **Correct answer:** ${q.correctAnswer}
- **Result:** ${q.isCorrect ? '✅ Correct' : '❌ Incorrect'}
- **Explanation:** ${q.explanation}
- **Topic:** ${q.topic}
`).join('\n')}

## Summary

- **Topics covered:** ${session.topic}
- **Accuracy:** ${accuracy}%
- **Total questions:** ${session.totalQuestions}
`;

    await this.obsidian.writeNote(filePath, content);

    await this.updateProfile(session);

    return filePath;
  }

  private async updateProfile(session: QuizSessionData): Promise<void> {
    const profilePath = this.path('memory/profile.md');
    let profile = '';
    try {
      profile = await this.obsidian.readNote(profilePath);
    } catch {
      profile = `---
type: learning-profile
created: ${new Date().toISOString().slice(0, 10)}
---

# Learning Profile

## Topics Studied

## Recent Activity

## Strong Areas

## Weak Areas
`;
    }

    const today = new Date().toISOString().slice(0, 10);
    const accuracy = session.totalQuestions > 0
      ? Math.round((session.correctAnswers / session.totalQuestions) * 100)
      : 0;

    const activityLine = `- ${today}: ${session.topic} - ${session.correctAnswers}/${session.totalQuestions} (${accuracy}%)`;
    const topicLine = `- [[${session.topic}]]`;

    if (!profile.includes(`- ${today}`)) {
      profile = profile.replace(
        '## Recent Activity',
        `## Recent Activity\n${activityLine}`
      );
    }

    if (!profile.includes(topicLine)) {
      profile = profile.replace(
        '## Topics Studied',
        `## Topics Studied\n${topicLine}`
      );
    }

    if (accuracy < 60 && !profile.includes(session.topic)) {
      profile = profile.replace(
        '## Weak Areas',
        `## Weak Areas\n- [[${session.topic}]]`
      );
    } else if (accuracy >= 80 && !profile.includes(session.topic)) {
      profile = profile.replace(
        '## Strong Areas',
        `## Strong Areas\n- [[${session.topic}]]`
      );
    }

    await this.obsidian.writeNote(profilePath, profile);
  }

  async saveTopicNotes(topic: string, content: string): Promise<string> {
    const slug = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const filePath = this.path(`memory/topics/${slug}.md`);

    const note = `---
type: topic-notes
topic: ${topic}
updated: ${new Date().toISOString().slice(0, 10)}
---

# ${topic}

${content}
`;

    await this.obsidian.writeNote(filePath, note);
    return filePath;
  }

  async exportQuestionsToVault(
    examName: string,
    topic: string,
    questions: Array<{
      question: string;
      options: string[];
      answer: string;
      explanation?: string;
    }>,
  ): Promise<string> {
    const slug = examName
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()
      .replace(/(^-|-$)/g, '');
    const filePath = this.path(`questions/${slug}.md`);

    const content = `---
type: question-bank
source: ${examName}
topic: ${topic}
exported: ${new Date().toISOString().slice(0, 10)}
total: ${questions.length}
---

# ${examName}

## Questions (${questions.length})

${questions.map((q, i) => `
### ${i + 1}. ${q.question}

${q.options.map((o, j) => `${String.fromCharCode(97 + j)}) ${o}`).join('\n')}

**Correct answer:** ${q.answer}
${q.explanation ? `**Explanation:** ${q.explanation}` : ''}
`).join('\n')}
`;

    await this.obsidian.writeNote(filePath, content);
    return filePath;
  }

  async getMemoryContext(topics: string[]): Promise<MemoryContext> {
    const profilePath = this.path('memory/profile.md');
    const profileNotes = await this.obsidian.readNote(profilePath).catch(() => '');

    const sessionsDir = this.path('memory/sessions');
    let recentSessions = '';
    try {
      const files = await this.obsidian.listFiles(sessionsDir);
      const recent = files.slice(-5);
      const contents = await Promise.all(
        recent.map(f => this.obsidian.readNote(this.path(`memory/sessions/${f}`)).catch(() => ''))
      );
      recentSessions = contents.filter(Boolean).join('\n\n---\n\n');
    } catch {
      recentSessions = '';
    }

    const topicNotesList = await Promise.all(
      topics.map(t => {
        const slug = t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        return this.obsidian
          .readNote(this.path(`memory/topics/${slug}.md`))
          .catch(() => '');
      })
    );
    const topicNotes = topicNotesList.filter(Boolean).join('\n\n');

    const searchQuery = topics.join(' ');
    let relevantSearchResults = '';
    if (searchQuery.trim()) {
      try {
        const results = await this.obsidian.search(searchQuery);
        relevantSearchResults = results
          .slice(0, 3)
          .map(r => `From [[${r.path}]]:\n${r.content.slice(0, 500)}`)
          .join('\n\n');
      } catch {
        relevantSearchResults = '';
      }
    }

    return { profileNotes, recentSessions, topicNotes, relevantSearchResults };
  }

  async buildMemoryPrompt(topics: string[]): Promise<string> {
    const ctx = await this.getMemoryContext(topics);
    const parts: string[] = [];

    if (ctx.profileNotes) {
      parts.push(`<user_profile>\n${ctx.profileNotes.slice(0, 1000)}\n</user_profile>`);
    }

    if (ctx.recentSessions) {
      parts.push(`<recent_sessions>\n${ctx.recentSessions.slice(0, 2000)}\n</recent_sessions>`);
    }

    if (ctx.topicNotes) {
      parts.push(`<topic_notes>\n${ctx.topicNotes.slice(0, 2000)}\n</topic_notes>`);
    }

    if (ctx.relevantSearchResults) {
      parts.push(`<vault_search>\n${ctx.relevantSearchResults.slice(0, 2000)}\n</vault_search>`);
    }

    return parts.join('\n\n');
  }

  async saveStatsToVault(stats: {
    totalAttempts: number;
    topics: Array<{ topic: string; total: number; correct: number; accuracy: number }>;
  }): Promise<string> {
    const date = new Date().toISOString().slice(0, 10);
    const filePath = this.path(`stats/progresso-geral.md`);

    const content = `---
type: stats-snapshot
date: ${date}
totalAttempts: ${stats.totalAttempts}
topics: ${stats.topics.length}
---

# Progresso Geral

**Última atualização:** ${date}
**Total de tentativas:** ${stats.totalAttempts}

## Desempenho por Tópico

| Tópico | Tentativas | Acertos | Aproveitamento |
|--------|-----------|---------|---------------|
${stats.topics.map(t => `| ${t.topic} | ${t.total} | ${t.correct} | ${t.accuracy}% |`).join('\n')}

## Resumo

- **Tópicos estudados:** ${stats.topics.length}
- **Média geral:** ${stats.totalAttempts > 0 ? Math.round(stats.topics.reduce((a, t) => a + t.correct, 0) / stats.totalAttempts * 100) : 0}%
`;

    await this.obsidian.writeNote(filePath, content);
    return filePath;
  }
}

export function createMemoryManager(config?: Partial<ObsidianConnectionConfig>) {
  return new MemoryManager(config);
}
