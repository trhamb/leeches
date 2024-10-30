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
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/admin", checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, "protected", "admin.html"));
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) return res.status(400).send(error.message);
    res.status(200).send(data.user);
});

app.post("/submit-feedback", async (req, res) => {
    const { feedback } = req.body;

    try {
        const { data: settings } = await supabase
            .from("event_tags")
            .select("tag_name")
            .eq("is_current", true)
            .single();

        const { data, error } = await supabase.from("feedback").insert([
            {
                feedback,
                tag: settings?.tag_name || "untagged",
            },
        ]);

        if (error) throw error;
        res.status(200).send("Feedback submitted successfully");
    } catch (error) {
        console.error("Error inserting feedback:", error);
        res.status(500).send("Error submitting feedback");
    }
});

app.get("/admin/stats", checkAuth, async (req, res) => {
    try {
        const { data: allFeedback } = await supabase
            .from("feedback")
            .select("*")
            .order("created_at", { ascending: false });

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

        const { data: currentTag } = await supabase
            .from("event_tags")
            .select("tag_name")
            .eq("is_current", true)
            .single();

        const { data: existingTags } = await supabase
            .from("event_tags")
            .select("tag_name")
            .order("tag_name", { ascending: true });

        res.json({
            total: totalByType,
            today: todayByType,
            currentTag: currentTag?.tag_name || "No tag set",
            recentFeedback: allFeedback.slice(0, 10),
            existingTags: existingTags,
            allFeedback: allFeedback,
        });
    } catch (error) {
        console.error("Full error details:", error);
        res.status(500).send("Error fetching stats");
    }
});

app.post("/admin/update-tag", checkAuth, async (req, res) => {
    const { tag, isNew } = req.body;

    try {
        if (isNew) {
            const { data: existing } = await supabase
                .from("event_tags")
                .select("tag_name")
                .eq("tag_name", tag)
                .single();

            if (existing) {
                return res.json({
                    success: false,
                    message:
                        "Tag already exists. Please select it from the dropdown.",
                });
            }

            await supabase
                .from("event_tags")
                .insert([{ tag_name: tag, is_current: true }]);
        }

        await supabase
            .from("event_tags")
            .update({ is_current: false })
            .neq("tag_name", tag);

        await supabase
            .from("event_tags")
            .update({ is_current: true })
            .eq("tag_name", tag);

        res.json({
            success: true,
            tag,
            isNew,
            message: `Tag ${isNew ? "created and" : ""}set successfully!`,
        });
    } catch (error) {
        console.error("Error updating tag:", error);
        res.status(500).send("Error updating tag");
    }
});

app.post("/logout", async (req, res) => {
    const { error } = await supabase.auth.signOut();
    if (error) return res.status(400).send(error.message);
    res.status(200).send("Logged out");
});

app.get("/session", async (req, res) => {
    const { user } = supabase.auth.api.getUserByCookie(req);
    if (user) {
        res.status(200).send(user);
    } else {
        res.status(401).send("Unauthorized");
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
