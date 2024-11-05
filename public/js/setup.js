document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("sb-access-token");
    if (!token) {
        window.location.href = "/login?message=no_token";
        return;
    }
    loadCurrentConfig();
});

async function loadCurrentConfig() {
    try {
        const response = await fetch("/admin/config", {
            headers: {
                Authorization: `Bearer ${localStorage.getItem(
                    "sb-access-token"
                )}`,
            },
        });

        if (!response.ok) throw new Error("Failed to fetch config");

        const config = await response.json();
        document.getElementById("ratingSystem").value = config.rating_system;
    } catch (error) {
        console.error("Error loading config:", error);
        if (error.message.includes("401")) {
            window.location.href = "/login";
        }
    }
}

async function saveSetup(event) {
    event.preventDefault();
    const ratingSystem = document.getElementById("ratingSystem").value;

    try {
        const response = await fetch("/admin/config", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem(
                    "sb-access-token"
                )}`,
            },
            body: JSON.stringify({
                rating_system: ratingSystem,
            }),
        });

        if (!response.ok) throw new Error("Failed to save config");

        alert("Configuration saved successfully!");
    } catch (error) {
        console.error("Error saving config:", error);
        alert("Failed to save configuration");
    }
}

// Logout handler
document.getElementById("logout").onclick = async () => {
    localStorage.removeItem("sb-access-token");
    document.cookie =
        "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    await fetch("/logout", { method: "POST" });
    window.location.href = "/";
};
