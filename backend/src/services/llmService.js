const Groq = require("groq-sdk");

const client = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

/**
 * Generate an AI answer using retrieved RAG context.
 */
async function generateAnswer(query, relevantChunks) {
    if (!query || !query.trim()) {
        throw new Error("Query is required.");
    }

    if (
        !Array.isArray(relevantChunks) ||
        relevantChunks.length === 0
    ) {
        return "I could not find enough relevant information to answer this question.";
    }

    const context = relevantChunks
        .map((chunk, index) => {
            return `
SOURCE ${index + 1}
Title: ${chunk.metadata?.sourceTitle || "Unknown"}
URL: ${chunk.metadata?.sourceUrl || "Unknown"}

Content:
${chunk.text}
`;
        })
        .join("\n-------------------------\n");

    const prompt = `
You are AURA, an AI-powered research and answer engine.

Answer the user's question using ONLY the research context provided below.

User Question:
${query}

Research Context:
${context}

Instructions:
1. Give a clear and accurate answer.
2. Do not invent facts that are not supported by the research context.
3. Synthesize information from multiple sources when appropriate.
4. Keep the answer concise but useful.
5. Add source references in the format [1], [2], [3].
6. Only cite a source when the information actually comes from that source.
7. If the research context does not contain enough information, clearly say so.

Answer:
`;

    const response =
        await client.chat.completions.create({
            model: "openai/gpt-oss-20b",

            messages: [
                {
                    role: "system",
                    content:
                        "You are AURA, a factual AI research assistant.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],

            temperature: 0.2,
        });

    return (
        response.choices[0]?.message?.content ||
        "Unable to generate an AI answer."
    );
}

module.exports = {
    generateAnswer,
};