document.getElementById("login-form").onsubmit = async (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const response = await fetch("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
        });

        console.log("Response status:", response.status);

        if (response.ok) {
            const data = await response.json();
            const token = data.session.access_token;
            localStorage.setItem("sb-access-token", token);
            document.cookie = `sb-access-token=${token}; path=/`;
            window.location.href = "/admin";
        } else {
            const errorData = await response.text();
            console.log("Login failed:", errorData);
            alert("Login failed!");
        }
    } catch (error) {
        console.error("Error logging in:", error);
        alert("An error occurred. Please try again.");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("message") === "session_expired") {
        alert("Your session has expired. Please log in again.");
    }
});
