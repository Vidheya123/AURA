const { searchWeb } = require("../services/searchService");
const { chunkText } = require("./chunker");
const { generateEmbeddings } = require("./embedder");
const {
    addVectors,
    getAllVectors,
} = require("./vectorStore");
const {
    retrieveRelevantChunks,
} = require("./retriever");

/**
 * Process Tavily search results and store
 * their chunks + embeddings in the vector store.
 */
async function ingestSearchResults(results) {
    if (!Array.isArray(results) || results.length === 0) {
        return 0;
    }

    const existingVectors = getAllVectors();

    // URLs already stored in the vector database
    const existingUrls = new Set(
        existingVectors
            .map((vector) => vector.metadata?.sourceUrl)
            .filter(Boolean)
    );

    const documents = [];

    results.forEach((result, resultIndex) => {
        if (!result.content || !result.url) {
            return;
        }

        // Don't repeatedly ingest the same URL
        if (existingUrls.has(result.url)) {
            return;
        }

        const chunks = chunkText(result.content, 800, 100);

        chunks.forEach((chunk, chunkIndex) => {
            documents.push({
                text: chunk,
                sourceUrl: result.url,
                sourceTitle: result.title,
                sourceNumber: resultIndex + 1,
                chunkIndex,
            });
        });
    });

    if (documents.length === 0) {
        return 0;
    }

    console.log(
        `Creating embeddings for ${documents.length} chunks...`
    );

    const embeddings = await generateEmbeddings(
        documents.map((document) => document.text)
    );

    const vectors = documents.map((document, index) => ({
        id: `${Date.now()}-${index}-${Math.random()
            .toString(36)
            .substring(2, 8)}`,

        text: document.text,

        embedding: embeddings[index],

        sourceUrl: document.sourceUrl,

        sourceTitle: document.sourceTitle,

        sourceNumber: document.sourceNumber,

        chunkIndex: document.chunkIndex,
    }));

    addVectors(vectors);

    console.log(
        `Stored ${vectors.length} new chunks in vector store.`
    );

    return vectors.length;
}

/**
 * Run the complete RAG retrieval pipeline.
 */
async function runRAG(query, searchResults) {
    console.log("\n=================================");
    console.log("AURA RAG PIPELINE");
    console.log("=================================\n");

    // Step 1: Ingest new web results
    const storedChunks =
        await ingestSearchResults(searchResults);

    console.log(
        `New chunks stored: ${storedChunks}`
    );

    // Step 2: Retrieve relevant chunks
    const relevantChunks =
        await retrieveRelevantChunks(query, 3);

    console.log(
        `Relevant chunks retrieved: ${relevantChunks.length}`
    );

    return {
        relevantChunks,
        storedChunks,
    };
}

/**
 * Search the web and then run RAG.
 */
async function searchWithRAG(query) {
    console.log(`\nAURA RAG search: ${query}`);

    // Search web using Tavily
    const searchResults =
        await searchWeb(query);

    // Run ingestion + retrieval
    const ragResult =
        await runRAG(query, searchResults);

    return {
        query,
        searchResults,
        relevantChunks:
            ragResult.relevantChunks,
        storedChunks:
            ragResult.storedChunks,
    };
}

module.exports = {
    ingestSearchResults,
    runRAG,
    searchWithRAG,
};