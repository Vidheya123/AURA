const express = require("express");

const {
    searchWeb,
} = require("../services/searchService");

const {
    generateAnswer,
} = require("../services/llmService");

const {
    runRAG,
} = require("../rag/ragService");

const {
    runDeepResearch,
} = require("../services/researchService");

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const {
            query,
            mode = "quick",
        } = req.body;

        // =================================================
        // VALIDATE QUERY
        // =================================================

        if (!query || query.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Search query is required",
            });
        }

        console.log("\n=================================");
        console.log("AURA REQUEST");
        console.log("=================================");
        console.log("Query:", query);
        console.log("Mode:", mode);

        // =================================================
        // DEEP RESEARCH
        // =================================================

        if (mode === "deep") {
            const research =
                await runDeepResearch(
                    query.trim()
                );

            // -------------------------------------------------
            // DEBUG: VERIFY VERIFICATION RESPONSE
            // -------------------------------------------------

            console.log(
                "\n================================="
            );

            console.log(
                "RETURNING DEEP RESEARCH RESPONSE"
            );

            console.log(
                "Verification:",
                research.verification
                    ? "AVAILABLE"
                    : "MISSING"
            );

            if (research.verification) {
                console.log(
                    "Claims checked:",
                    research.verification.claimsChecked
                );

                console.log(
                    "Supported:",
                    research.verification.supported
                );

                console.log(
                    "Partially supported:",
                    research.verification.partiallySupported
                );

                console.log(
                    "Unsupported:",
                    research.verification.unsupported
                );
            }

            console.log(
                "=================================\n"
            );

            // -------------------------------------------------
            // RETURN DEEP RESEARCH RESPONSE
            // -------------------------------------------------

            return res.json({
                success: true,

                mode: "deep",

                // User query
                query:
                    research.query,

                // AI research report
                answer:
                    research.answer,

                // Verified/retrieved sources
                sources:
                    research.sources,

                // Raw web search results
                results:
                    research.results,

                // Research planning queries
                researchQueries:
                    research.researchQueries,

                // =========================================
                // VERIFICATION AGENT
                // =========================================

                verification:
                    research.verification,

                // =========================================
                // RAG INFORMATION
                // =========================================

                rag:
                    research.rag,
            });
        }

        // =================================================
        // QUICK SEARCH
        // =================================================

        const searchResults =
            await searchWeb(
                query.trim()
            );

        console.log(
            `Tavily returned ${searchResults.length} results.`
        );

        // =================================================
        // RAG
        // =================================================

        const ragResult =
            await runRAG(
                query.trim(),
                searchResults
            );

        console.log(
            `Retrieved ${ragResult.relevantChunks.length} relevant chunks.`
        );

        // =================================================
        // GENERATE AI ANSWER
        // =================================================

        const aiAnswer =
            await generateAnswer(
                query.trim(),
                ragResult.relevantChunks
            );

        // =================================================
        // BUILD SOURCES
        // =================================================

        const sources =
            ragResult.relevantChunks.map(
                (chunk, index) => ({
                    number:
                        index + 1,

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

        console.log(
            "AI answer generated successfully."
        );

        // =================================================
        // QUICK SEARCH RESPONSE
        // =================================================

        return res.json({
            success: true,

            mode: "quick",

            query:
                query.trim(),

            answer:
                aiAnswer,

            sources,

            results:
                searchResults,

            rag: {
                storedChunks:
                    ragResult.storedChunks,

                retrievedChunks:
                    ragResult.relevantChunks
                        .length,
            },
        });

    } catch (error) {

        // =================================================
        // ERROR HANDLING
        // =================================================

        console.error(
            "\nSearch + AI error:",
            error
        );

        return res.status(500).json({
            success: false,

            message:
                "Unable to perform AI-powered search.",

            error:
                process.env.NODE_ENV ===
                "development"
                    ? error.message
                    : undefined,
        });
    }
});

module.exports = router;