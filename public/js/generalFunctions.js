// Logout user
document.getElementById("logout").onclick = async () => {
    localStorage.removeItem("sb-access-token");
    document.cookie =
        "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    await fetch("/logout", { method: "POST" });
    window.location.href = "/";
};
