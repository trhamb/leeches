// Pagination Variables
let currentPage = 1;
const entriesPerPage = 25;
let allFeedbackData = [];
let filteredData = [];

function handleAuthError(error) {
    // Check if token exists
    const token = localStorage.getItem("sb-access-token");
    if (!token) {
        window.location.href = "/login?message=no_token";
        return;
    }

    // Check for specific error types
    if (
        error.message.includes("401") ||
        error.message.includes("Failed to fetch") ||
        error.message.includes("Network Error")
    ) {
        localStorage.removeItem("sb-access-token");
        window.location.href = "/login?message=session_expired";
        return;
    }
}

function displayTypeCount(data, elementId) {
    const ratingLabels = {
        5: "Very Happy / 5 Stars",
        4: "Happy / 4 Stars",
        3: "Neutral / 3 Stars",
        2: "Unhappy / 2 Stars",
        1: "Very Unhappy / 1 Star",
    };

    const container = document.getElementById(elementId);
    container.innerHTML = Object.entries(data)
        .map(
            ([value, count]) => `
            <div class="type-count">
                <span class="type">${ratingLabels[value]}:</span>
                <span class="count">${count}</span>
            </div>
        `
        )
        .join("");
}

function displayFeedbackTable(data) {
    console.log("Feedback entries:", data);
    const tbody = document.getElementById("feedbackTableBody");
    tbody.innerHTML = "";

    const start = (currentPage - 1) * entriesPerPage;
    const end = start + entriesPerPage;
    const pageData = data.slice(start, end);

    pageData.forEach((entry) => {
        const row = document.createElement("tr");
        const formattedFeedback = formatFeedbackDisplay(
            entry.feedback,
            entry.feedback_type
        );
        row.innerHTML = `
            <td>${new Date(entry.created_at).toLocaleString()}</td>
            <td>${formattedFeedback}</td>
            <td>${entry.tag}</td>
        `;
        tbody.appendChild(row);
    });

    // Update pagination info
    const totalPages = Math.ceil(data.length / entriesPerPage);
    document.getElementById(
        "pageInfo"
    ).textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById("prevPage").disabled = currentPage === 1;
    document.getElementById("nextPage").disabled = currentPage === totalPages;
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

function formatFeedbackDisplay(value, type) {
    if (type === "stars") {
        return `${value} Stars`;
    } else {
        const smileyMap = {
            5: "Very Happy",
            4: "Happy",
            3: "Neutral",
            2: "Unhappy",
            1: "Very Unhappy",
        };
        return smileyMap[value];
    }
}

// Modify the existing loadDashboard function to include table initialization
async function loadDashboard() {
    try {
        const response = await fetch("/admin/stats", {
            headers: {
                Authorization: `Bearer ${localStorage.getItem(
                    "sb-access-token"
                )}`,
            },
        });
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
                Authorization: `Bearer ${localStorage.getItem(
                    "sb-access-token"
                )}`,
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
    localStorage.removeItem("sb-access-token");
    document.cookie =
        "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
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
