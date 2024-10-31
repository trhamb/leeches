async function loadCharts() {
    const response = await fetch("/admin/stats");
    const stats = await response.json();

    console.log("Current tag:", stats.currentTag);
    document.getElementById("currentTagDisplay").textContent = stats.currentTag;

    // All time feedback chart
    const ctx1 = document.getElementById("feedbackChart").getContext("2d");
    new Chart(ctx1, {
        type: "bar",
        data: {
            labels: Object.keys(stats.total),
            datasets: [
                {
                    data: Object.values(stats.total),
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

    // Current tag feedback chart
    const currentTagData = {
        "Very Happy": 0,
        Happy: 0,
        Neutral: 0,
        Unhappy: 0,
        "Very Unhappy": 0,
    };

    stats.allFeedback
        .filter((entry) => entry.tag === stats.currentTag)
        .forEach((entry) => {
            currentTagData[entry.feedback]++;
        });

    const ctx2 = document.getElementById("currentTagChart").getContext("2d");
    new Chart(ctx2, {
        type: "bar",
        data: {
            labels: Object.keys(currentTagData),
            datasets: [
                {
                    data: Object.values(currentTagData),
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
}

async function initializeReportControls() {
    // Fetch tags for dropdown
    const response = await fetch("/admin/stats");
    const stats = await response.json();

    const tagSelect = document.getElementById("tagSelect");
    stats.existingTags.forEach((tag) => {
        const option = document.createElement("option");
        option.value = tag.tag_name;
        option.textContent = tag.tag_name;
        tagSelect.appendChild(option);
    });

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
}

document
    .getElementById("generateReport")
    .addEventListener("click", async () => {
        const tag = document.getElementById("tagSelect").value;
        const startDate = document.getElementById("startDate").value;
        const endDate = document.getElementById("endDate").value;
        const format = document.getElementById("exportFormat").value;

        try {
            const response = await fetch("/reports/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    tag,
                    startDate,
                    endDate,
                    format,
                }),
            });

            if (!response.ok) throw new Error("Report generation failed");

            // Handle file download
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
        }
    });

document.addEventListener("DOMContentLoaded", () => {
    loadCharts();
    initializeReportControls();
});

document.getElementById("logout").onclick = async () => {
    await fetch("/logout", { method: "POST" });
    window.location.href = "/";
};
