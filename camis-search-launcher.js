require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { spawn } = require("child_process");

const app = express();
const PORT = Number(process.env.CAMIS_LOCAL_SEARCH_PORT || 4310);

app.use(cors({ origin: true, methods: ["GET", "POST", "OPTIONS"] }));
app.use(express.json());

let activeChild = null;
let searchState = {
    status: "ready",
    running: false,
    message: "Status: Ready",
    startedAt: null,
    finishedAt: null,
    error: null,
    summary: {
        candidatesAttempted: 0,
        alreadyCaptured: 0,
        successfullyInspected: 0,
        newFindings: 0
    }
};

function freshSummary() {
    return {
        candidatesAttempted: 0,
        alreadyCaptured: 0,
        successfullyInspected: 0,
        newFindings: 0
    };
}

function readCount(line, label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = line.match(new RegExp(`${escaped}\\s*:\\s*(\\d+)`, "i"));
    return match ? Number(match[1]) : null;
}

function updateSummary(line) {
    const fields = [
        ["Candidates attempted", "candidatesAttempted"],
        ["Already captured by Post URL and skipped", "alreadyCaptured"],
        ["Successfully inspected", "successfullyInspected"],
        ["Findings eligible for officer review", "newFindings"]
    ];

    for (const [label, key] of fields) {
        const value = readCount(line, label);
        if (value !== null) searchState.summary[key] = value;
    }
}

app.get("/health", (req, res) => {
    res.json({
        success: true,
        service: "CAMIS Local Automatic Search Launcher",
        status: searchState.status
    });
});

app.post("/api/automatic-search", (req, res) => {
    if (searchState.running || activeChild) {
        return res.status(409).json({
            success: false,
            status: "running",
            running: true,
            error: "An automatic Facebook search is already running."
        });
    }

    const monitorPath = path.join(__dirname, "prototype", "facebookBrowser");

    searchState = {
        status: "running",
        running: true,
        message: "Status: Searching Facebook...",
        startedAt: new Date().toISOString(),
        finishedAt: null,
        error: null,
        summary: freshSummary()
    };

    const child = spawn(process.execPath, [monitorPath], {
        cwd: __dirname,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: false
    });

    activeChild = child;
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let finalReportReached = false;

    function processLine(rawLine) {
        const line = rawLine.trimEnd();
        if (!line) return;

        console.log(`[facebookBrowser] ${line}`);
        updateSummary(line);

        if (line.includes("CAMIS DISCOVERY MONITOR REPORT")) {
            searchState.message = "Status: Search finishing and preparing report...";
        }

        // The existing monitor intentionally remains open for inspection.
        // Its automated work is complete once this final safety line appears.
        if (
            line.includes(
                "No records were written directly to permanent verified tables."
            )
        ) {
            finalReportReached = true;
            searchState.status = "completed";
            searchState.running = false;
            searchState.finishedAt = new Date().toISOString();
            searchState.message = "Status: Automatic Search Complete";

            setTimeout(() => {
                if (activeChild === child && !child.killed) child.kill();
            }, 500);
        }
    }

    child.stdout.on("data", chunk => {
        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split(/\r?\n/);
        stdoutBuffer = lines.pop() || "";
        for (const line of lines) processLine(line);
    });

    child.stderr.on("data", chunk => {
        const text = chunk.toString();
        stderrBuffer += text;
        console.error(`[facebookBrowser error] ${text.trimEnd()}`);
    });

    child.on("error", error => {
        searchState.status = "failed";
        searchState.running = false;
        searchState.finishedAt = new Date().toISOString();
        searchState.error = error.message;
        searchState.message = "Status: Automatic Facebook search failed.";
        activeChild = null;
    });

    child.on("close", code => {
        if (stdoutBuffer.trim()) processLine(stdoutBuffer);

        if (!finalReportReached) {
            if (code === 0) {
                searchState.status = "completed";
                searchState.running = false;
                searchState.finishedAt = new Date().toISOString();
                searchState.message = "Status: Automatic Search Complete";
            } else {
                searchState.status = "failed";
                searchState.running = false;
                searchState.finishedAt = new Date().toISOString();
                searchState.error =
                    stderrBuffer.trim() ||
                    `facebookBrowser exited with code ${code}.`;
                searchState.message = "Status: Automatic Facebook search failed.";
            }
        }

        activeChild = null;
    });

    return res.status(202).json({
        success: true,
        status: "running",
        running: true,
        message: "Automatic Facebook search started."
    });
});

app.get("/api/automatic-search/status", (req, res) => {
    res.json({
        success: searchState.status !== "failed",
        ...searchState
    });
});

app.listen(PORT, "127.0.0.1", () => {
    console.log("-------------------------------------------");
    console.log(" CAMIS Local Automatic Search Launcher");
    console.log("-------------------------------------------");
    console.log(`Running on http://127.0.0.1:${PORT}`);
    console.log("Keep this window open while using Automatic Search.");
});
