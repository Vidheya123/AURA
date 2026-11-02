const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../../data");
const VECTOR_FILE = path.join(DATA_DIR, "vectors.json");

/**
 * Make sure the data directory and vector file exist.
 */
function initializeStore() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(VECTOR_FILE)) {
        fs.writeFileSync(
            VECTOR_FILE,
            JSON.stringify([], null, 2),
            "utf-8"
        );
    }
}

/**
 * Load all stored vectors.
 */
function loadVectors() {
    initializeStore();

    try {
        const data = fs.readFileSync(VECTOR_FILE, "utf-8");

        if (!data.trim()) {
            return [];
        }

        return JSON.parse(data);
    } catch (error) {
        console.error("Error loading vector store:", error);
        return [];
    }
}

/**
 * Save vectors to disk.
 */
function saveVectors(vectors) {
    initializeStore();

    fs.writeFileSync(
        VECTOR_FILE,
        JSON.stringify(vectors, null, 2),
        "utf-8"
    );
}

/**
 * Add a document chunk and its embedding.
 */
function addVector({
    id,
    text,
    embedding,
    sourceUrl,
    sourceTitle,
    sourceNumber,
}) {
    if (!text) {
        throw new Error("Text is required.");
    }

    if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("Valid embedding is required.");
    }

    const vectors = loadVectors();

    const vector = {
        id:
            id ||
            `${Date.now()}-${Math.random()
                .toString(36)
                .substring(2, 9)}`,

        text,

        embedding,

        metadata: {
            sourceUrl: sourceUrl || "",
            sourceTitle: sourceTitle || "",
            sourceNumber: sourceNumber || null,
        },

        createdAt: new Date().toISOString(),
    };

    vectors.push(vector);

    saveVectors(vectors);

    return vector;
}

/**
 * Add multiple vectors at once.
 */
function addVectors(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }

    const vectors = loadVectors();

    const newVectors = items.map((item, index) => ({
        id:
            item.id ||
            `${Date.now()}-${index}-${Math.random()
                .toString(36)
                .substring(2, 9)}`,

        text: item.text,

        embedding: item.embedding,

        metadata: {
            sourceUrl: item.sourceUrl || "",
            sourceTitle: item.sourceTitle || "",
            sourceNumber: item.sourceNumber || null,
        },

        createdAt: new Date().toISOString(),
    }));

    vectors.push(...newVectors);

    saveVectors(vectors);

    return newVectors;
}

/**
 * Get all vectors.
 */
function getAllVectors() {
    return loadVectors();
}

/**
 * Delete all stored vectors.
 *
 * Useful while testing.
 */
function clearVectors() {
    saveVectors([]);
}

/**
 * Get the number of stored vectors.
 */
function getVectorCount() {
    return loadVectors().length;
}

module.exports = {
    addVector,
    addVectors,
    getAllVectors,
    clearVectors,
    getVectorCount,
};