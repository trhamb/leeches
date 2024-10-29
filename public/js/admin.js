function displayTypeCount(data, elementId) {
    const container = document.getElementById(elementId);
    container.innerHTML = Object.entries(data)
        .map(
            ([type, count]) => `
            <div class="type-count">
                <span class="type">${type}:</span>
                <span class="count">${count}</span>
            </div>
        `
        )
        .join("");
}

async function loadDashboard() {
    try {
        const response = await fetch("/admin/stats");
        const stats = await response.json();

        displayTypeCount(stats.total, "totalFeedback");
        displayTypeCount(stats.today, "todayFeedback");
        document.getElementById("currentTag").textContent = stats.currentTag;

        displayFeedback(stats.recentFeedback);
    } catch (error) {
        console.error("Error loading dashboard:", error);
    }
}

async function updateEventTag() {
    const newTag = document.getElementById("eventTag").value;
    try {
        const response = await fetch("/admin/update-tag", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ tag: newTag }),
        });

        if (response.ok) {
            document.getElementById("currentTag").textContent = newTag;
            document.getElementById("eventTag").value = "";
            alert("Tag updated successfully!");
        }
    } catch (error) {
        console.error("Error updating tag:", error);
        alert("Failed to update tag");
    }
}

function displayFeedback(feedback) {
    const container = document.getElementById("feedbackEntries");
    container.innerHTML = feedback
        .map(
            (entry) => `
        <div class="solo-feedback">
            <p>${entry.feedback}</p>
            <small class="bold italic">${entry.tag} | Date: ${new Date(
                entry.created_at
            ).toLocaleString()}</small>
        </div>
    `
        )
        .join("");
}

// Logout handler
document.getElementById("logout").onclick = async () => {
    await fetch("/logout", { method: "POST" });
    window.location.href = "/";
};

// Initialize dashboard on page load
loadDashboard();
