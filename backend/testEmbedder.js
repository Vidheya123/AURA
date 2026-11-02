const {
    generateEmbedding,
    generateEmbeddings,
} = require("./src/rag/embedder");

async function test() {
    console.log("=================================");
    console.log("AURA OLLAMA EMBEDDING TEST");
    console.log("=================================\n");

    const text =
        "Generative AI can create new content such as text and images.";

    console.log("Generating single embedding...\n");

    const embedding = await generateEmbedding(text);

    console.log("Text:");
    console.log(text);

    console.log("\nEmbedding dimensions:");
    console.log(embedding.length);

    console.log("\nFirst 10 values:");
    console.log(embedding.slice(0, 10));

    console.log("\n---------------------------------\n");

    const texts = [
        "Generative AI creates new content.",
        "Artificial intelligence can generate text and images.",
        "The weather is sunny today.",
    ];

    console.log("Generating multiple embeddings...\n");

    const embeddings = await generateEmbeddings(texts);

    console.log("Number of texts:");
    console.log(texts.length);

    console.log("\nNumber of embeddings:");
    console.log(embeddings.length);

    console.log("\nDimensions of first embedding:");
    console.log(embeddings[0].length);

    console.log("\n=================================");
    console.log("OLLAMA EMBEDDING TEST SUCCESSFUL");
    console.log("=================================");
}

test().catch((error) => {
    console.error("\n=================================");
    console.error("OLLAMA EMBEDDING TEST FAILED");
    console.error("=================================\n");

    console.error(error);
});