const express = require("express");
const cookieParser = require("cookie-parser");
const Excel = require("exceljs");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");

const app = express();
const port = 3000;

// Supabase Client
const supabaseUrl = "https://tqwsfxhgwenldhvksyzc.supabase.co";
const supabaseKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxd3NmeGhnd2VubGRodmtzeXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk4NDg2NDksImV4cCI6MjA0NTQyNDY0OX0.SCI6fzWNoKZ6IkpjIwH83VY6vPU5XwJqF0arh-9q3BI";
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(
    express.static(path.join(__dirname, "public"), {
        maxAge: "1h",
        setHeaders: (res, path) => {
            if (path.endsWith(".css")) {
                res.setHeader("Content-Type", "text/css");
            }
        },
    })
);

app.use(express.json());

app.use(cookieParser());

const checkAuth = async (req, res, next) => {
    // For API routes, check Authorization header
    if (req.path.startsWith("/admin/") || req.path.startsWith("/reports/")) {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: "Invalid token" });
        }
    }
    // For page routes, check query parameter
    else {
        const token = req.query.token || req.cookies["sb-access-token"];
        if (!token) {
            return res.redirect("/login");
        }
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.redirect("/login");
        }
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

app.use(cookieParser());

// Update your login endpoint
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    console.log("Login attempt for email:", email);

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    console.log("Supabase response:", data);

    if (error) {
        console.log("Login error:", error);
        return res.status(400).send(error.message);
    }

    // Send the complete session data for debugging
    res.status(200).json(data);
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
            message: `Tag${isNew ? "created and" : ""} set successfully!`,
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

app.get("/reports", checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, "protected", "reports.html"));
});

app.post("/reports/generate", checkAuth, async (req, res) => {
    const { tag, startDate, endDate } = req.body;

    try {
        const { data: feedbackData } = await supabase
            .from("feedback")
            .select("*")
            .eq("tag", tag)
            .gte("created_at", startDate)
            .lte("created_at", endDate)
            .order("created_at", { ascending: true });

        // Create workbook and sheets
        const workbook = new Excel.Workbook();
        const summarySheet = workbook.addWorksheet("Summary");
        const rawDataSheet = workbook.addWorksheet("Raw Data");

        // Summary Sheet
        summarySheet.columns = [
            { header: "", width: 30 },
            { header: "", width: 25 },
            { header: "", width: 15 },
        ];

        // Add title
        summarySheet.getCell("A1").value = "Feedback Report Summary";
        summarySheet.getCell("A1").font = { bold: true, size: 14 };
        summarySheet.getCell("A1").alignment = { horizontal: "center" };

        // Add report details
        summarySheet.getCell("A3").value = "Tag:";
        summarySheet.getCell("B3").value = tag;
        summarySheet.getCell("A4").value = "Date Range:";
        summarySheet.getCell("B4").value = `${startDate} to ${endDate}`;
        summarySheet.getCell("A5").value = "Total Responses:";
        summarySheet.getCell("B5").value = feedbackData.length;

        // Add distribution title
        summarySheet.getCell("A7").value = "Feedback Distribution";
        summarySheet.getCell("A7").font = { bold: true, size: 12 };

        // Add distribution headers
        summarySheet.getCell("A9").value = "Response Type";
        summarySheet.getCell("B9").value = "Count";
        summarySheet.getCell("C9").value = "Percentage";
        ["A9", "B9", "C9"].forEach((cell) => {
            summarySheet.getCell(cell).font = { bold: true };
            summarySheet.getCell(cell).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE0E0E0" },
            };
        });

        // Add distribution data
        const feedbackTypes = [
            "Very Happy",
            "Happy",
            "Neutral",
            "Unhappy",
            "Very Unhappy",
        ];
        feedbackTypes.forEach((type, index) => {
            const count = feedbackData.filter(
                (f) => f.feedback === type
            ).length;
            const percentage = ((count / feedbackData.length) * 100).toFixed(1);

            summarySheet.getCell(`A${10 + index}`).value = type;
            summarySheet.getCell(`B${10 + index}`).value = count;
            summarySheet.getCell(`C${10 + index}`).value = `${percentage}%`;
        });

        // Raw Data Sheet
        rawDataSheet.columns = [
            { header: "Feedback", key: "feedback", width: 32 },
            { header: "Tag", key: "tag", width: 14 },
            { header: "Date", key: "date", width: 15 },
        ];

        // Style headers
        rawDataSheet.getRow(1).font = { bold: true };
        rawDataSheet.getRow(1).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE0E0E0" },
        };

        // Add data
        feedbackData.forEach((entry) => {
            rawDataSheet.addRow({
                feedback: entry.feedback,
                tag: entry.tag,
                date: new Date(entry.created_at).toLocaleDateString(),
            });
        });

        // Center align all cells
        [summarySheet, rawDataSheet].forEach((sheet) => {
            sheet.eachRow((row) => {
                row.eachCell((cell) => {
                    cell.alignment = {
                        horizontal: "center",
                        vertical: "middle",
                    };
                });
            });
        });

        // Generate and send file
        const buffer = await workbook.xlsx.writeBuffer();

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=feedback-report-${tag}-${startDate}.xlsx`
        );
        res.send(buffer);
    } catch (error) {
        console.error("Error generating report:", error);
        res.status(500).send("Error generating report");
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
