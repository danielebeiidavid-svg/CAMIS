const form = document.getElementById("researchForm");
const message = document.getElementById("message");
const submitButton = document.getElementById("submitButton");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    message.textContent = "";
    message.className = "";

    const record = {
        collectionPeriod:
            document.getElementById("collectionPeriod").value,

        platform:
            document.getElementById("platform").value,

        originalPostDate:
            document.getElementById("originalPostDate").value,

        postUrl:
            document.getElementById("postUrl").value.trim(),

        accountPageName:
            document.getElementById("accountPageName").value.trim(),

        username:
            document.getElementById("username").value.trim(),

        followerCount:
            document.getElementById("followerCount").value,

        reactionCount:
            document.getElementById("reactionCount").value,

        commentCount:
            document.getElementById("commentCount").value,

        shareCount:
            document.getElementById("shareCount").value,

        publicContactNumber:
            document.getElementById("publicContactNumber").value.trim(),

        briefDescription:
            document.getElementById("briefDescription").value.trim(),

        identifiedCategory:
            document.getElementById("identifiedCategory").value,

        suspectedAiGenerated:
            document.getElementById("suspectedAiGenerated").checked,

        collectedBy:
            document.getElementById("collectedBy").value.trim()
    };

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    try {

const response = await fetch("/api/records", {
    method: "POST",

    headers: {
        "Content-Type": "application/json"
    },

    body: JSON.stringify(record)
});

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message ||
                "Unable to submit research record."
            );
        }

        message.textContent =
            "Research record submitted successfully.";

        message.className = "success";

        // Preserve researcher name
        const researcher =
            document.getElementById("collectedBy").value;

        form.reset();

        document.getElementById("collectedBy").value =
            researcher;

    } catch (error) {

        console.error(error);

        message.textContent =
            error.message ||
            "An error occurred while submitting the record.";

        message.className = "error";

    } finally {

        submitButton.disabled = false;
        submitButton.textContent = "Submit Record";

    }
});
