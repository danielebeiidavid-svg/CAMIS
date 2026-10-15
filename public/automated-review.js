let automatedFindings = [];


document.addEventListener(
    "DOMContentLoaded",
    () => {
        loadAutomatedFindings();
    }
);


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
