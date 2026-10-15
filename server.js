require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;


// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());
app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ============================================================
// SUPABASE CONNECTION
// ============================================================

const supabaseUrl =
    process.env.SUPABASE_URL;

const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;


if (
    !supabaseUrl ||
    !supabaseServiceRoleKey
) {

    console.error(
        "Missing Supabase environment variables."
    );

    process.exit(1);
}


const supabase =
    createClient(
        supabaseUrl,
        supabaseServiceRoleKey,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        }
    );


// ============================================================
// CAMIS TABLE CONFIGURATION
// ============================================================

const CAMIS_TABLES = [

    "Table 1 (JAN - FEB)",

    "Table 2 (MAR - APR)",

    "Table 3 (MAY - JUN)",

    "Table 4 (JUL - AUG)",

    "Table 5 (SEP - OCT)"

];


// ============================================================
// APPROVED PERMANENT CATEGORIES
// ============================================================

const APPROVED_CATEGORIES = [

    "Malicious Content",

    "Pornographic Content",

    "Illicit Content",

    "Suspected AI-Generated Content",

    "Impersonation",

    "Harassment / Cyberbullying",

    "Scam / Fraud",

    "False or Misleading Content",

    "Threatening / Abusive Content",

    "Other Harmful Content"

];


// ============================================================
// HELPER FUNCTIONS
// ============================================================


// ------------------------------------------------------------
// Optional non-negative whole number
// ------------------------------------------------------------

function optionalNumber(value) {

    if (
        value === "" ||
        value === null ||
        value === undefined
    ) {
        return null;
    }


    const number =
        Number(value);


    if (
        !Number.isFinite(number) ||
        number < 0
    ) {
        return null;
    }


    return Math.trunc(number);
}


// ------------------------------------------------------------
// Validate public HTTP/HTTPS URL
// ------------------------------------------------------------

function isValidPublicUrl(value) {

    try {

        const url =
            new URL(value);


        return [
            "http:",
            "https:"
        ].includes(
            url.protocol
        );

    } catch {

        return false;
    }
}


// ------------------------------------------------------------
// Validate Facebook URL
// ------------------------------------------------------------

function isFacebookUrl(value) {

    try {

        const url =
            new URL(value);


        if (
            ![
                "http:",
                "https:"
            ].includes(url.protocol)
        ) {
            return false;
        }


        return (
            url.hostname === "facebook.com" ||
            url.hostname === "www.facebook.com"
        );

    } catch {

        return false;
    }
}


// ------------------------------------------------------------
// Normalize Facebook post URL for persistent duplicate recognition
// ------------------------------------------------------------

function normalizeFacebookPostUrl(value) {
    try {
        const url = new URL(value);

        if (
            url.hostname !== "facebook.com" &&
            url.hostname !== "www.facebook.com"
        ) {
            return String(value || "").trim();
        }

        url.protocol = "https:";
        url.hostname = "www.facebook.com";
        url.hash = "";

        [
            "s",
            "mibextid",
            "ref",
            "refsrc",
            "__tn__",
            "__cft__"
        ].forEach(key => url.searchParams.delete(key));

        // Facebook photo identity is the fbid. "set" and group context
        // can vary while still pointing to the same underlying photo/post.
        if (
            url.pathname === "/photo/" &&
            url.searchParams.get("fbid")
        ) {
            return (
                "https://www.facebook.com/photo/?fbid=" +
                url.searchParams.get("fbid")
            );
        }

        let pathname =
            url.pathname.replace(/\/+$/, "");

        if (!pathname) {
            pathname = "/";
        }

        const query =
            url.searchParams.toString();

        return (
            `https://www.facebook.com${pathname}` +
            (query ? `?${query}` : "")
        );

    } catch {
        return String(value || "").trim();
    }
}


// ------------------------------------------------------------
// Determine permanent table from Original Post Date
// ------------------------------------------------------------

function determineCollectionTable(
    originalPostDate
) {

    const match =
        /^(\d{4})-(\d{2})-(\d{2})$/
            .exec(originalPostDate);


    if (!match) {

        return {
            valid: false,
            message:
                "Invalid original post date."
        };
    }


    const year =
        Number(match[1]);

    const month =
        Number(match[2]);

    const day =
        Number(match[3]);


    const date =
        new Date(
            Date.UTC(
                year,
                month - 1,
                day
            )
        );


    const validDate =
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;


    if (!validDate) {

        return {
            valid: false,
            message:
                "Invalid original post date."
        };
    }


    // Current CAMIS research scope:
    // January 2026 through October 2026

    if (
        year !== 2026 ||
        month < 1 ||
        month > 10
    ) {

        return {
            valid: false,
            message:
                "Original post date must be between January and October 2026."
        };
    }


    let tableName;


    if (
        month >= 1 &&
        month <= 2
    ) {

        tableName =
            "Table 1 (JAN - FEB)";

    } else if (
        month >= 3 &&
        month <= 4
    ) {

        tableName =
            "Table 2 (MAR - APR)";

    } else if (
        month >= 5 &&
        month <= 6
    ) {

        tableName =
            "Table 3 (MAY - JUN)";

    } else if (
        month >= 7 &&
        month <= 8
    ) {

        tableName =
            "Table 4 (JUL - AUG)";

    } else {

        tableName =
            "Table 5 (SEP - OCT)";
    }


    return {
        valid: true,
        tableName
    };
}


// ------------------------------------------------------------
// Check whether URL already exists in permanent records
// ------------------------------------------------------------

async function findPermanentDuplicate(postUrl) {

    const normalizedTarget =
        normalizeFacebookPostUrl(postUrl);

    for (const tableName of CAMIS_TABLES) {

        const { data, error } =
            await supabase
                .from(tableName)
                .select('"Post ID", "Post URL"');

        if (error) {
            throw new Error(
                `Duplicate check failed in ${tableName}: ${error.message}`
            );
        }

        const match =
            (data || []).find(
                record =>
                    normalizeFacebookPostUrl(
                        record["Post URL"]
                    ) === normalizedTarget
            );

        if (match) {
            return {
                duplicate: true,
                tableName,
                record: match,
                normalizedPostUrl: normalizedTarget
            };
        }
    }

    return {
        duplicate: false,
        normalizedPostUrl: normalizedTarget
    };
}


// ------------------------------------------------------------
// Check temporary review queue for same normalized Facebook post
// ------------------------------------------------------------

async function findQueueDuplicate(postUrl) {

    const normalizedTarget =
        normalizeFacebookPostUrl(postUrl);

    const { data, error } =
        await supabase
            .from("automated_review_queue")
            .select('"Queue ID", "Post URL"');

    if (error) {
        throw new Error(
            `Queue duplicate check failed: ${error.message}`
        );
    }

    const match =
        (data || []).find(
            record =>
                normalizeFacebookPostUrl(
                    record["Post URL"]
                ) === normalizedTarget
        );

    return {
        duplicate: Boolean(match),
        record: match || null,
        normalizedPostUrl: normalizedTarget
    };
}


// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
    "/api/health",
    async (req, res) => {

        try {

            const {
                error
            } =
                await supabase
                    .from(
                        "Table 1 (JAN - FEB)"
                    )
                    .select(
                        '"Post ID"'
                    )
                    .limit(1);


            if (error) {

                console.error(
                    "Supabase health check error:",
                    error.message
                );


                return res
                    .status(500)
                    .json({

                        success: false,

                        message:
                            "CAMIS server is running, but Supabase connection failed.",

                        error:
                            error.message

                    });
            }


            return res.json({

                success: true,

                message:
                    "CAMIS server and Supabase connection are working."

            });


        } catch (error) {

            console.error(
                "Health check error:",
                error
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "CAMIS health check failed."

                });
        }
    }
);


// ============================================================
// SUBMIT A CAMIS RESEARCH RECORD
// ============================================================

app.post(
    "/api/records",
    async (req, res) => {

        try {

            const {

                collectionPeriod,

                platform,

                originalPostDate,

                postUrl,

                accountPageName,

                username,

                followerCount,

                reactionCount,

                commentCount,

                shareCount,

                publicContactNumber,

                briefDescription,

                identifiedCategory,

                suspectedAiGenerated,

                collectedBy

            } = req.body;


            // --------------------------------------------------
            // Required fields
            // --------------------------------------------------

            if (
                !collectionPeriod ||
                !platform ||
                !originalPostDate ||
                !postUrl ||
                !briefDescription ||
                !identifiedCategory ||
                !collectedBy
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Please complete all required fields."

                    });
            }


            // --------------------------------------------------
            // Validate approved table
            // --------------------------------------------------

            if (
                !CAMIS_TABLES.includes(
                    collectionPeriod
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Invalid collection period."

                    });
            }


            // --------------------------------------------------
            // Validate URL
            // --------------------------------------------------

            if (
                !isValidPublicUrl(
                    postUrl
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Please enter a valid public post URL."

                    });
            }


            // --------------------------------------------------
            // Validate category
            // --------------------------------------------------

            if (
                !APPROVED_CATEGORIES.includes(
                    identifiedCategory
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Please select a valid category."

                    });
            }


            // --------------------------------------------------
            // Prevent duplicate permanent record
            // --------------------------------------------------

            let directDuplicate;

            try {
                directDuplicate =
                    await findPermanentDuplicate(postUrl);
            } catch (error) {
                console.error(
                    "Permanent duplicate check error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to check existing permanent CAMIS records."
                });
            }

            if (directDuplicate.duplicate) {
                return res.status(409).json({
                    success: false,
                    duplicate: true,
                    existingTable:
                        directDuplicate.tableName,
                    message:
                        "This Facebook post already exists in permanent CAMIS records."
                });
            }


            // --------------------------------------------------
            // Build permanent record
            // --------------------------------------------------

            const record = {

                "Platform":
                    platform.trim(),

                "Original Post Date":
                    originalPostDate,

                "Post URL":
                    normalizeFacebookPostUrl(postUrl),

                "Account Page Name":
                    accountPageName?.trim()
                    || null,

                "Username":
                    username?.trim()
                    || null,

                "Follower Count":
                    optionalNumber(
                        followerCount
                    ),

                "Reaction Count":
                    optionalNumber(
                        reactionCount
                    ),

                "Comment Count":
                    optionalNumber(
                        commentCount
                    ),

                "Share Count":
                    optionalNumber(
                        shareCount
                    ),

                "Public Contact Number":
                    publicContactNumber
                        ?.trim()
                    || null,

                "Brief Description":
                    briefDescription.trim(),

                "Identified Category":
                    identifiedCategory,

                "Suspected AI Generated":
                    suspectedAiGenerated === true,

                "Collected By":
                    collectedBy.trim()

            };


            // --------------------------------------------------
            // Insert
            // --------------------------------------------------

            const {
                data,
                error
            } =
                await supabase
                    .from(
                        collectionPeriod
                    )
                    .insert([
                        record
                    ])
                    .select();


            if (error) {

                console.error(
                    "Supabase insert error:",
                    error.message
                );


                return res
                    .status(500)
                    .json({

                        success: false,

                        message:
                            "Unable to save the research record.",

                        error:
                            error.message

                    });
            }


            return res
                .status(201)
                .json({

                    success: true,

                    message:
                        "Research record submitted successfully.",

                    record:
                        data[0]

                });


        } catch (error) {

            console.error(
                "Record submission error:",
                error
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "An unexpected server error occurred."

                });
        }
    }
);


// ============================================================
// GET ALL CAMIS RESEARCH RECORDS
// ============================================================

app.get(
    "/api/records",
    async (req, res) => {

        try {

            const allRecords = [];


            for (
                const tableName
                of CAMIS_TABLES
            ) {

                const {
                    data,
                    error
                } =
                    await supabase
                        .from(
                            tableName
                        )
                        .select("*")
                        .order(
                            "Date Collected",
                            {
                                ascending: false
                            }
                        );


                if (error) {

                    console.error(
                        `Error reading ${tableName}:`,
                        error.message
                    );


                    return res
                        .status(500)
                        .json({

                            success: false,

                            message:
                                `Unable to retrieve records from ${tableName}.`,

                            error:
                                error.message

                        });
                }


                const recordsWithPeriod =
                    data.map(
                        record => ({

                            ...record,

                            "Collection Period":
                                tableName

                        })
                    );


                allRecords.push(
                    ...recordsWithPeriod
                );
            }


            allRecords.sort(
                (a, b) => {

                    return (
                        new Date(
                            b["Date Collected"]
                        ) -
                        new Date(
                            a["Date Collected"]
                        )
                    );
                }
            );


            return res.json({

                success: true,

                total:
                    allRecords.length,

                records:
                    allRecords

            });


        } catch (error) {

            console.error(
                "Research records error:",
                error
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Unable to retrieve CAMIS research records."

                });
        }
    }
);


// ============================================================
// CHECK WHETHER FACEBOOK POST WAS ALREADY PROCESSED
// ============================================================

app.get(
    "/api/post-status",
    async (req, res) => {
        try {
            const postUrl =
                String(req.query.postUrl || "").trim();

            if (!postUrl || !isFacebookUrl(postUrl)) {
                return res.status(400).json({
                    success: false,
                    error: "A valid Facebook post URL is required."
                });
            }

            const permanent =
                await findPermanentDuplicate(postUrl);

            if (permanent.duplicate) {
                return res.json({
                    success: true,
                    processed: true,
                    location: "permanent",
                    normalizedPostUrl:
                        permanent.normalizedPostUrl,
                    existingTable:
                        permanent.tableName,
                    existingRecordId:
                        permanent.record["Post ID"]
                });
            }

            const queue =
                await findQueueDuplicate(postUrl);

            if (queue.duplicate) {
                return res.json({
                    success: true,
                    processed: true,
                    location: "queue",
                    normalizedPostUrl:
                        queue.normalizedPostUrl,
                    existingQueueId:
                        queue.record["Queue ID"]
                });
            }

            return res.json({
                success: true,
                processed: false,
                location: null,
                normalizedPostUrl:
                    normalizeFacebookPostUrl(postUrl)
            });

        } catch (error) {
            console.error("GET /api/post-status error:", error);
            return res.status(500).json({
                success: false,
                error:
                    "Unable to check whether the post was previously processed."
            });
        }
    }
);


// ============================================================
// CAMIS AUTOMATED REVIEW QUEUE
// ============================================================


// ------------------------------------------------------------
// ADD AUTOMATED FINDING TO TEMPORARY QUEUE
// ------------------------------------------------------------

app.post(
    "/api/automated-review",
    async (req, res) => {

        try {

            const {

                platform,

                postUrl,

                potentialCategory,

                matchedIndicators,

                discoveryQuery

            } = req.body;


            // --------------------------------------------------
            // Required fields
            // --------------------------------------------------

            if (
                !postUrl ||
                !potentialCategory
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "Post URL and potential category are required."

                    });
            }


            // --------------------------------------------------
            // Facebook URL validation
            // --------------------------------------------------

            if (
                !isFacebookUrl(
                    postUrl
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "Current CAMIS prototype only accepts valid Facebook URLs."

                    });
            }


            // --------------------------------------------------
            // Persistent duplicate recognition
            // --------------------------------------------------

            const normalizedPostUrl =
                normalizeFacebookPostUrl(postUrl);

            let permanentDuplicate;
            let queueDuplicate;

            try {
                permanentDuplicate =
                    await findPermanentDuplicate(
                        normalizedPostUrl
                    );

                if (!permanentDuplicate.duplicate) {
                    queueDuplicate =
                        await findQueueDuplicate(
                            normalizedPostUrl
                        );
                }
            } catch (error) {
                console.error(
                    "Automated review duplicate check error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    error:
                        "Unable to check whether this Facebook post was previously processed."
                });
            }

            if (permanentDuplicate.duplicate) {
                return res.status(409).json({
                    success: false,
                    duplicate: true,
                    previouslyProcessed: true,
                    location: "permanent",
                    existingTable:
                        permanentDuplicate.tableName,
                    error:
                        "This Facebook post was already officer-verified and exists in permanent CAMIS records."
                });
            }

            if (
                queueDuplicate &&
                queueDuplicate.duplicate
            ) {
                return res.status(409).json({
                    success: false,
                    duplicate: true,
                    previouslyProcessed: true,
                    location: "queue",
                    existingQueueId:
                        queueDuplicate.record["Queue ID"],
                    error:
                        "This Facebook post already exists in the CAMIS automated review queue."
                });
            }


            // --------------------------------------------------
            // Build temporary finding
            // --------------------------------------------------

            const record = {

                "Platform":
                    platform || "Facebook",

                "Post URL":
                    normalizedPostUrl,

                "Potential Category":
                    potentialCategory.trim(),

                "Matched Indicators":
                    matchedIndicators?.trim()
                    || null,

                "Discovery Query":
                    discoveryQuery?.trim()
                    || null,

                "Review Status":
                    "Pending"

            };


            // --------------------------------------------------
            // Insert into temporary queue
            // --------------------------------------------------

            const {
                data,
                error
            } =
                await supabase
                    .from(
                        "automated_review_queue"
                    )
                    .insert(
                        record
                    )
                    .select()
                    .single();


            if (error) {

                // PostgreSQL unique violation
                // Post URL already exists in queue.

                if (
                    error.code ===
                    "23505"
                ) {

                    return res
                        .status(409)
                        .json({

                            success: false,

                            duplicate: true,

                            error:
                                "This Facebook post already exists in the automated review queue."

                        });
                }


                console.error(
                    "Automated review insert error:",
                    error
                );


                return res
                    .status(500)
                    .json({

                        success: false,

                        error:
                            "Unable to add finding to automated review queue."

                    });
            }


            return res
                .status(201)
                .json({

                    success: true,

                    message:
                        "Finding added to automated review queue.",

                    record:
                        data

                });


        } catch (error) {

            console.error(
                "POST /api/automated-review error:",
                error
            );


            return res
                .status(500)
                .json({

                    success: false,

                    error:
                        "Internal server error."

                });
        }
    }
);


// ------------------------------------------------------------
// GET ALL AUTOMATED FINDINGS
// ------------------------------------------------------------

app.get(
    "/api/automated-review",
    async (req, res) => {

        try {

            const {
                data,
                error
            } =
                await supabase
                    .from(
                        "automated_review_queue"
                    )
                    .select("*")
                    .order(
                        "Date Discovered",
                        {
                            ascending: false
                        }
                    );


            if (error) {

                console.error(
                    "Automated review fetch error:",
                    error
                );


                return res
                    .status(500)
                    .json({

                        success: false,

                        error:
                            "Unable to retrieve automated review findings."

                    });
            }


            return res.json({

                success: true,

                total:
                    data.length,

                records:
                    data

            });


        } catch (error) {

            console.error(
                "GET /api/automated-review error:",
                error
            );


            return res
                .status(500)
                .json({

                    success: false,

                    error:
                        "Internal server error."

                });
        }
    }
);


// ============================================================
// GET ONE AUTOMATED FINDING
// ============================================================

app.get(
    "/api/automated-review/:id",
    async (req, res) => {

        try {

            const queueId =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(
                    queueId
                ) ||
                queueId <= 0
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "Invalid queue ID."

                    });
            }


            const {
                data,
                error
            } =
                await supabase
                    .from(
                        "automated_review_queue"
                    )
                    .select("*")
                    .eq(
                        "Queue ID",
                        queueId
                    )
                    .maybeSingle();


            if (error) {

                console.error(
                    "Automated finding lookup error:",
                    error
                );


                return res
                    .status(500)
                    .json({

                        success: false,

                        error:
                            "Unable to retrieve automated finding."

                    });
            }


            if (!data) {

                return res
                    .status(404)
                    .json({

                        success: false,

                        error:
                            "Automated finding was not found."

                    });
            }


            return res.json({

                success: true,

                record:
                    data

            });


        } catch (error) {

            console.error(
                "GET /api/automated-review/:id error:",
                error
            );


            return res
                .status(500)
                .json({

                    success: false,

                    error:
                        "Internal server error."

                });
        }
    }
);


// ============================================================
// ADD OFFICER-VERIFIED FINDING TO PERMANENT RECORDS
// ============================================================

app.post(
    "/api/automated-review/:id/add-to-records",
    async (req, res) => {

        try {

            const queueId =
                Number(
                    req.params.id
                );


            // --------------------------------------------------
            // Validate Queue ID
            // --------------------------------------------------

            if (
                !Number.isInteger(
                    queueId
                ) ||
                queueId <= 0
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "Invalid queue ID."

                    });
            }


            // --------------------------------------------------
            // Retrieve temporary queue record
            // --------------------------------------------------

            const {
                data: queueRecord,
                error: queueError
            } =
                await supabase
                    .from(
                        "automated_review_queue"
                    )
                    .select("*")
                    .eq(
                        "Queue ID",
                        queueId
                    )
                    .maybeSingle();


            if (queueError) {

                console.error(
                    "Queue lookup error:",
                    queueError
                );


                return res
                    .status(500)
                    .json({

                        success: false,

                        error:
                            "Unable to retrieve automated finding."

                    });
            }


            if (!queueRecord) {

                return res
                    .status(404)
                    .json({

                        success: false,

                        error:
                            "Automated finding was not found."

                    });
            }


            // --------------------------------------------------
            // Officer-verified information
            // --------------------------------------------------

            const {

                originalPostDate,

                accountPageName,

                username,

                followerCount,

                reactionCount,

                commentCount,

                shareCount,

                publicContactNumber,

                briefDescription,

                identifiedCategory,

                suspectedAiGenerated,

                collectedBy

            } = req.body;


            // --------------------------------------------------
            // Required verified fields
            // --------------------------------------------------

            if (
                !originalPostDate ||
                !briefDescription ||
                !identifiedCategory ||
                !collectedBy
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "Original post date, brief description, verified category and collected by are required."

                    });
            }


            // --------------------------------------------------
            // Determine permanent table
            // --------------------------------------------------

            const tableResult =
                determineCollectionTable(
                    originalPostDate
                );


            if (
                !tableResult.valid
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            tableResult.message

                    });
            }


            const destinationTable =
                tableResult.tableName;


            // --------------------------------------------------
            // Validate verified category
            // --------------------------------------------------

            if (
                !APPROVED_CATEGORIES.includes(
                    identifiedCategory
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "Please select a valid verified category."

                    });
            }


            // --------------------------------------------------
            // URL comes from server-side queue record.
            // Officer cannot change the source URL in browser.
            // --------------------------------------------------

            const postUrl =
                normalizeFacebookPostUrl(
                    queueRecord[
                        "Post URL"
                    ]
                );


            if (
                !isFacebookUrl(
                    postUrl
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "The temporary finding does not contain a valid Facebook URL."

                    });
            }


            // --------------------------------------------------
            // Check all five permanent tables for duplicate URL
            // --------------------------------------------------

            let duplicateResult;


            try {

                duplicateResult =
                    await findPermanentDuplicate(
                        postUrl
                    );

            } catch (error) {

                console.error(
                    "Permanent duplicate check error:",
                    error
                );


                return res
                    .status(500)
                    .json({

                        success: false,

                        error:
                            "Unable to check existing permanent CAMIS records."

                    });
            }


            if (
                duplicateResult.duplicate
            ) {

                return res
                    .status(409)
                    .json({

                        success: false,

                        duplicate: true,

                        existingTable:
                            duplicateResult.tableName,

                        error:
                            "This Facebook post has already been added to the permanent CAMIS records."

                    });
            }


            // --------------------------------------------------
            // Build officer-verified permanent record
            // --------------------------------------------------

            const permanentRecord = {

                "Platform":
                    queueRecord[
                        "Platform"
                    ] || "Facebook",

                "Original Post Date":
                    originalPostDate,

                "Post URL":
                    postUrl,

                "Account Page Name":
                    accountPageName
                        ?.trim()
                    || null,

                "Username":
                    username
                        ?.trim()
                    || null,

                "Follower Count":
                    optionalNumber(
                        followerCount
                    ),

                "Reaction Count":
                    optionalNumber(
                        reactionCount
                    ),

                "Comment Count":
                    optionalNumber(
                        commentCount
                    ),

                "Share Count":
                    optionalNumber(
                        shareCount
                    ),

                "Public Contact Number":
                    publicContactNumber
                        ?.trim()
                    || null,

                "Brief Description":
                    briefDescription.trim(),

                "Identified Category":
                    identifiedCategory,

                "Suspected AI Generated":
                    suspectedAiGenerated === true,

                "Collected By":
                    collectedBy.trim()

            };


            // --------------------------------------------------
            // Insert into automatically selected permanent table
            // --------------------------------------------------

            const {
                data: savedRecord,
                error: insertError
            } =
                await supabase
                    .from(
                        destinationTable
                    )
                    .insert([
                        permanentRecord
                    ])
                    .select()
                    .single();


            if (insertError) {

                console.error(
                    "Permanent record insert error:",
                    insertError
                );


                return res
                    .status(500)
                    .json({

                        success: false,

                        error:
                            "Unable to save the verified permanent record."

                    });
            }


            // --------------------------------------------------
            // IMPORTANT:
            // We deliberately DO NOT delete the temporary queue
            // record here.
            //
            // Officer confirms successful permanent save first,
            // then manually selects Remove from Automated Review.
            // --------------------------------------------------


            return res
                .status(201)
                .json({

                    success: true,

                    message:
                        "Officer-verified record saved successfully.",

                    destinationTable,

                    record:
                        savedRecord

                });


        } catch (error) {

            console.error(
                "POST /api/automated-review/:id/add-to-records error:",
                error
            );


            return res
                .status(500)
                .json({

                    success: false,

                    error:
                        "Internal server error."

                });
        }
    }
);


// ============================================================
// DELETE TEMPORARY AUTOMATED FINDING
// ============================================================

app.delete(
    "/api/automated-review/:id",
    async (req, res) => {

        try {

            const queueId =
                Number(
                    req.params.id
                );


            // --------------------------------------------------
            // Validate Queue ID
            // --------------------------------------------------

            if (
                !Number.isInteger(
                    queueId
                ) ||
                queueId <= 0
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "Invalid queue ID."

                    });
            }


            // --------------------------------------------------
            // Confirm temporary finding exists
            // --------------------------------------------------

            const {
                data: existingRecord,
                error: lookupError
            } =
                await supabase
                    .from(
                        "automated_review_queue"
                    )
                    .select(
                        '"Queue ID", "Post URL"'
                    )
                    .eq(
                        "Queue ID",
                        queueId
                    )
                    .maybeSingle();


            if (lookupError) {

                console.error(
                    "Queue lookup error:",
                    lookupError
                );


                return res
                    .status(500)
                    .json({

                        success: false,

                        error:
                            "Unable to check automated finding."

                    });
            }


            if (!existingRecord) {

                return res
                    .status(404)
                    .json({

                        success: false,

                        error:
                            "Automated finding was not found."

                    });
            }


            // --------------------------------------------------
            // Permanently delete from TEMPORARY queue only
            // --------------------------------------------------

            const {
                error: deleteError
            } =
                await supabase
                    .from(
                        "automated_review_queue"
                    )
                    .delete()
                    .eq(
                        "Queue ID",
                        queueId
                    );


            if (deleteError) {

                console.error(
                    "Queue delete error:",
                    deleteError
                );


                return res
                    .status(500)
                    .json({

                        success: false,

                        error:
                            "Unable to remove automated finding."

                    });
            }


            return res.json({

                success: true,

                message:
                    "Automated finding permanently removed from temporary review queue."

            });


        } catch (error) {

            console.error(
                "DELETE /api/automated-review/:id error:",
                error
            );


            return res
                .status(500)
                .json({

                    success: false,

                    error:
                        "Internal server error."

                });
        }
    }
);


// ============================================================
// START CAMIS SERVER
// ============================================================

app.listen(
    PORT,
    () => {

        console.log(
            "-------------------------------------------"
        );

        console.log(
            " CAMIS"
        );

        console.log(
            " Consumer Affairs Monitoring & Intelligence System"
        );

        console.log(
            "-------------------------------------------"
        );

        console.log(
            `Server running on http://localhost:${PORT}`
        );

    }
);
