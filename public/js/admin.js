// Pagination Variables
let currentPage = 1;
const entriesPerPage = 25;
let allFeedbackData = [];
let filteredData = [];

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

function displayFeedbackTable(data) {
    const tbody = document.getElementById("feedbackTableBody");
    tbody.innerHTML = "";

    const start = (currentPage - 1) * entriesPerPage;
    const end = start + entriesPerPage;
    const pageData = data.slice(start, end);

    pageData.forEach((entry) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${new Date(entry.created_at).toLocaleString()}</td>
            <td>${entry.feedback}</td>
            <td>${entry.tag}</td>
        `;
        tbody.appendChild(row);
    });

    // Update pagination info
    const totalPages = Math.ceil(data.length / entriesPerPage);
    document.getElementById(
        "pageInfo"
    ).textContent = `Page ${currentPage} of ${totalPages}`;

    // Update button states
    document.getElementById("prevPage").disabled = currentPage === 1;
    document.getElementById("nextPage").disabled = currentPage === totalPages;

    // Total count
    document.getElementById(
        "totalCount"
    ).textContent = `Total Entries: ${data.length}`;
}

// Add this function to handle filtering
function applyFilters() {
    const dateFilter = document.getElementById("dateFilter").value;
    const feedbackFilter = document.getElementById("feedbackFilter").value;
    const tagFilter = document.getElementById("tagFilter").value;

    filteredData = allFeedbackData.filter((entry) => {
        const matchesDate =
            !dateFilter || entry.created_at.startsWith(dateFilter);
        const matchesFeedback =
            !feedbackFilter || entry.feedback === feedbackFilter;
        const matchesTag = !tagFilter || entry.tag === tagFilter;
        return matchesDate && matchesFeedback && matchesTag;
    });

    currentPage = 1;
    displayFeedbackTable(filteredData);
}

// Modify the existing loadDashboard function to include table initialization
async function loadDashboard() {
    try {
        const response = await fetch("/admin/stats");
        const stats = await response.json();

        displayTypeCount(stats.today, "todayFeedback");
        document.getElementById("currentTag").textContent = stats.currentTag;

        // Populate dropdown with existing tags
        const select = document.getElementById("eventTag");
        const tagFilter = document.getElementById("tagFilter");
        stats.existingTags.forEach((tag) => {
            const option = document.createElement("option");
            option.value = tag.tag_name;
            option.textContent = tag.tag_name;
            select.appendChild(option);

            const filterOption = option.cloneNode(true);
            tagFilter.appendChild(filterOption);
        });

        // Store all feedback data and initialize table
        allFeedbackData = stats.allFeedback;
        filteredData = allFeedbackData;
        displayFeedbackTable(filteredData);
    } catch (error) {
        console.error("Error loading dashboard:", error);
    }
}

async function updateEventTag() {
    const existingTag = document.getElementById("eventTag").value;
    const newTag = document.getElementById("newEventTag").value;
    const tagToUse = existingTag || newTag;
    const currentTag = document.getElementById("currentTag").textContent;

    if (!tagToUse) {
        alert("Please select an existing tag or enter a new one");
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

        const result = await response.json();

        if (result.success) {
            document.getElementById("currentTag").textContent = result.tag;
            document.getElementById("newEventTag").value = "";
            document.getElementById("eventTag").value = "";

            if (result.isNew) {
                const select = document.getElementById("eventTag");
                const option = document.createElement("option");
                option.value = result.tag;
                option.textContent = result.tag;
                select.appendChild(option);
            }

            alert(result.message);
        } else {
            // Keep the current tag if update failed
            document.getElementById("currentTag").textContent = currentTag;
            alert(result.message);
        }
    } catch (error) {
        console.error("Error updating tag:", error);
        // Keep the current tag on error
        document.getElementById("currentTag").textContent = currentTag;
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

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("prevPage").addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            displayFeedbackTable(filteredData);
        }
    });

    document.getElementById("nextPage").addEventListener("click", () => {
        const totalPages = Math.ceil(filteredData.length / entriesPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            displayFeedbackTable(filteredData);
        }
    });

    // Add filter event listeners
    document
        .getElementById("dateFilter")
        .addEventListener("change", applyFilters);
    document
        .getElementById("feedbackFilter")
        .addEventListener("change", applyFilters);
    document
        .getElementById("tagFilter")
        .addEventListener("change", applyFilters);
});

// Initialize dashboard on page load
loadDashboard();
