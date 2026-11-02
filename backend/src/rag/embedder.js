const ollama = require("ollama").default;

const EMBEDDING_MODEL = "nomic-embed-text";

/**
 * Generate an embedding for a single piece of text.
 */
async function generateEmbedding(text) {
    if (!text || typeof text !== "string") {
        throw new Error("Text is required for embedding.");
    }

    const response = await ollama.embed({
        model: EMBEDDING_MODEL,
        input: text,
    });

    if (!response.embeddings || !response.embeddings[0]) {
        throw new Error("Ollama returned no embedding.");
    }

    return response.embeddings[0];
}

/**
 * Generate embeddings for multiple pieces of text.
 */
async function generateEmbeddings(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
        return [];
    }

    const response = await ollama.embed({
        model: EMBEDDING_MODEL,
        input: texts,
    });

    if (!response.embeddings) {
        throw new Error("Ollama returned no embeddings.");
    }

    return response.embeddings;
}

module.exports = {
    generateEmbedding,
    generateEmbeddings,
};