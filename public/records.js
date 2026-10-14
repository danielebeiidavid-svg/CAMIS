const recordsTable = document.getElementById("recordsTable");
const totalRecords = document.getElementById("totalRecords");

const searchInput = document.getElementById("searchInput");
const periodFilter = document.getElementById("periodFilter");
const categoryFilter = document.getElementById("categoryFilter");

const recordsMessage = document.getElementById("recordsMessage");

let records = [];


// --------------------------------------------------
// Load records from CAMIS API
// --------------------------------------------------

async function loadRecords() {

    try {

        const response = await fetch("/api/records");

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message ||
                "Unable to retrieve research records."
            );
        }

        records = result.records;

        displayRecords(records);

    } catch (error) {

        console.error(error);

        recordsTable.innerHTML = `
            <tr>
                <td colspan="7">
                    Unable to load records.
                </td>
            </tr>
        `;

        recordsMessage.textContent = error.message;
        recordsMessage.className = "error";
    }
}


// --------------------------------------------------
// Display records
// --------------------------------------------------

function displayRecords(data) {

    recordsTable.innerHTML = "";

    totalRecords.textContent = data.length;


    if (data.length === 0) {

        recordsTable.innerHTML = `
            <tr>
                <td colspan="7">
                    No matching research records found.
                </td>
            </tr>
        `;

        return;
    }


    data.forEach(record => {

        const row = document.createElement("tr");


        const postId =
            record["Post ID"] ?? "";


        const period =
            formatPeriod(
                record["Collection Period"]
            );


        const description =
            escapeHTML(
                record["Brief Description"] || ""
            );


        const category =
            escapeHTML(
                record["Identified Category"] || ""
            );


        const researcher =
            escapeHTML(
                record["Collected By"] || ""
            );


        const dateCollected =
            formatDate(
                record["Date Collected"]
            );


        const postUrl =
            record["Post URL"] || "";


        row.innerHTML = `

            <td>
                ${postId}
            </td>

            <td>
                ${period}
            </td>

            <td class="description-cell">
                ${description}
            </td>

            <td>
                <span class="category-badge">
                    ${category}
                </span>
            </td>

            <td>
                ${researcher}
            </td>

            <td>
                ${dateCollected}
            </td>

            <td>
                <a
                    href="${escapeAttribute(postUrl)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="source-link"
                >
                    Open Post
                </a>
            </td>

        `;

        recordsTable.appendChild(row);
    });
}


// --------------------------------------------------
// Filters
// --------------------------------------------------

function filterRecords() {

    const search =
        searchInput.value
            .trim()
            .toLowerCase();


    const period =
        periodFilter.value;


    const category =
        categoryFilter.value;


    const filtered = records.filter(record => {

        const description =
            (record["Brief Description"] || "")
                .toLowerCase();


        const researcher =
            (record["Collected By"] || "")
                .toLowerCase();


        const url =
            (record["Post URL"] || "")
                .toLowerCase();


        const matchesSearch =
            !search ||
            description.includes(search) ||
            researcher.includes(search) ||
            url.includes(search);


        const matchesPeriod =
            !period ||
            record["Collection Period"] === period;


        const matchesCategory =
            !category ||
            record["Identified Category"] === category;


        return (
            matchesSearch &&
            matchesPeriod &&
            matchesCategory
        );
    });


    displayRecords(filtered);
}


searchInput.addEventListener(
    "input",
    filterRecords
);

periodFilter.addEventListener(
    "change",
    filterRecords
);

categoryFilter.addEventListener(
    "change",
    filterRecords
);


// --------------------------------------------------
// Helper functions
// --------------------------------------------------

function formatPeriod(tableName) {

    const periods = {

        "Table 1 (JAN - FEB)":
            "Jan - Feb",

        "Table 2 (MAR - APR)":
            "Mar - Apr",

        "Table 3 (MAY - JUN)":
            "May - Jun",

        "Table 4 (JUL - AUG)":
            "Jul - Aug",

        "Table 5 (SEP - OCT)":
            "Sep - Oct"

    };

    return periods[tableName] || tableName;
}


function formatDate(value) {

    if (!value) {
        return "";
    }

    return new Date(value)
        .toLocaleString();
}


// Prevent stored text from becoming executable HTML

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function escapeAttribute(value) {

    return escapeHTML(value);
}


// --------------------------------------------------
// Start
// --------------------------------------------------

loadRecords();