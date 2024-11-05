let currentRatingSystem = "smileys";

async function loadConfiguration() {
    try {
        const response = await fetch("/config");
        if (!response.ok) throw new Error("Failed to fetch configuration");

        const config = await response.json();
        console.log("Loaded config:", config);

        // Set the prompt text
        const promptElement = document.getElementById("feedbackPrompt");
        promptElement.textContent =
            config.prompt_text || "How do you feel about SSW?";
        promptElement.onclick = () => speakText(promptElement.textContent);

        // Show appropriate rating system
        currentRatingSystem = config.rating_system;
        document.getElementById("smileyRating").style.display =
            config.rating_system === "smileys" ? "flex" : "none";
        document.getElementById("starRating").style.display =
            config.rating_system === "stars" ? "flex" : "none";
    } catch (error) {
        console.error("Error loading configuration:", error);
        document.getElementById("feedbackPrompt").textContent =
            "How do you feel about SSW?";
    }
}

// Star rating handlers
document.querySelectorAll("#starRating .star").forEach((star, index) => {
    star.addEventListener("click", (e) => {
        const stars = document.querySelectorAll("#starRating .star");
        const clickedIndex = Array.from(stars).indexOf(star);

        stars.forEach((s, i) => {
            const path = s.querySelector("path");
            if (i <= clickedIndex) {
                path.style.fill = "#FFD700"; // Gold color
                path.style.stroke = "#FFA000"; // Darker gold outline
            } else {
                path.style.fill = "#e0e0e0"; // Default gray
                path.style.stroke = "#bdbdbd"; // Default outline
            }
        });

        const event = { target: { id: star.id } };
        handleFeedbackSubmission(event);
    });
});

// Smiley rating handlers
document.querySelectorAll("#smileyRating img").forEach((img) => {
    img.addEventListener("click", handleFeedbackSubmission);
});

async function handleFeedbackSubmission(event) {
    const feedbackMap = {
        smileys: {
            "feedback-5": "5",
            "feedback-4": "4",
            "feedback-3": "3",
            "feedback-2": "2",
            "feedback-1": "1",
        },
        stars: {
            "star-1": "1",
            "star-2": "2",
            "star-3": "3",
            "star-4": "4",
            "star-5": "5",
        },
    };

    const feedbackValue = feedbackMap[currentRatingSystem][event.target.id];

    try {
        const response = await fetch("/submit-feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                feedback: feedbackValue,
                feedbackType: currentRatingSystem,
            }),
        });

        if (!response.ok) throw new Error("Failed to submit feedback");

        // Disable feedback buttons
        const ratingContainer = document.getElementById(
            currentRatingSystem === "smileys" ? "smileyRating" : "starRating"
        );
        ratingContainer.querySelectorAll("img, .star").forEach((el) => {
            el.style.pointerEvents = "none";
        });

        // Show success popup
        const popup = document.getElementById("feedback-popup");
        popup.style.display = "block";

        // Reset after timeout
        setTimeout(() => {
            popup.style.display = "none";
            ratingContainer.querySelectorAll("img, .star").forEach((el) => {
                el.style.pointerEvents = "auto";
                // Reset star colors
                if (el.classList.contains("star")) {
                    const path = el.querySelector("path");
                    path.style.fill = "#e0e0e0";
                    path.style.stroke = "#bdbdbd";
                }
            });
        }, 3500);
    } catch (error) {
        console.error("Error:", error);
        alert("Error submitting feedback");
    }
}

// Check for existing session on page load
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch("/check-session", {
            method: "GET",
            credentials: "include",
        });

        if (response.ok) {
            document.getElementById("pin-overlay").style.display = "none";
            document.querySelector(".site-container").style.display = "flex";
        }
    } catch (error) {
        console.log("New session required");
    }
    loadConfiguration();
});

async function validatePin() {
    const pinInput = document.getElementById("pin-input").value;

    try {
        const response = await fetch("/validate-pin", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ pin: pinInput }),
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById("pin-overlay").style.display = "none";
            document.querySelector(".site-container").style.display = "flex";
        } else {
            alert("Invalid PIN");
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Error validating PIN");
    }
}
