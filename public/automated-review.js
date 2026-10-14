let automatedFindings = [];


document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadAutomatedFindings();

        document
            .getElementById("statusFilter")
            .addEventListener(
                "change",
                renderFindings
            );
    }
);


async function loadAutomatedFindings() {

    const container =
        document.getElementById(
            "reviewContent"
        );


    try {

        const response =
            await fetch(
                "/api/automated-review"
            );


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

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


function updateSummary() {

    const total =
        automatedFindings.length;


    const pending =
        automatedFindings.filter(
            record =>
                record["Review Status"] ===
                "Pending"
        ).length;


    const reviewed =
        automatedFindings.filter(
            record =>
                record["Review Status"] ===
                    "Verified" ||

                record["Review Status"] ===
                    "Rejected"
        ).length;


    document.getElementById(
        "totalFindings"
    ).textContent = total;


    document.getElementById(
        "pendingFindings"
    ).textContent = pending;


    document.getElementById(
        "reviewedFindings"
    ).textContent = reviewed;
}


function renderFindings() {

    const container =
        document.getElementById(
            "reviewContent"
        );


    const selectedStatus =
        document.getElementById(
            "statusFilter"
        ).value;


    let records =
        automatedFindings;


    if (
        selectedStatus !== "All"
    ) {

        records =
            records.filter(
                record =>
                    record["Review Status"] ===
                    selectedStatus
            );
    }


    if (records.length === 0) {

        container.className =
            "empty-message";


        container.innerHTML =
            "No automated findings match this filter.";

        return;
    }


    container.className =
        "table-wrapper";


    const rows =
        records
            .map(
                record => {

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


                    const status =
                        record[
                            "Review Status"
                        ] || "Pending";


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
                        <tr>

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
                                ${indicators}
                            </td>

                            <td>
                                ${query}
                            </td>

                            <td>
                                ${statusBadge(
                                    status
                                )}
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
                                ${
                                    status === "Pending"
                                        ? `
                                            <a
                                                class="review-button"
                                                href="review-finding.html?id=${encodeURIComponent(queueId)}"
                                            >
                                                Review
                                            </a>
                                          `
                                        : "Completed"
                                }
                            </td>

                        </tr>
                    `;
                }
            )
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
                    <th>Status</th>
                    <th>Source</th>
                    <th>Action</th>
                </tr>

            </thead>

            <tbody>
                ${rows}
            </tbody>

        </table>
    `;
}


function statusBadge(status) {

    const safeStatus =
        escapeHTML(status);


    let className =
        "status-badge";


    if (status === "Verified") {

        className +=
            " status-verified";
    }


    if (status === "Rejected") {

        className +=
            " status-rejected";
    }


    return `
        <span class="${className}">
            ${safeStatus}
        </span>
    `;
}


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
            url.hostname !==
                "facebook.com" &&

            url.hostname !==
                "www.facebook.com"
        ) {

            return null;
        }


        return url.href;


    } catch {

        return null;
    }
}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}
