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

        // Populate dropdown with existing tags
        const select = document.getElementById("eventTag");
        stats.existingTags.forEach((tag) => {
            const option = document.createElement("option");
            option.value = tag.tag_name;
            option.textContent = tag.tag_name;
            select.appendChild(option);
        });

        displayFeedback(stats.recentFeedback);
    } catch (error) {
        console.error("Error loading dashboard:", error);
    }
}

async function updateEventTag() {
    const existingTag = document.getElementById("eventTag").value;
    const newTag = document.getElementById("newEventTag").value;
    const tagToUse = existingTag || newTag;

    if (!tagToUse) {
        alert("Please either select an existing tag or enter a new one");
        return;
    }

    try {
        const response = await fetch("/admin/update-tag", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                tag: tagToUse,
                isNew: Boolean(newTag),
            }),
        });

        if (response.ok) {
            const result = await response.json();
            document.getElementById("currentTag").textContent = result.tag;
            document.getElementById("newEventTag").value = "";
            document.getElementById("eventTag").value = "";

            if (result.isNew) {
                // Add new tag to dropdown
                const select = document.getElementById("eventTag");
                const option = document.createElement("option");
                option.value = result.tag;
                option.textContent = result.tag;
                select.appendChild(option);
            }

            alert(result.message);
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
