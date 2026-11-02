const {
    generateEmbedding,
} = require("./embedder");

const {
    getAllVectors,
} = require("./vectorStore");

/**
 * Calculate cosine similarity between two vectors.
 *
 * Returns a value between -1 and 1.
 *
 * Higher value = more semantically similar.
 */
function cosineSimilarity(vectorA, vectorB) {
    if (
        !Array.isArray(vectorA) ||
        !Array.isArray(vectorB)
    ) {
        throw new Error("Both inputs must be arrays.");
    }

    if (vectorA.length !== vectorB.length) {
        throw new Error(
            `Vector dimensions do not match: ${vectorA.length} vs ${vectorB.length}`
        );
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
        dotProduct += vectorA[i] * vectorB[i];

        magnitudeA += vectorA[i] * vectorA[i];

        magnitudeB += vectorB[i] * vectorB[i];
    }

    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }

    return (
        dotProduct /
        (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
    );
}

/**
 * Retrieve the most relevant stored chunks.
 */
async function retrieveRelevantChunks(
    query,
    topK = 3
) {
    if (!query || typeof query !== "string") {
        throw new Error("Query is required.");
    }

    const vectors = getAllVectors();

    if (vectors.length === 0) {
        return [];
    }

    console.log(
        `Generating embedding for query: "${query}"`
    );

    const queryEmbedding =
        await generateEmbedding(query);

    const scoredVectors = vectors.map((vector) => {
        const similarity = cosineSimilarity(
            queryEmbedding,
            vector.embedding
        );

        return {
            ...vector,
            similarity,
        };
    });

    scoredVectors.sort(
        (a, b) => b.similarity - a.similarity
    );

    return scoredVectors.slice(0, topK);
}

module.exports = {
    cosineSimilarity,
    retrieveRelevantChunks,
};