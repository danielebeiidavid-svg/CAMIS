let automatedFindings = [];


document.addEventListener(
    "DOMContentLoaded",
    () => {
        loadAutomatedFindings();
        initialiseAutomaticSearch();
    }
);


// ============================================================
// AUTOMATIC FACEBOOK SEARCH
// ============================================================

let automaticSearchRunning = false;


function initialiseAutomaticSearch() {

    const button =
        document.getElementById(
            "automaticSearchButton"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        startAutomaticSearch
    );
}


async function startAutomaticSearch() {

    if (automaticSearchRunning) {
        return;
    }

    const button =
        document.getElementById(
            "automaticSearchButton"
        );

    const status =
        document.getElementById(
            "automaticSearchStatus"
        );

    if (!button || !status) {
        return;
    }


    const confirmed =
        window.confirm(
            "Start Automatic Facebook Search?\n\n" +
            "CAMIS will run the configured Facebook discovery queries. " +
            "Previously captured post URLs will be skipped, and only new " +
            "potential concerns will be sent to the temporary review queue."
        );


    if (!confirmed) {
        return;
    }


    automaticSearchRunning = true;

    button.disabled = true;
    button.textContent =
        "Searching...";

    status.textContent =
        "Status: Starting automatic Facebook search...";


    try {

        const response =
            await fetch(
                "/api/automatic-search",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );


        const result =
            await response
                .json()
                .catch(
                    () => ({})
                );


        if (!response.ok || !result.success) {

            throw new Error(
                result.error ||
                "Unable to start the automatic Facebook search."
            );
        }


        /*
         * The backend may either:
         *
         * 1. wait for the search to finish and return the final result, or
         * 2. start the local search launcher and return a running state.
         *
         * This frontend supports both patterns.
         */

        if (
            result.status === "running" ||
            result.running === true
        ) {

            status.textContent =
                "Status: Automatic Facebook search started. " +
                "CAMIS is searching the configured discovery queries.";

            await waitForAutomaticSearchCompletion();

        } else {

            showAutomaticSearchResult(
                result
            );

            await loadAutomatedFindings();
        }


    } catch (error) {

        console.error(error);

        status.textContent =
            "Status: Search could not be started. " +
            (
                error.message ||
                "Automatic search service unavailable."
            );

    } finally {

        automaticSearchRunning = false;

        button.disabled = false;
        button.textContent =
            "Automatic Search";
    }
}


async function waitForAutomaticSearchCompletion() {

    const status =
        document.getElementById(
            "automaticSearchStatus"
        );

    const maximumChecks = 180;

    for (
        let check = 0;
        check < maximumChecks;
        check += 1
    ) {

        await delay(2000);


        const response =
            await fetch(
                "/api/automatic-search/status",
                {
                    cache: "no-store"
                }
            );


        const result =
            await response
                .json()
                .catch(
                    () => ({})
                );


        if (!response.ok) {

            throw new Error(
                result.error ||
                "Unable to read automatic search status."
            );
        }


        if (
            result.status === "running" ||
            result.running === true
        ) {

            status.textContent =
                result.message ||
                "Status: Searching Facebook...";

            continue;
        }


        if (
            result.status === "failed" ||
            result.success === false
        ) {

            throw new Error(
                result.error ||
                "Automatic Facebook search failed."
            );
        }


        showAutomaticSearchResult(
            result
        );

        await loadAutomatedFindings();

        return;
    }


    throw new Error(
        "Automatic Facebook search is still running. " +
        "Please refresh the page shortly to check the review queue."
    );
}


function showAutomaticSearchResult(result) {

    const status =
        document.getElementById(
            "automaticSearchStatus"
        );

    if (!status) {
        return;
    }


    const summary =
        result.summary ||
        result.report ||
        {};


    const parts = [
        "Status: Automatic Search Complete"
    ];


    if (
        Number.isFinite(
            Number(summary.candidatesAttempted)
        )
    ) {
        parts.push(
            `Candidates attempted: ${Number(summary.candidatesAttempted)}`
        );
    }


    if (
        Number.isFinite(
            Number(summary.alreadyCaptured)
        )
    ) {
        parts.push(
            `Already captured: ${Number(summary.alreadyCaptured)}`
        );
    }


    if (
        Number.isFinite(
            Number(summary.successfullyInspected)
        )
    ) {
        parts.push(
            `Successfully inspected: ${Number(summary.successfullyInspected)}`
        );
    }


    if (
        Number.isFinite(
            Number(summary.newFindings)
        )
    ) {
        parts.push(
            `New findings: ${Number(summary.newFindings)}`
        );
    }


    status.textContent =
        parts.join(" | ");
}


function delay(milliseconds) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );
}


// ============================================================
// LOAD AUTOMATED FINDINGS
// ============================================================

async function loadAutomatedFindings() {

    const container =
        document.getElementById("reviewContent");

    try {

        const response =
            await fetch("/api/automated-review");

        const result =
            await response.json();


        if (!response.ok || !result.success) {

            throw new Error(
                result.error ||
                "Unable to retrieve automated findings."
            );
        }


        automatedFindings =
            result.records || [];


        updateSummary();

        renderFindings();


    } catch (error) {

        console.error(error);

        container.className =
            "error-message";

        container.textContent =
            "Unable to load automated review findings.";
    }
}


// ============================================================
// UPDATE SUMMARY CARDS
// ============================================================

function updateSummary() {

    const total =
        automatedFindings.length;


    document.getElementById(
        "totalFindings"
    ).textContent = total;


    // Because this table is now purely a temporary queue,
    // every record displayed is waiting for officer action.

    const pendingElement =
        document.getElementById(
            "pendingFindings"
        );

    if (pendingElement) {
        pendingElement.textContent = total;
    }


    const reviewedElement =
        document.getElementById(
            "reviewedFindings"
        );

    if (reviewedElement) {
        reviewedElement.textContent = "—";
    }
}


// ============================================================
// DISPLAY FINDINGS
// ============================================================

function renderFindings() {

    const container =
        document.getElementById(
            "reviewContent"
        );


    if (automatedFindings.length === 0) {

        container.className =
            "empty-message";

        container.innerHTML =
            "There are currently no automated findings waiting for officer action.";

        return;
    }


    container.className =
        "table-wrapper";


    const rows =
        automatedFindings
            .map(record => {

                const queueId =
                    record["Queue ID"];


                const platform =
                    escapeHTML(
                        record["Platform"] ||
                        "Facebook"
                    );


                const category =
                    escapeHTML(
                        record[
                            "Potential Category"
                        ] || ""
                    );


                const indicators =
                    escapeHTML(
                        record[
                            "Matched Indicators"
                        ] || ""
                    );


                const query =
                    escapeHTML(
                        record[
                            "Discovery Query"
                        ] || ""
                    );


                const sourceURL =
                    safeURL(
                        record["Post URL"]
                    );


                const discovered =
                    formatDate(
                        record[
                            "Date Discovered"
                        ]
                    );


                return `
                    <tr id="queue-row-${queueId}">

                        <td>
                            ${queueId}
                        </td>

                        <td>
                            ${discovered}
                        </td>

                        <td>
                            ${platform}
                        </td>

                        <td>
                            ${category}
                        </td>

                        <td>
                            ${indicators || "—"}
                        </td>

                        <td>
                            ${query || "—"}
                        </td>

                        <td>
                            ${
                                sourceURL
                                    ? `
                                        <a
                                            class="source-link"
                                            href="${sourceURL}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            View Post
                                        </a>
                                      `
                                    : "Unavailable"
                            }
                        </td>

                        <td>
                            <div class="queue-actions">

                                <a
                                    class="review-button"
                                    href="review-finding.html?id=${encodeURIComponent(queueId)}"
                                >
                                    Add to Form
                                </a>

                                <button
                                    type="button"
                                    class="remove-button"
                                    onclick="removeQueueFinding(${queueId})"
                                >
                                    Remove
                                </button>

                            </div>
                        </td>

                    </tr>
                `;
            })
            .join("");


    container.innerHTML = `

        <table class="review-table">

            <thead>

                <tr>
                    <th>ID</th>
                    <th>Detected</th>
                    <th>Platform</th>
                    <th>Potential Category</th>
                    <th>Indicators</th>
                    <th>Discovery Query</th>
                    <th>Source</th>
                    <th>Queue Action</th>
                </tr>

            </thead>

            <tbody>
                ${rows}
            </tbody>

        </table>
    `;
}


// ============================================================
// REMOVE TEMPORARY FINDING
// ============================================================

async function removeQueueFinding(queueId) {

    const confirmed =
        window.confirm(
            "Permanently remove this automated finding from the temporary CAMIS review queue?\n\n" +
            "This does not remove the Facebook post and does not delete any permanent verified record."
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/automated-review/${encodeURIComponent(queueId)}`,
                {
                    method: "DELETE"
                }
            );


        const result =
            await response.json();


        if (!response.ok || !result.success) {

            throw new Error(
                result.error ||
                "Unable to remove finding."
            );
        }


        // Remove from local array.
        automatedFindings =
            automatedFindings.filter(
                record =>
                    Number(
                        record["Queue ID"]
                    ) !== Number(queueId)
            );


        updateSummary();

        renderFindings();


    } catch (error) {

        console.error(error);

        alert(
            error.message ||
            "Unable to remove the automated finding."
        );
    }
}


// ============================================================
// DATE DISPLAY
// ============================================================

function formatDate(value) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "—";
    }


    return date.toLocaleString(
        undefined,
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


// ============================================================
// SAFE FACEBOOK URL
// ============================================================

function safeURL(value) {

    if (!value) {
        return null;
    }


    try {

        const url =
            new URL(value);


        if (
            url.protocol !== "https:" &&
            url.protocol !== "http:"
        ) {
            return null;
        }


        if (
            url.hostname !== "facebook.com" &&
            url.hostname !== "www.facebook.com"
        ) {
            return null;
        }


        return url.href;


    } catch {

        return null;
    }
}


// ============================================================
// HTML ESCAPING
// ============================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
