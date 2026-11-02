const {
    retrieveRelevantChunks,
} = require("./src/rag/retriever");

async function test() {
    console.log("=================================");
    console.log("AURA RETRIEVER TEST");
    console.log("=================================\n");

    const query =
        "How does Generative AI create new content?";

    console.log("User query:");
    console.log(query);

    console.log("\nSearching vector store...\n");

    const results =
        await retrieveRelevantChunks(query, 2);

    if (results.length === 0) {
        console.log("No relevant documents found.");

        return;
    }

    console.log(
        `Found ${results.length} relevant chunks.\n`
    );

    results.forEach((result, index) => {
        console.log(
            `--- Result ${index + 1} ---`
        );

        console.log(
            "Similarity:",
            result.similarity.toFixed(4)
        );

        console.log(
            "Source:",
            result.metadata.sourceTitle
        );

        console.log(
            "URL:",
            result.metadata.sourceUrl
        );

        console.log(
            "Text:",
            result.text
        );

        console.log();
    });

    console.log("=================================");
    console.log("RETRIEVER TEST SUCCESSFUL");
    console.log("=================================");
}

test().catch((error) => {
    console.error("\n=================================");
    console.error("RETRIEVER TEST FAILED");
    console.error("=================================\n");

    console.error(error);
});