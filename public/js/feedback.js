document.querySelectorAll(".feedback img").forEach((img) => {
    img.addEventListener("click", async (event) => {
        const feedbackMap = {
            "feedback-5": "Very Happy",
            "feedback-4": "Happy",
            "feedback-3": "Neutral",
            "feedback-2": "Unhappy",
            "feedback-1": "Very Unhappy",
        };

        const feedbackValue = feedbackMap[event.target.id];

        try {
            const response = await fetch("/submit-feedback", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ feedback: feedbackValue }),
            });

            if (!response.ok) {
                throw new Error("Failed to submit feedback");
            }

            // Disable feedback buttons
            document.querySelectorAll(".feedback img").forEach((img) => {
                img.style.pointerEvents = "none";
            });

            // Show the pop-up
            const popup = document.getElementById("feedback-popup");
            popup.style.display = "block";

            // Hide the pop-up after 5 seconds and re-enable buttons
            setTimeout(() => {
                popup.style.display = "none";
                document.querySelectorAll(".feedback img").forEach((img) => {
                    img.style.pointerEvents = "auto";
                });
            }, 5000); // 5000 milliseconds = 5 seconds
        } catch (error) {
            console.error("Error:", error);
            alert("Error submitting feedback");
        }
    });

    // Make the function available in the global scope
    window.speakText = function (text) {
        const speech = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(speech);
    };
});

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
        // Session invalid or expired - PIN overlay stays visible
        console.log("New session required");
    }
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
