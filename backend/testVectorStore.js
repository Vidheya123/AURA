const {
    addVector,
    addVectors,
    getAllVectors,
    getVectorCount,
    clearVectors,
} = require("./src/rag/vectorStore");

const {
    generateEmbedding,
} = require("./src/rag/embedder");

async function test() {
    console.log("=================================");
    console.log("AURA VECTOR STORE TEST");
    console.log("=================================\n");

    // Clear previous test data
    clearVectors();

    console.log("Vector store cleared.\n");

    const text1 =
        "Generative AI can create new content such as text, images, audio, and video.";

    const text2 =
        "Artificial intelligence systems can analyze large amounts of data and identify patterns.";

    console.log("Generating embedding for document 1...");

    const embedding1 = await generateEmbedding(text1);

    console.log("Embedding 1 dimensions:", embedding1.length);

    console.log("\nGenerating embedding for document 2...");

    const embedding2 = await generateEmbedding(text2);

    console.log("Embedding 2 dimensions:", embedding2.length);

    console.log("\nStoring vectors...");

    addVector({
        id: "test-document-1",
        text: text1,
        embedding: embedding1,
        sourceUrl: "https://example.com/genai",
        sourceTitle: "Generative AI Example",
        sourceNumber: 1,
    });

    addVector({
        id: "test-document-2",
        text: text2,
        embedding: embedding2,
        sourceUrl: "https://example.com/ai",
        sourceTitle: "Artificial Intelligence Example",
        sourceNumber: 2,
    });

    console.log("Vectors stored successfully.");

    console.log("\nVector count:");

    console.log(getVectorCount());

    console.log("\nStored vectors:");

    const vectors = getAllVectors();

    vectors.forEach((vector, index) => {
        console.log(`\n--- Vector ${index + 1} ---`);

        console.log("ID:", vector.id);

        console.log("Text:", vector.text);

        console.log(
            "Embedding dimensions:",
            vector.embedding.length
        );

        console.log(
            "Source:",
            vector.metadata.sourceTitle
        );

        console.log(
            "URL:",
            vector.metadata.sourceUrl
        );
    });

    console.log("\n=================================");
    console.log("VECTOR STORE TEST SUCCESSFUL");
    console.log("=================================");
}

test().catch((error) => {
    console.error("\n=================================");
    console.error("VECTOR STORE TEST FAILED");
    console.error("=================================\n");

    console.error(error);
});