import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_BATCH_SIZE = 2048;

/**
 * Read OPENAI_API_KEY from environment. Throws if missing.
 */
function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY environment variable is required for embedding generation. " +
        "Set it in your .env.local or environment."
    );
  }
  return key;
}

/**
 * Create an OpenAI client instance.
 */
function getClient(): OpenAI {
  return new OpenAI({ apiKey: getApiKey() });
}

/**
 * Generate a single embedding vector for the given text.
 * Uses OpenAI text-embedding-3-small (1536 dimensions).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const client = getClient();
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown embedding error";
    throw new Error(`Failed to generate embedding: ${message}`);
  }
}

/**
 * Generate embeddings for multiple texts in batched API calls.
 * OpenAI supports up to 2048 inputs per call.
 * Returns embeddings in the same order as input texts.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  try {
    const client = getClient();
    const allEmbeddings: number[][] = [];

    // Process in batches of MAX_BATCH_SIZE
    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE);

      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
      });

      // Sort by index to maintain order (API may return out of order)
      const sorted = response.data.sort((a, b) => a.index - b.index);
      allEmbeddings.push(...sorted.map((d) => d.embedding));
    }

    return allEmbeddings;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown embedding error";
    throw new Error(`Failed to generate embeddings: ${message}`);
  }
}
