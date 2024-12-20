const express = require("express");
const cookieParser = require("cookie-parser");
const Excel = require("exceljs");
const QuickChart = require("quickchart-js");
const sessionManager = require("./custom_modules/sessionManager");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");
const fetch = require("node-fetch");

require("dotenv").config();

const app = express();
const port = 3000;
const VALID_PIN = process.env.VALID_PIN;

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
    const token = req.cookies["sb-access-token"];
    if (!token) {
        return res.redirect("/login");
    }
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser(token);
    if (error || !user) {
        res.clearCookie("sb-access-token");
        return res.redirect("/login");
    }
    next();
};

app.get("/session", async (req, res) => {
    const { user } = supabase.auth.api.getUserByCookie(req);
    if (user) {
        res.status(200).send(user);
    } else {
        res.status(401).send("Unauthorized");
    }
});

const checkFeedbackSession = (req, res, next) => {
    const sessionId = req.cookies["feedback-session"];
    if (!sessionManager.validateSession(sessionId)) {
        return res.status(401).json({ error: "Invalid or expired session" });
    }
    next();
};

app.post("/validate-pin", (req, res) => {
    const { pin } = req.body;
    if (pin === VALID_PIN) {
        const sessionToken = sessionManager.createSession(req.ip);
        res.cookie("feedback-session", sessionToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
        });
        res.json({ success: true });
    } else {
        res.status(401).json({ error: "Invalid PIN" });
    }
});

app.get("/check-session", checkFeedbackSession, (req, res) => {
    res.json({ valid: true });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/admin", checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, "protected", "admin.html"));
});

app.get("/reports", checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, "protected", "reports.html"));
});

app.get("/setup", checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, "protected", "setup.html"));
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

    if (error) {
        console.log("Login error:", error);
        return res.status(400).send(error.message);
    }

    // Send the complete session data for debugging
    res.status(200).json(data);
});

// Submit Feedback
app.post("/submit-feedback", checkFeedbackSession, async (req, res) => {
    const { feedback, feedbackType } = req.body;
    try {
        const { data: settings } = await supabase
            .from("event_tags")
            .select("tag_name")
            .eq("is_current", true)
            .single();

        const { data, error } = await supabase.from("feedback").insert([
            {
                feedback,
                feedback_type: feedbackType,
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

// Admin Stats
app.get("/admin/stats", checkAuth, async (req, res) => {
    try {
        const { data: allFeedback } = await supabase
            .from("feedback")
            .select("*")
            .order("created_at", { ascending: false });

        const totalByType = {
            5: allFeedback.filter((f) => f.feedback === "5").length,
            4: allFeedback.filter((f) => f.feedback === "4").length,
            3: allFeedback.filter((f) => f.feedback === "3").length,
            2: allFeedback.filter((f) => f.feedback === "2").length,
            1: allFeedback.filter((f) => f.feedback === "1").length,
        };

        const today = new Date().toISOString().split("T")[0];
        const todayFeedback = allFeedback.filter((entry) =>
            entry.created_at.startsWith(today)
        );

        const todayByType = {
            5: todayFeedback.filter((f) => f.feedback === "5").length,
            4: todayFeedback.filter((f) => f.feedback === "4").length,
            3: todayFeedback.filter((f) => f.feedback === "3").length,
            2: todayFeedback.filter((f) => f.feedback === "2").length,
            1: todayFeedback.filter((f) => f.feedback === "1").length,
        };

        // Get current config to know which feedback type is active
        const { data: currentConfig } = await supabase
            .from("feedback_config")
            .select("rating_system")
            .eq("is_active", true)
            .single();

        // Get current tag
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
            feedback_type: currentConfig?.rating_system || "smileys",
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

// Update Tag
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

// Generate Report
app.post("/reports/generate", checkAuth, async (req, res) => {
    const { tag, startDate, endDate, format } = req.body;
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setHours(23, 59, 59, 999);

    function formatFeedbackForReport(value) {
        const ratingLabels = {
            5: "Very Satisfied",
            4: "Satisfied",
            3: "Neutral",
            2: "Unsatisfied",
            1: "Very Unsatisfied",
        };
        return ratingLabels[value];
    }

    try {
        const feedbackTypes = ["5", "4", "3", "2", "1"];

        const { data: feedbackData } = await supabase
            .from("feedback")
            .select("*")
            .eq("tag", tag)
            .gte("created_at", startDate)
            .lte("created_at", adjustedEndDate.toISOString())
            .order("created_at", { ascending: true });

        // Handle CSV Export
        if (format === "csv") {
            const csvHeader = "Rating,Tag,Date\n";
            const csvRows = feedbackData
                .map((entry) => {
                    const formattedFeedback = formatFeedbackForReport(
                        entry.feedback
                    );
                    const date = new Date(
                        entry.created_at
                    ).toLocaleDateString();
                    return `${formattedFeedback},${entry.tag},${date}`;
                })
                .join("\n");

            const csvContent = csvHeader + csvRows;

            res.setHeader("Content-Type", "text/csv");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename=feedback-report-${tag}-${startDate}.csv`
            );
            res.send(csvContent);
            return;
        }

        // Handle Excel Export
        const chartData = feedbackTypes.map(
            (type) => feedbackData.filter((f) => f.feedback === type).length
        );

        // Create bar chart
        const barChart = new QuickChart();
        barChart.setWidth(800);
        barChart.setHeight(400);
        barChart.setVersion("2");
        barChart.setConfig({
            type: "bar",
            data: {
                labels: feedbackTypes.map((type) =>
                    formatFeedbackForReport(type)
                ),
                datasets: [
                    {
                        label: "Feedback Distribution",
                        data: chartData,
                        backgroundColor: [
                            "rgba(54, 162, 235, 0.8)",
                            "rgba(75, 192, 192, 0.8)",
                            "rgba(255, 206, 86, 0.8)",
                            "rgba(255, 99, 132, 0.8)",
                            "rgba(153, 102, 255, 0.8)",
                        ],
                    },
                ],
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        min: 0,
                        ticks: {
                            stepSize: 1,
                        },
                    },
                },
            },
        });

        // Create pie chart with percentages
        const pieChart = new QuickChart();
        pieChart.setWidth(800);
        pieChart.setHeight(400);
        pieChart.setVersion("2");
        pieChart.setConfig({
            type: "pie",
            data: {
                labels: feedbackTypes.map((type) =>
                    formatFeedbackForReport(type)
                ),
                datasets: [
                    {
                        data: feedbackTypes.map((type) => {
                            const count = feedbackData.filter(
                                (f) => f.feedback === type
                            ).length;
                            return (
                                (count / feedbackData.length) *
                                100
                            ).toFixed(1);
                        }),
                        backgroundColor: [
                            "rgba(54, 162, 235, 0.8)",
                            "rgba(75, 192, 192, 0.8)",
                            "rgba(255, 206, 86, 0.8)",
                            "rgba(255, 99, 132, 0.8)",
                            "rgba(153, 102, 255, 0.8)",
                        ],
                    },
                ],
            },
        });

        // Get both images
        const barResponse = await fetch(barChart.getUrl());
        const pieResponse = await fetch(pieChart.getUrl());
        const barImageBuffer = await barResponse.buffer();
        const pieImageBuffer = await pieResponse.buffer();

        // Create workbook and sheets
        const workbook = new Excel.Workbook();
        const summarySheet = workbook.addWorksheet("Summary");
        const rawDataSheet = workbook.addWorksheet("Raw Data");

        // Add both images to workbook
        const barImageId = workbook.addImage({
            buffer: barImageBuffer,
            extension: "png",
        });

        const pieImageId = workbook.addImage({
            buffer: pieImageBuffer,
            extension: "png",
        });

        // Summary Sheet setup
        summarySheet.columns = [
            { header: "", width: 30 },
            { header: "", width: 25 },
            { header: "", width: 15 },
            { header: "", width: 10 },
            { header: "", width: 10 },
            { header: "", width: 2.45 },
            { header: "", width: 2.45 },
        ];

        // Add title with merged cells
        summarySheet.mergeCells("A1:C1");
        summarySheet.getCell("A1").value = "Feedback Report Summary";
        summarySheet.getCell("A1").font = { bold: true, size: 14 };
        summarySheet.getCell("A1").alignment = { horizontal: "center" };

        // Add report details
        summarySheet.mergeCells("B3:C3");
        summarySheet.mergeCells("B4:C4");
        summarySheet.mergeCells("B5:C5");
        summarySheet.getCell("A3").value = "Tag:";
        summarySheet.getCell("A3").font = { bold: true, size: 12 };
        summarySheet.getCell("B3").value = tag;
        summarySheet.getCell("A4").value = "Date Range:";
        summarySheet.getCell("A4").font = { bold: true, size: 12 };
        summarySheet.getCell("B4").value = `${startDate} to ${endDate}`;
        summarySheet.getCell("A5").value = "Total Responses:";
        summarySheet.getCell("A5").font = { bold: true, size: 12 };
        summarySheet.getCell("B5").value = feedbackData.length;

        // Set cell colours
        const cellColors = [
            "FF00B050", // Green
            "FF92D050", // Blue
            "FFFFFF00", // Yellow
            "FFFFC000", // Orange
            "FFFF0000", // Red
        ];

        feedbackTypes.forEach((type, index) => {
            const count = feedbackData.filter(
                (f) => f.feedback === type
            ).length;
            const percentage = ((count / feedbackData.length) * 100).toFixed(1);

            const rowNum = 10 + index;
            summarySheet.getCell(`A${rowNum}`).value =
                formatFeedbackForReport(type);
            summarySheet.getCell(`B${rowNum}`).value = count;
            summarySheet.getCell(`C${rowNum}`).value = `${percentage}%`;

            summarySheet.getCell(`A${rowNum}`).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: cellColors[index] },
            };
        });

        // Add distribution headers
        summarySheet.mergeCells("A8:C8");
        summarySheet.getCell("A8").value = "Feedback Distribution";
        summarySheet.getCell("A8").font = { bold: true, size: 12 };
        summarySheet.getCell("A8").alignment = { horizontal: "center" };

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
        feedbackTypes.forEach((type, index) => {
            const count = feedbackData.filter(
                (f) => f.feedback === type
            ).length;
            const percentage = ((count / feedbackData.length) * 100).toFixed(1);

            summarySheet.getCell(`A${10 + index}`).value =
                formatFeedbackForReport(type);
            summarySheet.getCell(`B${10 + index}`).value = count;
            summarySheet.getCell(`C${10 + index}`).value = `${percentage}%`;
        });

        // Add new section here
        summarySheet.mergeCells("A17:C17");
        summarySheet.getCell("A17").value = "Generalized Distribution";
        summarySheet.getCell("A17").font = { bold: true, size: 12 };
        summarySheet.getCell("A17").alignment = { horizontal: "center" };

        // Add column headers
        summarySheet.getCell("A18").value = "Response Type";
        summarySheet.getCell("B18").value = "Count";
        summarySheet.getCell("C18").value = "Percentage";
        ["A18", "B18", "C18"].forEach((cell) => {
            summarySheet.getCell(cell).font = { bold: true };
            summarySheet.getCell(cell).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE0E0E0" },
            };
        });

        // Calculate merged counts
        const goodCount = feedbackData.filter(
            (f) => f.feedback === "5" || f.feedback === "4"
        ).length;
        const neutralCount = feedbackData.filter(
            (f) => f.feedback === "3"
        ).length;
        const badCount = feedbackData.filter(
            (f) => f.feedback === "2" || f.feedback === "1"
        ).length;
        const total = feedbackData.length;

        // Add the generalized data
        const generalizedData = [
            { type: "Good", count: goodCount, color: "FF00B050" },
            { type: "Neutral", count: neutralCount, color: "FFFFFF00" },
            { type: "Bad", count: badCount, color: "FFFF0000" },
        ];

        generalizedData.forEach((item, index) => {
            const rowNum = 19 + index;
            const percentage = ((item.count / total) * 100).toFixed(1);

            summarySheet.getCell(`A${rowNum}`).value = item.type;
            summarySheet.getCell(`B${rowNum}`).value = item.count;
            summarySheet.getCell(`C${rowNum}`).value = `${percentage}%`;

            summarySheet.getCell(`A${rowNum}`).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: item.color },
            };
        });

        // Add both charts to sheet (side by side)
        summarySheet.addImage(barImageId, {
            tl: { col: 7, row: 1 },
            ext: { width: 600, height: 300 },
        });

        summarySheet.addImage(pieImageId, {
            tl: { col: 7, row: 18 },
            ext: { width: 600, height: 300 },
        });

        // Fill cells A16:Q33
        for (let row = 1; row <= 40; row++) {
            for (let col = 6; col <= 17; col++) {
                const cell = summarySheet.getCell(row, col);
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FF31869B" },
                };
            }
        }

        // Raw Data Sheet
        rawDataSheet.columns = [
            { header: "Rating", key: "feedback", width: 32 },
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
                feedback: formatFeedbackForReport(entry.feedback),
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

// ADMIN PAGE SETUP
app.get("/admin/config", checkAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("feedback_config")
            .select("*")
            .eq("is_active", true)
            .single();

        if (error) throw error;
        res.json(
            data || {
                prompt_text: "How do you feel about SSW?",
                rating_system: "smileys",
            }
        );
    } catch (error) {
        console.error("Error fetching config:", error);
        res.status(500).send("Error fetching configuration");
    }
});

// Admin Page Config
app.get("/config", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("feedback_config")
            .select("*")
            .eq("is_active", true)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error("Error fetching config:", error);
        res.status(500).send("Error fetching configuration");
    }
});

app.post("/admin/config", checkAuth, async (req, res) => {
    const { rating_system } = req.body;
    try {
        // Set the selected config to active
        const { error } = await supabase
            .from("feedback_config")
            .update({ is_active: true })
            .eq("rating_system", rating_system);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error("Error saving config:", error);
        res.status(500).send("Error saving configuration");
    }
});

// Logout
app.post("/logout", async (req, res) => {
    const { error } = await supabase.auth.signOut();
    if (error) return res.status(400).send(error.message);
    res.status(200).send("Logged out");
});

app.listen(port, () => {
    console.log(`Server now running on port ${port}`);
});
