const totalRecordsCard =
    document.getElementById("totalRecordsCard");

const topCategoryCard =
    document.getElementById("topCategoryCard");

const latestPeriodCard =
    document.getElementById("latestPeriodCard");

const researcherCountCard =
    document.getElementById("researcherCountCard");

const categoryStatistics =
    document.getElementById("categoryStatistics");

const researcherStatistics =
    document.getElementById("researcherStatistics");

const analyticsMessage =
    document.getElementById("analyticsMessage");


let periodChart;
let categoryChart;


// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const periods = [
    {
        table: "Table 1 (JAN - FEB)",
        label: "Jan - Feb"
    },
    {
        table: "Table 2 (MAR - APR)",
        label: "Mar - Apr"
    },
    {
        table: "Table 3 (MAY - JUN)",
        label: "May - Jun"
    },
    {
        table: "Table 4 (JUL - AUG)",
        label: "Jul - Aug"
    },
    {
        table: "Table 5 (SEP - OCT)",
        label: "Sep - Oct"
    }
];


const categories = [

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


// --------------------------------------------------
// LOAD DATA
// --------------------------------------------------

async function loadAnalytics() {

    try {

        const response =
            await fetch("/api/records");

        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.message ||
                "Unable to retrieve analytics data."
            );

        }


        const records =
            result.records || [];


        calculateSummary(records);

        createPeriodChart(records);

        createCategoryChart(records);

        createCategoryStatistics(records);

        createResearcherStatistics(records);


    } catch (error) {

        console.error(error);

        analyticsMessage.textContent =
            error.message;

        analyticsMessage.className =
            "error";

    }

}


// --------------------------------------------------
// SUMMARY CARDS
// --------------------------------------------------

function calculateSummary(records) {

    // Total records

    totalRecordsCard.textContent =
        records.length;


    // ----------------------------------------------
    // CATEGORY COUNTS
    // ----------------------------------------------

    const categoryCounts = {};

    records.forEach(record => {

        const category =
            record["Identified Category"];

        if (!category) {
            return;
        }

        categoryCounts[category] =
            (categoryCounts[category] || 0) + 1;

    });


    let topCategory = "-";
    let highestCount = 0;


    Object.entries(categoryCounts)
        .forEach(([category, count]) => {

            if (count > highestCount) {

                highestCount = count;

                topCategory = category;

            }

        });


    topCategoryCard.textContent =
        topCategory;


    // ----------------------------------------------
    // LATEST COLLECTION PERIOD WITH DATA
    // ----------------------------------------------

    let latestPeriod = "-";


    for (
        let i = periods.length - 1;
        i >= 0;
        i--
    ) {

        const found =
            records.some(record =>
                record["Collection Period"] ===
                periods[i].table
            );


        if (found) {

            latestPeriod =
                periods[i].label;

            break;

        }

    }


    latestPeriodCard.textContent =
        latestPeriod;


    // ----------------------------------------------
    // UNIQUE RESEARCHERS
    // ----------------------------------------------

    const researchers =
        new Set();


    records.forEach(record => {

        const researcher =
            record["Collected By"];

        if (
            researcher &&
            researcher.trim() !== ""
        ) {

            researchers.add(
                researcher.trim().toLowerCase()
            );

        }

    });


    researcherCountCard.textContent =
        researchers.size;

}


// --------------------------------------------------
// PERIOD CHART
// --------------------------------------------------

function createPeriodChart(records) {

    const counts =
        periods.map(period => {

            return records.filter(record =>

                record["Collection Period"] ===
                period.table

            ).length;

        });


    const canvas =
        document.getElementById(
            "periodChart"
        );


    periodChart =
        new Chart(canvas, {

            type: "bar",

            data: {

                labels:
                    periods.map(
                        period => period.label
                    ),

                datasets: [

                    {

                        label:
                            "Research Records",

                        data:
                            counts

                    }

                ]

            },


            options: {

                responsive: true,

                maintainAspectRatio: false,

                scales: {

                    y: {

                        beginAtZero: true,

                        ticks: {

                            precision: 0

                        }

                    }

                },

                plugins: {

                    legend: {

                        display: false

                    }

                }

            }

        });

}


// --------------------------------------------------
// CATEGORY CHART
// --------------------------------------------------

function createCategoryChart(records) {

    const counts =
        categories.map(category => {

            return records.filter(record =>

                record["Identified Category"] ===
                category

            ).length;

        });


    const canvas =
        document.getElementById(
            "categoryChart"
        );


    categoryChart =
        new Chart(canvas, {

            type: "bar",

            data: {

                labels:
                    categories,

                datasets: [

                    {

                        label:
                            "Records",

                        data:
                            counts

                    }

                ]

            },


            options: {

                indexAxis: "y",

                responsive: true,

                maintainAspectRatio: false,

                scales: {

                    x: {

                        beginAtZero: true,

                        ticks: {

                            precision: 0

                        }

                    }

                },

                plugins: {

                    legend: {

                        display: false

                    }

                }

            }

        });

}


// --------------------------------------------------
// CATEGORY STATISTICS TABLE
// --------------------------------------------------

function createCategoryStatistics(records) {

    categoryStatistics.innerHTML = "";


    const total =
        records.length;


    categories.forEach(category => {

        const count =
            records.filter(record =>

                record["Identified Category"] ===
                category

            ).length;


        const percentage =
            total > 0
                ? (
                    (count / total) * 100
                  ).toFixed(1)
                : "0.0";


        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                ${escapeHTML(category)}
            </td>

            <td>
                ${count}
            </td>

            <td>
                ${percentage}%
            </td>

        `;


        categoryStatistics.appendChild(row);

    });

}


// --------------------------------------------------
// RESEARCHER STATISTICS
// --------------------------------------------------

function createResearcherStatistics(records) {

    researcherStatistics.innerHTML = "";


    const researcherCounts = {};


    records.forEach(record => {

        const rawName =
            record["Collected By"];


        if (!rawName) {
            return;
        }


        const name =
            rawName.trim();


        if (!name) {
            return;
        }


        researcherCounts[name] =
            (researcherCounts[name] || 0) + 1;

    });


    const sortedResearchers =
        Object.entries(researcherCounts)
            .sort(
                (a, b) =>
                    b[1] - a[1]
            );


    if (
        sortedResearchers.length === 0
    ) {

        researcherStatistics.innerHTML = `

            <tr>

                <td colspan="2">
                    No researcher data available.
                </td>

            </tr>

        `;

        return;

    }


    sortedResearchers.forEach(
        ([researcher, count]) => {

            const row =
                document.createElement("tr");


            row.innerHTML = `

                <td>
                    ${escapeHTML(researcher)}
                </td>

                <td>
                    ${count}
                </td>

            `;


            researcherStatistics
                .appendChild(row);

        }
    );

}


// --------------------------------------------------
// SAFE OUTPUT
// --------------------------------------------------

function escapeHTML(value) {

    return String(value)

        .replaceAll("&", "&amp;")

        .replaceAll("<", "&lt;")

        .replaceAll(">", "&gt;")

        .replaceAll('"', "&quot;")

        .replaceAll("'", "&#039;");

}


// --------------------------------------------------
// START
// --------------------------------------------------

loadAnalytics();