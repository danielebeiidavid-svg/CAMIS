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