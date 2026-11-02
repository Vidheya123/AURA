const { chunkText } = require("./src/rag/chunker");

const text = `
Generative AI is a category of artificial intelligence
that can generate new content. It can produce text,
images, audio, video and software code. Modern models
learn patterns from large datasets and generate new
outputs based on those learned patterns.
`;

const chunks = chunkText(text, 100, 20);

console.log("Number of chunks:", chunks.length);

chunks.forEach((chunk, index) => {
    console.log(`\n--- Chunk ${index + 1} ---`);
    console.log(chunk);
});