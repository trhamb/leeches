const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");

const app = express();
const port = 3000;

// Supabase Client
const supabaseUrl = "https://tqwsfxhgwenldhvksyzc.supabase.co";
const supabaseKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxd3NmeGhnd2VubGRodmtzeXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk4NDg2NDksImV4cCI6MjA0NTQyNDY0OX0.SCI6fzWNoKZ6IkpjIwH83VY6vPU5XwJqF0arh-9q3BI";
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware to serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

app.use(express.json());

const checkAuth = async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.redirect("/login");
    }

    next();
};

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html")); // Serve the public page
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/admin", checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, "protected", "admin.html")); // Ensure this path matches the new location
});

// Login
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) return res.status(400).send(error.message);
    res.status(200).send(data.user);
});

// Submit Feedback
app.post("/submit-feedback", async (req, res) => {
    const { feedback } = req.body;

    try {
        // First get the current tag from settings
        const { data: settings } = await supabase
            .from("settings")
            .select("current_tag")
            .single();

        // Then insert feedback with the current tag
        const { data, error } = await supabase.from("feedback").insert([
            {
                feedback,
                tag: settings?.current_tag || "untagged",
            },
        ]);

        if (error) {
            throw error;
        }

        res.status(200).send("Feedback submitted successfully");
    } catch (error) {
        console.error("Error inserting feedback:", error);
        res.status(500).send("Error submitting feedback");
    }
});

// Get admin stats
app.get("/admin/stats", checkAuth, async (req, res) => {
    try {
        // Get all feedback entries
        const { data: allFeedback } = await supabase
            .from("feedback")
            .select("*");

        // Count by feedback type for all entries
        const totalByType = {
            "Very Happy": allFeedback.filter((f) => f.feedback === "Very Happy")
                .length,
            Happy: allFeedback.filter((f) => f.feedback === "Happy").length,
            Neutral: allFeedback.filter((f) => f.feedback === "Neutral").length,
            Unhappy: allFeedback.filter((f) => f.feedback === "Unhappy").length,
            "Very Unhappy": allFeedback.filter(
                (f) => f.feedback === "Very Unhappy"
            ).length,
        };

        // Get today's entries and count by type
        const today = new Date().toISOString().split("T")[0];
        const todayFeedback = allFeedback.filter((entry) =>
            entry.created_at.startsWith(today)
        );

        const todayByType = {
            "Very Happy": todayFeedback.filter(
                (f) => f.feedback === "Very Happy"
            ).length,
            Happy: todayFeedback.filter((f) => f.feedback === "Happy").length,
            Neutral: todayFeedback.filter((f) => f.feedback === "Neutral")
                .length,
            Unhappy: todayFeedback.filter((f) => f.feedback === "Unhappy")
                .length,
            "Very Unhappy": todayFeedback.filter(
                (f) => f.feedback === "Very Unhappy"
            ).length,
        };

        const { data: settings } = await supabase
            .from("settings")
            .select("current_tag")
            .single();

        res.json({
            total: totalByType,
            today: todayByType,
            currentTag: settings?.current_tag || "No tag set",
            recentFeedback: allFeedback.slice(0, 10),
        });
    } catch (error) {
        console.error("Full error details:", error);
        res.status(500).send("Error fetching stats");
    }
});

// Update event tag
app.post("/admin/update-tag", checkAuth, async (req, res) => {
    const { tag } = req.body;
    try {
        const { data, error } = await supabase
            .from("settings")
            .upsert({ id: 1, current_tag: tag })
            .single();

        if (error) throw error;
        res.json({ success: true, tag });
    } catch (error) {
        console.error("Error updating tag:", error);
        res.status(500).send("Error updating tag");
    }
});

// Logout
app.post("/logout", async (req, res) => {
    const { error } = await supabase.auth.signOut();
    if (error) return res.status(400).send(error.message);
    res.status(200).send("Logged out");
});

// Check session
app.get("/session", async (req, res) => {
    const { user } = supabase.auth.api.getUserByCookie(req);
    if (user) {
        res.status(200).send(user);
    } else {
        res.status(401).send("Unauthorized");
    }
});

// app.get("/private", checkAuth, (req, res) => {
//     res.sendFile("path_to_your_private_page.html");
// });

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
