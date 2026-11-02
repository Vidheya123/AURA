const Groq = require("groq-sdk");

const { searchWeb } = require("./searchService");
const { runRAG } = require("../rag/ragService");
const { generateAnswer } = require("./llmService");
const {
    verifyResearchReport,
} = require("./verificationService");

const client = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

/**
 * Create research sub-queries from the user's question.
 */
async function createResearchPlan(query) {
    const prompt = `
You are AURA's research planning agent.

The user wants to research:

"${query}"

Create exactly 3 focused research queries.

Each query should investigate a different aspect of the topic.

Return ONLY a valid JSON array of strings.

Example:
[
  "first research query",
  "second research query",
  "third research query"
]
`;

    const response =
        await client.chat.completions.create({
            model: "openai/gpt-oss-20b",

            messages: [
                {
                    role: "system",
                    content:
                        "You are a research planning assistant. Return only valid JSON.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],

            temperature: 0.2,
        });

    const text =
        response.choices[0]?.message?.content?.trim();

    if (!text) {
        throw new Error(
            "Research planner returned an empty response."
        );
    }

    try {
        const cleaned = text
            .replace(/^```json/i, "")
            .replace(/^```/i, "")
            .replace(/```$/i, "")
            .trim();

        const queries = JSON.parse(cleaned);

        if (
            !Array.isArray(queries) ||
            queries.length === 0
        ) {
            throw new Error(
                "Invalid research plan."
            );
        }

        return queries
            .filter(
                (item) =>
                    typeof item === "string" &&
                    item.trim()
            )
            .slice(0, 3);
    } catch (error) {
        console.error(
            "Research plan parsing error:",
            error
        );

        throw new Error(
            "Unable to create research plan."
        );
    }
}

/**
 * Perform multiple web searches and combine
 * the results.
 */
async function performResearchSearches(
    researchQueries
) {
    const allResults =
        await Promise.all(
            researchQueries.map(
                async (researchQuery) => {
                    console.log(
                        `Research search: ${researchQuery}`
                    );

                    try {
                        return await searchWeb(
                            researchQuery
                        );
                    } catch (error) {
                        console.error(
                            `Search failed for: ${researchQuery}`,
                            error.message
                        );

                        return [];
                    }
                }
            )
        );

    const combinedResults =
        allResults.flat();

    // Remove duplicate URLs
    const uniqueResults = [];
    const seenUrls = new Set();

    for (const result of combinedResults) {
        if (
            result.url &&
            !seenUrls.has(result.url)
        ) {
            seenUrls.add(result.url);
            uniqueResults.push(result);
        }
    }

    return uniqueResults;
}

/**
 * Complete Deep Research pipeline.
 */
async function runDeepResearch(query) {
    console.log("\n=================================");
    console.log("AURA DEEP RESEARCH");
    console.log("=================================\n");

    // -----------------------------------------
    // 1. Create research plan
    // -----------------------------------------

    console.log(
        "Creating research plan..."
    );

    const researchQueries =
        await createResearchPlan(query);

    console.log(
        "\nResearch queries:"
    );

    researchQueries.forEach(
        (researchQuery, index) => {
            console.log(
                `${index + 1}. ${researchQuery}`
            );
        }
    );

    // -----------------------------------------
    // 2. Search each research query
    // -----------------------------------------

    console.log(
        "\nSearching multiple sources..."
    );

    const searchResults =
        await performResearchSearches(
            researchQueries
        );

    console.log(
        `\nUnique web results: ${searchResults.length}`
    );

    // -----------------------------------------
    // 3. Run RAG
    // -----------------------------------------

    console.log(
        "\nRunning RAG over research results..."
    );

    const ragResult =
        await runRAG(
            query,
            searchResults
        );

    console.log(
        `Retrieved ${ragResult.relevantChunks.length} relevant chunks.`
    );

    // -----------------------------------------
    // 4. Generate final research answer
    // -----------------------------------------

    console.log(
        "\nGenerating research report..."
    );

    const answer =
        await generateAnswer(
            query,
            ragResult.relevantChunks
        );

    console.log(
        "Research report generated successfully."
    );

    // -----------------------------------------
    // 5. Verify research report
    // -----------------------------------------

    console.log(
        "\nStarting Verification Agent..."
    );

    let verification;

    try {
        verification =
            await verifyResearchReport(
                query,
                answer,
                ragResult.relevantChunks
            );

        console.log(
            "\n================================="
        );

        console.log(
            "VERIFICATION COMPLETE"
        );

        console.log(
            "================================="
        );

        console.log(
            `Claims checked: ${verification.claimsChecked}`
        );

        console.log(
            `Supported: ${verification.supported}`
        );

        console.log(
            `Partially supported: ${verification.partiallySupported}`
        );

        console.log(
            `Unsupported: ${verification.unsupported}`
        );

        console.log(
            "Verification completed successfully."
        );
    } catch (error) {
        console.error(
            "Verification Agent failed:",
            error.message
        );

        /*
         * Verification is an additional layer.
         * If verification fails, the original
         * research report should still be returned.
         */

        verification = {
            status: "verification_failed",

            claimsChecked: 0,

            supported: 0,

            partiallySupported: 0,

            unsupported: 0,

            claims: [],

            error:
                "Verification could not be completed.",
        };
    }

    // -----------------------------------------
    // 6. Build sources
    // -----------------------------------------

    const sources =
        ragResult.relevantChunks.map(
            (chunk, index) => ({
                number: index + 1,

                title:
                    chunk.metadata?.sourceTitle ||
                    "Unknown Source",

                url:
                    chunk.metadata?.sourceUrl ||
                    "",

                similarity:
                    Number(
                        chunk.similarity?.toFixed(4) ||
                        0
                    ),
            })
        );

    // -----------------------------------------
    // 7. Return complete research response
    // -----------------------------------------

    return {
        query,

        researchQueries,

        answer,

        // IMPORTANT:
        // Verification results are returned
        // to the route so the frontend can use them.
        verification,

        sources,

        results: searchResults,

        rag: {
            storedChunks:
                ragResult.storedChunks,

            retrievedChunks:
                ragResult.relevantChunks.length,
        },
    };
}

module.exports = {
    createResearchPlan,
    performResearchSearches,
    runDeepResearch,
};