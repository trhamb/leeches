document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("sb-access-token");
    if (!token) {
        window.location.href = "/login?message=no_token";
        return;
    }
});

const ratingLabels = {
    5: "Very Satisfied",
    4: "Satisfied",
    3: "Neutral",
    2: "Unsatisfied",
    1: "Very Unsatisfied",
};

async function loadCharts() {
    try {
        const response = await fetch("/admin/stats", {
            headers: {
                Authorization: `Bearer ${localStorage.getItem(
                    "sb-access-token"
                )}`,
            },
        });

        if (!response.ok) {
            throw new Error("Failed to fetch stats");
        }

        const stats = await response.json();
        document.getElementById("currentTagDisplay").textContent =
            stats.currentTag || "No tag set";

        // All time feedback chart
        if (stats.total && Object.keys(stats.total).length > 0) {
            const ctx1 = document
                .getElementById("feedbackChart")
                .getContext("2d");
            new Chart(ctx1, {
                type: "bar",
                data: {
                    labels: Object.keys(stats.total)
                        .reverse()
                        .map((key) => ratingLabels[key]),
                    datasets: [
                        {
                            data: Object.values(stats.total).reverse(),
                            backgroundColor: [
                                "rgba(54, 162, 235, 0.8)",
                                "rgba(75, 192, 192, 0.8)",
                                "rgba(255, 206, 86, 0.8)",
                                "rgba(255, 99, 132, 0.8)",
                                "rgba(153, 102, 255, 0.8)",
                            ],
                        },
                    ],
                },
                // Add this to both chart configurations in the options section:
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false,
                        },
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                        },
                        x: {
                            ticks: {
                                align: "center",
                                textAlign: "center",
                            },
                        },
                    },
                },
            });
        }

        // Current tag feedback chart
        const currentTagData = {
            5: 0,
            4: 0,
            3: 0,
            2: 0,
            1: 0,
        };

        if (stats.allFeedback && stats.allFeedback.length > 0) {
            const currentTagFeedback = stats.allFeedback.filter(
                (entry) => entry.tag === stats.currentTag
            );

            currentTagFeedback.forEach((entry) => {
                currentTagData[entry.feedback]++;
            });

            const ctx2 = document
                .getElementById("currentTagChart")
                .getContext("2d");
            new Chart(ctx2, {
                type: "bar",
                data: {
                    labels: Object.keys(currentTagData)
                        .reverse()
                        .map((key) => ratingLabels[key]),
                    datasets: [
                        {
                            data: Object.values(currentTagData).reverse(),
                            backgroundColor: [
                                "rgba(54, 162, 235, 0.8)",
                                "rgba(75, 192, 192, 0.8)",
                                "rgba(255, 206, 86, 0.8)",
                                "rgba(255, 99, 132, 0.8)",
                                "rgba(153, 102, 255, 0.8)",
                            ],
                        },
                    ],
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false,
                        },
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                        },
                    },
                },
            });
        } else {
            document.getElementById("currentTagChart").innerHTML =
                "<p>No feedback data available for current tag</p>";
        }
    } catch (error) {
        console.error("Error loading charts:", error);
        document.getElementById("currentTagDisplay").textContent =
            "Error loading data";
        if (error.message.includes("401")) {
            window.location.href = "/login";
        }
    }
}

async function initializeReportControls() {
    try {
        // Fetch tags for dropdown
        const response = await fetch("/admin/stats", {
            headers: {
                Authorization: `Bearer ${localStorage.getItem(
                    "sb-access-token"
                )}`,
            },
        });

        if (!response.ok) {
            throw new Error("Failed to fetch stats");
        }

        const stats = await response.json();

        const tagSelect = document.getElementById("tagSelect");
        if (stats.existingTags && stats.existingTags.length > 0) {
            stats.existingTags.forEach((tag) => {
                const option = document.createElement("option");
                option.value = tag.tag_name;
                option.textContent = tag.tag_name;
                tagSelect.appendChild(option);
            });
        } else {
            const option = document.createElement("option");
            option.textContent = "No tags available";
            tagSelect.appendChild(option);
        }

        // Set default dates (last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        document.getElementById("endDate").value = endDate
            .toISOString()
            .split("T")[0];
        document.getElementById("startDate").value = startDate
            .toISOString()
            .split("T")[0];
    } catch (error) {
        console.error("Error initializing reports:", error);
        handleAuthError(error);
        // Provide user feedback
        document.getElementById("tagSelect").innerHTML =
            "<option>Error loading tags</option>";
        // Redirect to login if authentication failed
        if (error.message.includes("401")) {
            window.location.href = "/login";
        }
    }
}

document
    .getElementById("generateReport")
    .addEventListener("click", async () => {
        const tag = document.getElementById("tagSelect").value;

        // Add this validation check
        if (!tag || tag === "Select Tag...") {
            alert("Please select a tag before generating the report");
            return;
        }

        const generateButton = document.getElementById("generateReport");
        generateButton.disabled = true;
        generateButton.textContent = "Generating...";

        const startDate = document.getElementById("startDate").value;
        const endDate = document.getElementById("endDate").value;
        const format = document.getElementById("exportFormat").value;

        try {
            const response = await fetch("/reports/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem(
                        "sb-access-token"
                    )}`,
                },
                body: JSON.stringify({
                    tag,
                    startDate,
                    endDate,
                    format,
                }),
            });

            if (!response.ok) throw new Error("Report generation failed");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const fileExtension = format === "excel" ? "xlsx" : "csv";
            a.download = `feedback-report-${tag}-${startDate}-${endDate}.${fileExtension}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error generating report:", error);
            alert("Failed to generate report");
        } finally {
            generateButton.disabled = false;
            generateButton.textContent = "Generate Report";
        }
    });

document.addEventListener("DOMContentLoaded", () => {
    loadCharts();
    initializeReportControls();
});
