import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MemoryManager } from "../lib/memory";
import { memorySessionSchema } from "../lib/validation";
import { getDB } from "./db";

export const saveQuizSessionToMemory = createServerFn({ method: "POST" })
  .inputValidator(memorySessionSchema)
  .handler(async (ctx) => {
    const { data } = ctx;
    const db = await getDB(ctx);
    if (!db) throw new Error("D1 database not available");

    const memory = new MemoryManager(db);
    await memory.ensureStructure();
    const path = await memory.saveQuizSession(data);

    return { saved: true, path };
  });

export const getMemoryContext = createServerFn({ method: "POST" })
  .inputValidator(z.object({ topics: z.array(z.string()) }))
  .handler(async (ctx) => {
    const { data } = ctx;
    const db = await getDB(ctx);
    if (!db) return { context: "" };

    const memory = new MemoryManager(db);
    await memory.ensureStructure();
    const context = await memory.buildMemoryPrompt(data.topics);

    return { context };
  });
