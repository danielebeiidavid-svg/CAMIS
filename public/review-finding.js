document.addEventListener(
    "DOMContentLoaded",
    initializeReviewFinding
);


let queueId = null;
let queueRecord = null;


// ============================================================
// INITIALIZE
// ============================================================

async function initializeReviewFinding() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    queueId =
        Number(
            params.get("id")
        );


    if (
        !Number.isInteger(queueId) ||
        queueId <= 0
    ) {

        showPageError(
            "Invalid automated review finding."
        );

        return;
    }


    await loadQueueFinding();


    const form =
        document.getElementById(
            "verificationForm"
        );


    form.addEventListener(
        "submit",
        submitVerifiedFinding
    );
}


// ============================================================
// LOAD TEMPORARY FINDING
// ============================================================

async function loadQueueFinding() {

    try {

        const response =
            await fetch(
                `/api/automated-review/${queueId}`
            );


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.error ||
                "Unable to load automated finding."
            );
        }


        queueRecord =
            result.record;


        populateFindingContext(
            queueRecord
        );


        document.getElementById(
            "pageLoading"
        ).hidden = true;


        document.getElementById(
            "verificationContent"
        ).hidden = false;


    } catch (error) {

        console.error(
            "Load finding error:",
            error
        );


        showPageError(
            error.message
        );
    }
}


// ============================================================
// DISPLAY TEMPORARY FINDING
// ============================================================

function populateFindingContext(record) {

    setText(
        "queueIdDisplay",
        record["Queue ID"]
    );


    setText(
        "platformDisplay",
        record["Platform"] || "Facebook"
    );


    setText(
        "potentialCategoryDisplay",
        record["Potential Category"] || "-"
    );


    setText(
        "indicatorsDisplay",
        record["Matched Indicators"] || "-"
    );


    setText(
        "queryDisplay",
        record["Discovery Query"] || "-"
    );


    setText(
        "dateDiscoveredDisplay",
        formatDateTime(
            record["Date Discovered"]
        )
    );


    const sourceLink =
        document.getElementById(
            "sourcePostLink"
        );


    if (
        isSafeFacebookUrl(
            record["Post URL"]
        )
    ) {

        sourceLink.href =
            record["Post URL"];

    } else {

        sourceLink.removeAttribute(
            "href"
        );

        sourceLink.textContent =
            "Source URL unavailable";
    }


    // --------------------------------------------------------
    // Pre-select automated category only when it exactly
    // matches one approved permanent category.
    // --------------------------------------------------------

    const categorySelect =
        document.getElementById(
            "identifiedCategory"
        );


    const potentialCategory =
        record["Potential Category"] || "";


    const exactOptionExists =
        Array.from(
            categorySelect.options
        ).some(
            option =>
                option.value ===
                potentialCategory
        );


    if (exactOptionExists) {

        categorySelect.value =
            potentialCategory;
    }


    // If multiple automated categories exist, CAMIS does not
    // automatically choose one. Officer must verify one.
}


// ============================================================
// SUBMIT OFFICER-VERIFIED RECORD
// ============================================================

async function submitVerifiedFinding(event) {

    event.preventDefault();


    clearMessage();


    const saveButton =
        document.getElementById(
            "saveButton"
        );


    saveButton.disabled = true;

    saveButton.textContent =
        "Saving...";


    try {

        const payload = {

            originalPostDate:
                valueOf("originalPostDate"),

            accountPageName:
                valueOf("accountPageName"),

            username:
                valueOf("username"),

            followerCount:
                valueOf("followerCount"),

            reactionCount:
                valueOf("reactionCount"),

            commentCount:
                valueOf("commentCount"),

            shareCount:
                valueOf("shareCount"),

            publicContactNumber:
                valueOf("publicContactNumber"),

            briefDescription:
                valueOf("briefDescription"),

            identifiedCategory:
                valueOf("identifiedCategory"),

            suspectedAiGenerated:
                document.getElementById(
                    "suspectedAiGenerated"
                ).checked,

            collectedBy:
                valueOf("collectedBy")
        };


        const response =
            await fetch(
                `/api/automated-review/${queueId}/add-to-records`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.error ||
                "Unable to save verified record."
            );
        }


        showMessage(
            `Permanent record saved successfully to ${result.destinationTable}. ` +
            `The temporary finding remains in the Automated Review queue until you remove it.`,
            "success"
        );


        // Prevent accidental second submission.
        saveButton.disabled = true;

        saveButton.textContent =
            "Record Saved";


    } catch (error) {

        console.error(
            "Save verified finding error:",
            error
        );


        showMessage(
            error.message,
            "error"
        );


        saveButton.disabled = false;

        saveButton.textContent =
            "Save Permanent Record";
    }
}


// ============================================================
// HELPERS
// ============================================================

function valueOf(id) {

    return document
        .getElementById(id)
        .value
        .trim();
}


function setText(id, value) {

    document.getElementById(
        id
    ).textContent =
        value ?? "-";
}


function formatDateTime(value) {

    if (!value) {
        return "-";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }


    return date.toLocaleString();
}


function isSafeFacebookUrl(value) {

    try {

        const url =
            new URL(value);


        return (
            ["http:", "https:"]
                .includes(url.protocol) &&

            (
                url.hostname ===
                    "facebook.com" ||

                url.hostname ===
                    "www.facebook.com"
            )
        );

    } catch {

        return false;
    }
}


function showMessage(
    message,
    type
) {

    const element =
        document.getElementById(
            "formMessage"
        );


    element.textContent =
        message;


    element.className =
        `verification-message ${type}`;
}


function clearMessage() {

    const element =
        document.getElementById(
            "formMessage"
        );


    element.textContent = "";

    element.className =
        "verification-message";
}


function showPageError(message) {

    const loading =
        document.getElementById(
            "pageLoading"
        );


    loading.hidden = false;

    loading.textContent =
        message;

    loading.style.color =
        "#b91c1c";
}
