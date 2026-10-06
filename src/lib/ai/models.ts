import { createOpenAI } from "@ai-sdk/openai";

/**
 * Model choice lives here so switching providers (e.g. to Qwen via the AI Gateway, using a
 * "alibaba/qwen3.8-max" string) is a one-line change. Override with HINDSIGHT_MODEL / HINDSIGHT_FAST_MODEL.
 */
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Coaching explanations and chat. */
export const coachModel = () => openai(process.env.HINDSIGHT_MODEL ?? "gpt-6.1-sol");

/** Cheap, fast parsing (turning a trade idea into fields). */
export const fastModel = () => openai(process.env.HINDSIGHT_FAST_MODEL ?? "gpt-6-luna");

export const aiConfigured = () => Boolean(process.env.OPENAI_API_KEY);
