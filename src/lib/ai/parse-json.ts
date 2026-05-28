function stripThinkBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function extractCodeFenceContent(text: string): string | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return match?.[1]?.trim() ?? null;
}

function extractFirstJsonValue(text: string): string | null {
  const startObject = text.indexOf('{');
  const startArray = text.indexOf('[');
  const starts = [startObject, startArray].filter((idx) => idx >= 0);
  if (starts.length === 0) {
    return null;
  }

  const start = Math.min(...starts);
  const open = text[start];
  const close = open === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === open) {
      depth++;
      continue;
    }

    if (ch === close) {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1).trim();
      }
    }
  }

  return null;
}

function parseCandidate(candidate: string): unknown | null {
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

export function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const withoutThink = stripThinkBlocks(trimmed);
  const fromFence = extractCodeFenceContent(withoutThink);
  const extracted = extractFirstJsonValue(withoutThink);

  const candidates = [
    trimmed,
    withoutThink,
    fromFence,
    extracted,
  ].filter((value): value is string => Boolean(value && value.trim().length > 0));

  for (const candidate of candidates) {
    const parsed = parseCandidate(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  const preview = trimmed.slice(0, 180).replace(/\s+/g, ' ');
  throw new Error(`Model output is not valid JSON. Preview: ${preview}`);
}
