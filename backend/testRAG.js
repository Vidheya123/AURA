const {
    searchWithRAG,
} = require("./src/rag/ragService");

async function test() {
    console.log("=================================");
    console.log("AURA FULL RAG TEST");
    console.log("=================================\n");

    const query =
        "What is Generative AI and how does it work?";

    const result =
        await searchWithRAG(query);

    console.log("\n=================================");
    console.log("RAG TEST RESULTS");
    console.log("=================================\n");

    console.log("Query:");
    console.log(result.query);

    console.log(
        "\nWeb results:",
        result.searchResults.length
    );

    console.log(
        "New chunks stored:",
        result.storedChunks
    );

    console.log(
        "Relevant chunks:",
        result.relevantChunks.length
    );

    result.relevantChunks.forEach(
        (chunk, index) => {
            console.log(
                `\n--- Relevant Chunk ${index + 1} ---`
            );

            console.log(
                "Similarity:",
                chunk.similarity.toFixed(4)
            );

            console.log(
                "Title:",
                chunk.metadata.sourceTitle
            );

            console.log(
                "URL:",
                chunk.metadata.sourceUrl
            );

            console.log(
                "Text:",
                chunk.text
            );
        }
    );

    console.log("\n=================================");
    console.log("FULL RAG TEST SUCCESSFUL");
    console.log("=================================");
}

test().catch((error) => {
    console.error("\n=================================");
    console.error("FULL RAG TEST FAILED");
    console.error("=================================\n");

    console.error(error);
});