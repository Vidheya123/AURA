const { tavily } = require("@tavily/core");

const tvly = tavily({
    apiKey: process.env.TAVILY_API_KEY,
});

async function searchWeb(query) {
    const response = await tvly.search(query, {
        searchDepth: "basic",
        maxResults: 5,
    });

    return response.results.map((result) => ({
        title: result.title,
        url: result.url,
        content: result.content,
    }));
}

module.exports = {
    searchWeb,
};