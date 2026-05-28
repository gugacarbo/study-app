import { describe, expect, it } from "vitest";
import { parseJsonFromModelText } from "#/lib/ai/parse-json";

describe("parseJsonFromModelText", () => {
  const expected = { questions: [], topics: [] };

  it("parses plain JSON object", () => {
    const parsed = parseJsonFromModelText('{"questions":[],"topics":[]}');
    expect(parsed).toEqual(expected);
  });

  it("parses JSON after think block", () => {
    const parsed = parseJsonFromModelText(
      '<think>Let me reason first</think>{"questions":[],"topics":[]}',
    );
    expect(parsed).toEqual(expected);
  });

  it("parses JSON inside markdown fence", () => {
    const parsed = parseJsonFromModelText(
      '```json\n{"questions":[],"topics":[]}\n```',
    );
    expect(parsed).toEqual(expected);
  });

  it("parses first JSON value from mixed text", () => {
    const parsed = parseJsonFromModelText(
      'Here is the result:\n{"questions":[],"topics":[]}\nThanks.',
    );
    expect(parsed).toEqual(expected);
  });

  it("throws when no JSON exists", () => {
    expect(() => parseJsonFromModelText("not json")).toThrow(
      /not valid JSON/i,
    );
  });
});
