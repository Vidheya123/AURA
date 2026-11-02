function chunkText(text, chunkSize = 800, overlap = 100) {
    if (!text || typeof text !== "string") {
        return [];
    }

    const cleanedText = text
        .replace(/\s+/g, " ")
        .trim();

    if (!cleanedText) {
        return [];
    }

    const chunks = [];

    let start = 0;

    while (start < cleanedText.length) {
        const end = Math.min(
            start + chunkSize,
            cleanedText.length
        );

        const chunk = cleanedText.slice(start, end).trim();

        if (chunk) {
            chunks.push(chunk);
        }

        if (end >= cleanedText.length) {
            break;
        }

        start = end - overlap;
    }

    return chunks;
}

module.exports = {
    chunkText,
};