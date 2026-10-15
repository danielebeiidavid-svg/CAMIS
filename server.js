require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// --------------------------------------------------
// Middleware
// --------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --------------------------------------------------
// Supabase connection
// --------------------------------------------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing Supabase environment variables.");
  process.exit(1);
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// --------------------------------------------------
// CAMIS table configuration
// --------------------------------------------------
const CAMIS_TABLES = [
  "Table 1 (JAN - FEB)",
  "Table 2 (MAR - APR)",
  "Table 3 (MAY - JUN)",
  "Table 4 (JUL - AUG)",
  "Table 5 (SEP - OCT)"
];

// --------------------------------------------------
// Health check
// --------------------------------------------------
app.get("/api/health", async (req, res) => {
  try {
    const { error } = await supabase
      .from("Table 1 (JAN - FEB)")
      .select('"Post ID"')
      .limit(1);

    if (error) {
      console.error("Supabase health check error:", error.message);

      return res.status(500).json({
        success: false,
        message: "CAMIS server is running, but Supabase connection failed.",
        error: error.message
      });
    }

    res.json({
      success: true,
      message: "CAMIS server and Supabase connection are working."
    });

  } catch (error) {
    console.error("Health check error:", error);

    res.status(500).json({
      success: false,
      message: "CAMIS health check failed."
    });
  }
});


// --------------------------------------------------
// Submit a CAMIS research record
// --------------------------------------------------
app.post("/api/records", async (req, res) => {
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

    // Required fields
    if (
      !collectionPeriod ||
      !platform ||
      !originalPostDate ||
      !postUrl ||
      !briefDescription ||
      !identifiedCategory ||
      !collectedBy
    ) {
      return res.status(400).json({
        success: false,
        message: "Please complete all required fields."
      });
    }

    // Validate approved table
    if (!CAMIS_TABLES.includes(collectionPeriod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid collection period."
      });
    }

    // Validate URL
    try {
      const url = new URL(postUrl);

      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error();
      }
    } catch {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid public post URL."
      });
    }

    // Helper for optional numeric fields
    const optionalNumber = (value) => {
      if (value === "" || value === null || value === undefined) {
        return null;
      }

      const number = Number(value);

      return Number.isFinite(number) && number >= 0
        ? Math.trunc(number)
        : null;
    };

    const record = {
      "Platform": platform,
      "Original Post Date": originalPostDate,
      "Post URL": postUrl.trim(),

      "Account Page Name":
        accountPageName?.trim() || null,

      "Username":
        username?.trim() || null,

      "Follower Count":
        optionalNumber(followerCount),

      "Reaction Count":
        optionalNumber(reactionCount),

      "Comment Count":
        optionalNumber(commentCount),

      "Share Count":
        optionalNumber(shareCount),

      "Public Contact Number":
        publicContactNumber?.trim() || null,

      "Brief Description":
        briefDescription.trim(),

      "Identified Category":
        identifiedCategory,

      "Suspected AI Generated":
        suspectedAiGenerated === true,

      "Collected By":
        collectedBy.trim()
    };

    const { data, error } = await supabase
      .from(collectionPeriod)
      .insert([record])
      .select();

    if (error) {
      console.error("Supabase insert error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to save the research record.",
        error: error.message
      });
    }

    res.status(201).json({
      success: true,
      message: "Research record submitted successfully.",
      record: data[0]
    });

  } catch (error) {
    console.error("Record submission error:", error);

    res.status(500).json({
      success: false,
      message: "An unexpected server error occurred."
    });
  }
});

// --------------------------------------------------
// Get all CAMIS research records
// --------------------------------------------------
app.get("/api/records", async (req, res) => {
  try {
    const allRecords = [];

    for (const tableName of CAMIS_TABLES) {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .order("Date Collected", { ascending: false });

      if (error) {
        console.error(`Error reading ${tableName}:`, error.message);

        return res.status(500).json({
          success: false,
          message: `Unable to retrieve records from ${tableName}.`,
          error: error.message
        });
      }

      // Add the collection period to every returned record
      const recordsWithPeriod = data.map(record => ({
        ...record,
        "Collection Period": tableName
      }));

      allRecords.push(...recordsWithPeriod);
    }

    // Sort combined records newest first
    allRecords.sort((a, b) => {
      return new Date(b["Date Collected"]) - new Date(a["Date Collected"]);
    });

    res.json({
      success: true,
      total: allRecords.length,
      records: allRecords
    });

  } catch (error) {
    console.error("Research records error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve CAMIS research records."
    });
  }
});


// ============================================================
// CAMIS AUTOMATED REVIEW QUEUE
// ============================================================

// Add a CAMIS automated finding to the temporary review queue
app.post("/api/automated-review", async (req, res) => {
    try {
        const {
            platform,
            postUrl,
            potentialCategory,
            matchedIndicators,
            discoveryQuery
        } = req.body;

        // Required fields
        if (!postUrl || !potentialCategory) {
            return res.status(400).json({
                success: false,
                error: "Post URL and potential category are required."
            });
        }

        // Validate URL
        let parsedUrl;

        try {
            parsedUrl = new URL(postUrl);
        } catch {
            return res.status(400).json({
                success: false,
                error: "Invalid post URL."
            });
        }

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            return res.status(400).json({
                success: false,
                error: "Post URL must use HTTP or HTTPS."
            });
        }

        // For the current prototype, automated discoveries must be Facebook.
        if (
            parsedUrl.hostname !== "facebook.com" &&
            parsedUrl.hostname !== "www.facebook.com"
        ) {
            return res.status(400).json({
                success: false,
                error: "Current CAMIS prototype only accepts Facebook URLs."
            });
        }

        const record = {
            "Platform": platform || "Facebook",
            "Post URL": postUrl,
            "Potential Category": potentialCategory,
            "Matched Indicators": matchedIndicators || null,
            "Discovery Query": discoveryQuery || null,
            "Review Status": "Pending"
        };

        const { data, error } = await supabase
            .from("automated_review_queue")
            .insert(record)
            .select()
            .single();

        if (error) {
            // PostgreSQL unique violation.
            // Post URL already exists in the queue.
            if (error.code === "23505") {
                return res.status(409).json({
                    success: false,
                    duplicate: true,
                    error: "This Facebook post already exists in the automated review queue."
                });
            }

            console.error("Automated review insert error:", error);

            return res.status(500).json({
                success: false,
                error: "Unable to add finding to automated review queue."
            });
        }

        return res.status(201).json({
            success: true,
            message: "Finding added to automated review queue.",
            record: data
        });

    } catch (error) {
        console.error("POST /api/automated-review error:", error);

        return res.status(500).json({
            success: false,
            error: "Internal server error."
        });
    }
});


// Get findings from the automated review queue
app.get("/api/automated-review", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("automated_review_queue")
            .select("*")
            .order("Date Discovered", { ascending: false });

        if (error) {
            console.error("Automated review fetch error:", error);

            return res.status(500).json({
                success: false,
                error: "Unable to retrieve automated review findings."
            });
        }

        return res.json({
            success: true,
            total: data.length,
            records: data
        });

    } catch (error) {
        console.error("GET /api/automated-review error:", error);

        return res.status(500).json({
            success: false,
            error: "Internal server error."
        });
    }
});

// ============================================================
// DELETE TEMPORARY AUTOMATED FINDING
// ============================================================

app.delete(
    "/api/automated-review/:id",
    async (req, res) => {

        try {

            const queueId =
                Number(req.params.id);


            if (
                !Number.isInteger(queueId) ||
                queueId <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid queue ID."
                });
            }


            // Confirm that the record exists first.
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


                return res.status(500).json({
                    success: false,
                    error:
                        "Unable to check automated finding."
                });
            }


            if (!existingRecord) {

                return res.status(404).json({
                    success: false,
                    error:
                        "Automated finding was not found."
                });
            }


            // Permanently delete from temporary queue.
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


                return res.status(500).json({
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


            return res.status(500).json({
                success: false,
                error:
                    "Internal server error."
            });
        }
    }
);

// --------------------------------------------------
// Start server
// --------------------------------------------------
app.listen(PORT, () => {
  console.log("-------------------------------------------");
  console.log(" CAMIS");
  console.log(" Consumer Affairs Monitoring & Intelligence System");
  console.log("-------------------------------------------");
  console.log(`Server running on http://localhost:${PORT}`);
});
