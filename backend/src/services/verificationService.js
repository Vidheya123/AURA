const Groq = require("groq-sdk");

const client = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

/**
 * Extract atomic factual claims from the
 * AI-generated research report.
 *
 * This uses Groq instead of simple line-based
 * extraction so headings, table headers,
 * formatting, and section labels are ignored.
 */
async function extractClaims(answer) {
    if (!answer || typeof answer !== "string") {
        return [];
    }

    const prompt = `
You are AURA's Claim Extraction Agent.

Your task is to extract ONLY meaningful factual
claims from the following AI-generated research report.

A factual claim is a statement that can be checked
against a source.

IMPORTANT RULES:

1. Do NOT extract headings.
2. Do NOT extract section titles.
3. Do NOT extract table headers.
4. Do NOT extract table separator rows.
5. Do NOT extract introductory phrases that contain
   no factual information.
6. Do NOT extract conclusions that merely repeat
   headings.
7. Split combined statements into separate atomic
   claims when appropriate.
8. Preserve the meaning of the original statement.
9. Remove Markdown formatting such as **bold**.
10. Preserve citation numbers such as [1], [2], [3].
11. Do NOT invent citations.
12. Do NOT add information that is not present
    in the research report.
13. Prefer concise factual statements.
14. Extract claims from paragraphs, bullet lists,
    numbered lists, and Markdown tables.
15. Do not extract more than 20 claims.
16. If a sentence contains multiple independent
    factual assertions, split them into separate
    claims when possible.

Example:

BAD:
"Advantages of Generative AI"

GOOD:
"Generative AI can improve productivity by
automating repetitive tasks. [1]"

BAD:
"Job displacement and economic impact"

GOOD:
"Generative AI automation may reduce demand
for certain roles. [1]"

Return ONLY valid JSON.

Required format:

{
  "claims": [
    {
      "id": 1,
      "claim": "Generative AI can improve productivity by automating repetitive tasks. [1]",
      "sources": [1]
    }
  ]
}

Research Report:

${answer}
`;

    try {
        const response =
            await client.chat.completions.create({
                model: "openai/gpt-oss-20b",

                messages: [
                    {
                        role: "system",
                        content:
                            "You are AURA's claim extraction agent. Return only valid JSON.",
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],

                temperature: 0,

                response_format: {
                    type: "json_object",
                },
            });

        const raw =
            response.choices[0]?.message?.content?.trim();

        if (!raw) {
            throw new Error(
                "Claim extraction agent returned an empty response."
            );
        }

        const parsed = JSON.parse(raw);

        if (
            !parsed ||
            !Array.isArray(parsed.claims)
        ) {
            throw new Error(
                "Invalid claim extraction response."
            );
        }

        const claims = parsed.claims
            .filter(
                (item) =>
                    item &&
                    typeof item.claim === "string" &&
                    item.claim.trim()
            )
            .slice(0, 20)
            .map((item, index) => {
                const claimText =
                    item.claim
                        .replace(/\*\*/g, "")
                        .replace(/\s+/g, " ")
                        .trim();

                /*
                 * Prefer source numbers explicitly
                 * returned by the extraction agent.
                 *
                 * If they are missing, recover them
                 * from [1], [2], [3] in the claim.
                 */
                let sources = [];

                if (
                    Array.isArray(item.sources)
                ) {
                    sources = item.sources
                        .map(Number)
                        .filter(
                            (number) =>
                                Number.isInteger(
                                    number
                                )
                        );
                }

                if (sources.length === 0) {
                    const matches = [
                        ...claimText.matchAll(
                            /\[(\d+)\]/g
                        ),
                    ];

                    sources = [
                        ...new Set(
                            matches.map(
                                (match) =>
                                    Number(
                                        match[1]
                                    )
                            )
                        ),
                    ];
                }

                return {
                    id: index + 1,
                    claim: claimText,
                    sources,
                };
            })
            .filter(
                (item) =>
                    item.claim.length >= 25
            );

        return claims;
    } catch (error) {
        console.error(
            "Claim extraction error:",
            error.message
        );

        throw new Error(
            "Unable to extract research claims."
        );
    }
}

/**
 * Build evidence context from the retrieved RAG chunks.
 */
function buildEvidenceContext(relevantChunks) {
    if (
        !Array.isArray(relevantChunks) ||
        relevantChunks.length === 0
    ) {
        return "";
    }

    return relevantChunks
        .map((chunk, index) => {
            return `
SOURCE ${index + 1}

Title:
${chunk.metadata?.sourceTitle || "Unknown Source"}

URL:
${chunk.metadata?.sourceUrl || "Unknown URL"}

Evidence:
${chunk.text || ""}
`;
        })
        .join(
            "\n-------------------------\n"
        );
}

/**
 * Verify one batch of claims.
 *
 * Small batches reduce the possibility of
 * incomplete JSON responses from the LLM.
 */
async function verifyClaimBatch(
    query,
    claims,
    evidence
) {
    const prompt = `
You are AURA's Verification Agent.

Verify the following factual claims against ONLY
the supplied research evidence.

Do NOT use outside knowledge.

Do NOT assume that a citation automatically means
the claim is supported.

STATUS DEFINITIONS:

SUPPORTED:
The evidence directly supports the claim.

PARTIALLY_SUPPORTED:
The evidence supports only part of the claim,
or the claim is stronger or broader than the evidence.

UNSUPPORTED:
The supplied evidence does not support the claim.

Be conservative.

Research Question:
${query}

Claims:

${JSON.stringify(claims, null, 2)}

Evidence:

${evidence}

Return ONLY a JSON object in this exact structure:

{
  "claims": [
    {
      "id": 1,
      "claim": "original claim",
      "status": "SUPPORTED",
      "confidence": 0.95,
      "evidence": "Short explanation.",
      "sources": [1]
    }
  ]
}

Rules:

- Verify every supplied claim.
- Preserve each claim's id.
- Preserve the claim wording as closely as possible.
- Allowed status values are:
  SUPPORTED
  PARTIALLY_SUPPORTED
  UNSUPPORTED
- confidence must be a number from 0 to 1.
- sources must contain source numbers actually used.
- Do not invent sources.
- Do not add claims.
- Do not omit claims.
- Do not use markdown.
`;

    const response =
        await client.chat.completions.create({
            model: "openai/gpt-oss-20b",

            messages: [
                {
                    role: "system",
                    content:
                        "You are AURA's factual verification agent. Return only valid JSON.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],

            temperature: 0,

            response_format: {
                type: "json_object",
            },
        });

    const raw =
        response.choices[0]?.message?.content?.trim();

    if (!raw) {
        throw new Error(
            "Verification agent returned an empty response."
        );
    }

    let parsed;

    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        console.error(
            "Verification batch JSON parsing error:",
            error.message
        );

        console.error(
            "Raw verification batch:",
            raw
        );

        throw new Error(
            "Unable to parse verification batch."
        );
    }

    if (
        !parsed ||
        !Array.isArray(parsed.claims)
    ) {
        throw new Error(
            "Invalid verification batch structure."
        );
    }

    return parsed.claims;
}

/**
 * Verify the complete research report.
 */
async function verifyResearchReport(
    query,
    answer,
    relevantChunks
) {
    console.log("\n=================================");
    console.log("AURA VERIFICATION AGENT");
    console.log("=================================\n");

    if (!query || !query.trim()) {
        throw new Error(
            "Query is required for verification."
        );
    }

    if (!answer || !answer.trim()) {
        return {
            status: "not_verified",
            claimsChecked: 0,
            supported: 0,
            partiallySupported: 0,
            unsupported: 0,
            claims: [],
        };
    }

    if (
        !Array.isArray(relevantChunks) ||
        relevantChunks.length === 0
    ) {
        return {
            status: "not_verified",
            claimsChecked: 0,
            supported: 0,
            partiallySupported: 0,
            unsupported: 0,
            claims: [],
        };
    }

    // -----------------------------------------
    // 1. Extract atomic claims
    // -----------------------------------------

    console.log(
        "Extracting atomic claims from research report..."
    );

    const claims =
        await extractClaims(answer);

    console.log(
        `Claims extracted: ${claims.length}`
    );

    if (claims.length === 0) {
        return {
            status: "not_verified",
            claimsChecked: 0,
            supported: 0,
            partiallySupported: 0,
            unsupported: 0,
            claims: [],
        };
    }

    // -----------------------------------------
    // 2. Build evidence
    // -----------------------------------------

    console.log(
        "Building verification evidence..."
    );

    const evidence =
        buildEvidenceContext(
            relevantChunks
        );

    // -----------------------------------------
    // 3. Verify claims in batches
    // -----------------------------------------

    const BATCH_SIZE = 4;

    const verifiedClaims = [];

    for (
        let i = 0;
        i < claims.length;
        i += BATCH_SIZE
    ) {
        const batch =
            claims.slice(
                i,
                i + BATCH_SIZE
            );

        console.log(
            `\nVerifying claims ${i + 1}-${Math.min(
                i + BATCH_SIZE,
                claims.length
            )}...`
        );

        try {
            const batchResults =
                await verifyClaimBatch(
                    query,
                    batch,
                    evidence
                );

            verifiedClaims.push(
                ...batchResults
            );

            console.log(
                "Verified batch successfully."
            );
        } catch (error) {
            console.error(
                "Verification batch failed:",
                error.message
            );

            /*
             * Preserve the claims if a batch fails.
             * They will be marked as needing review.
             */

            for (const claim of batch) {
                verifiedClaims.push({
                    id: claim.id,

                    claim: claim.claim,

                    status:
                        "UNSUPPORTED",

                    confidence: 0,

                    evidence:
                        "Verification could not be completed for this claim.",

                    sources:
                        claim.sources || [],
                });
            }
        }
    }

    // -----------------------------------------
    // 4. Normalize verification results
    // -----------------------------------------

    const normalizedClaims =
        claims.map((originalClaim) => {
            const result =
                verifiedClaims.find(
                    (item) =>
                        Number(item.id) ===
                        Number(originalClaim.id)
                );

            if (!result) {
                return {
                    id: originalClaim.id,

                    claim:
                        originalClaim.claim,

                    status:
                        "UNSUPPORTED",

                    confidence: 0,

                    evidence:
                        "No verification result was returned.",

                    sources:
                        originalClaim.sources || [],
                };
            }

            const allowedStatuses = [
                "SUPPORTED",
                "PARTIALLY_SUPPORTED",
                "UNSUPPORTED",
            ];

            const status =
                allowedStatuses.includes(
                    result.status
                )
                    ? result.status
                    : "UNSUPPORTED";

            let confidence =
                Number(
                    result.confidence
                );

            if (
                Number.isNaN(confidence)
            ) {
                confidence = 0;
            }

            confidence = Math.max(
                0,
                Math.min(
                    1,
                    confidence
                )
            );

            return {
                id: originalClaim.id,

                claim:
                    result.claim ||
                    originalClaim.claim,

                status,

                confidence:
                    Number(
                        confidence.toFixed(2)
                    ),

                evidence:
                    result.evidence ||
                    "No verification explanation provided.",

                sources:
                    Array.isArray(
                        result.sources
                    )
                        ? result.sources
                            .map(Number)
                            .filter(
                                (number) =>
                                    Number.isInteger(
                                        number
                                    )
                            )
                        : originalClaim.sources,
            };
        });

    // -----------------------------------------
    // 5. Calculate verification summary
    // -----------------------------------------

    const supported =
        normalizedClaims.filter(
            (claim) =>
                claim.status ===
                "SUPPORTED"
        ).length;

    const partiallySupported =
        normalizedClaims.filter(
            (claim) =>
                claim.status ===
                "PARTIALLY_SUPPORTED"
        ).length;

    const unsupported =
        normalizedClaims.filter(
            (claim) =>
                claim.status ===
                "UNSUPPORTED"
        ).length;

    let status = "verified";

    if (unsupported > 0) {
        status = "needs_review";
    }

    if (
        supported === 0 &&
        partiallySupported === 0 &&
        unsupported > 0
    ) {
        status = "unverified";
    }

    // -----------------------------------------
    // 6. Verification logging
    // -----------------------------------------

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
        `Claims checked: ${normalizedClaims.length}`
    );

    console.log(
        `Supported: ${supported}`
    );

    console.log(
        `Partially supported: ${partiallySupported}`
    );

    console.log(
        `Unsupported: ${unsupported}`
    );

    // -----------------------------------------
    // 7. Return verification result
    // -----------------------------------------

    return {
        status,

        claimsChecked:
            normalizedClaims.length,

        supported,

        partiallySupported,

        unsupported,

        claims:
            normalizedClaims,
    };
}

module.exports = {
    verifyResearchReport,
    extractClaims,
    buildEvidenceContext,
};