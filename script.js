
"use strict";

// =====================================
// 1. HTML ELEMENTS
// =====================================

const grievanceForm = document.getElementById("grievanceForm");
const formMessage = document.getElementById("formMessage");
const grievanceTable = document.getElementById("grievanceTable");

const trackingForm = document.getElementById("trackingForm");
const trackingInput = document.getElementById("grievanceId");
const trackingResult = document.getElementById("trackingResult");

const searchInput = document.getElementById("search");
const categoryFilter = document.getElementById("filterCategory");
const statusFilter = document.getElementById("filterStatus");
const tableMessage = document.getElementById("tableMessage");

const adminLoginForm = document.getElementById("adminLoginForm");
const adminMessage = document.getElementById("adminMessage");
const adminLogoutButton = document.getElementById("adminLogout");

const dashboardSection = document.getElementById("dashboard");
const manageSection = document.getElementById("manage");
const adminSection = document.getElementById("admin");

const API_URL = "/api/grievances";

let grievances = [];
let isAdminLoggedIn = false;
let isLoading = false;

// =====================================
// 2. PAGE VISIBILITY
// =====================================

function updatePageVisibility() {
    // Dashboard and management are administrator-only.
    dashboardSection.hidden = !isAdminLoggedIn;
    manageSection.hidden = !isAdminLoggedIn;

    // Keep the grievance submission form and its links student-only.
    const submitSection = document.getElementById("submit");
    const submitNavItem = document.getElementById("submitNavItem");
    const submitHeroButton = document.getElementById("submitHeroButton");
    const submitFeatureCard = document.getElementById("submitFeatureCard");
    const myGrievancesNavItem = document.getElementById("myGrievancesNavItem");
    const myGrievancesSection = document.getElementById("myGrievances");
    if (submitSection) submitSection.hidden = isAdminLoggedIn;
    if (submitNavItem) submitNavItem.hidden = isAdminLoggedIn;
    if (submitHeroButton) submitHeroButton.hidden = isAdminLoggedIn;
    if (submitFeatureCard) submitFeatureCard.hidden = isAdminLoggedIn;
    if (myGrievancesNavItem) myGrievancesNavItem.hidden = isAdminLoggedIn;
    if (myGrievancesSection && isAdminLoggedIn) myGrievancesSection.hidden = true;

    // Administrator login is handled on the separate /admin page.
    // Never show this section inside the student portal.
    adminSection.hidden = true;

    adminLogoutButton.hidden = !isAdminLoggedIn;

    const loginButton = adminLoginForm.querySelector(
        'button[type="submit"]'
    );

    loginButton.hidden = isAdminLoggedIn;
    adminLoginForm.hidden = isAdminLoggedIn;
}

// =====================================
// 3. DASHBOARD
// =====================================

function updateDashboard() {
    const pending = grievances.filter(function (g) {
        return g.status === "Pending";
    }).length;
    const inProgress = grievances.filter(function (g) {
        return g.status === "In Progress";
    }).length;
    const resolved = grievances.filter(function (g) {
        return g.status === "Resolved";
    }).length;

    document.getElementById("totalCount").textContent = grievances.length;
    document.getElementById("pendingCount").textContent = pending;
    document.getElementById("inProgressCount").textContent = inProgress;
    document.getElementById("resolvedCount").textContent = resolved;

    // Draw after the browser has finished updating the dashboard layout.
    // This avoids blank canvases when records/statuses are refreshed.
    window.requestAnimationFrame(function () {
        if (!isAdminLoggedIn || dashboardSection.hidden) return;

        // Recalculate from the latest records so the charts always match the table.
        const latestCounts = {
            pending: grievances.filter(function (g) { return g.status === "Pending"; }).length,
            inProgress: grievances.filter(function (g) { return g.status === "In Progress"; }).length,
            resolved: grievances.filter(function (g) { return g.status === "Resolved"; }).length
        };
        drawAnalyticsCharts(latestCounts);
    });
}

// =====================================
// 3A. GRAPHICAL ANALYTICS (NO EXTRA LIBRARY)
// =====================================
// These canvas charts use the records already loaded from Flask/SQLite.
// They work without an internet connection and require no new packages.

const chartColors = {
    blue: "#315ee8",
    amber: "#e8a12b",
    purple: "#8b5cf6",
    green: "#18a56a",
    teal: "#0f9da8",
    red: "#e45c67",
    grid: "#e8edf5",
    text: "#64748b",
    dark: "#142b4a",
    light: "#a9b8d0"
};

function prepareCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(240, Math.floor(rect.width || 320));
    const height = Math.max(180, Math.floor(rect.height || 220));
    const ratio = Math.max(1, window.devicePixelRatio || 1);

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return { canvas: canvas, ctx: ctx, width: width, height: height };
}

function drawAnalyticsCharts(statusCounts) {
    drawStatusChart(statusCounts);
    drawCategoryChart();
    drawSubmissionTrend();
}

function drawStatusChart(counts) {
    const setup = prepareCanvas("statusChart");
    if (!setup) return;
    const ctx = setup.ctx;
    const total = counts.pending + counts.inProgress + counts.resolved;
    const values = [
        { label: "Pending", value: counts.pending, color: chartColors.amber },
        { label: "In Progress", value: counts.inProgress, color: chartColors.purple },
        { label: "Resolved", value: counts.resolved, color: chartColors.green }
    ];

    const centerX = setup.width / 2;
    const centerY = Math.min(setup.height * 0.47, 105);
    const radius = Math.min(76, setup.width * 0.27, setup.height * 0.36);
    const thickness = Math.max(16, radius * 0.28);

    if (total === 0) {
        ctx.beginPath();
        ctx.strokeStyle = chartColors.grid;
        ctx.lineWidth = thickness;
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = chartColors.text;
        ctx.textAlign = "center";
        ctx.font = '600 13px "Segoe UI", Arial, sans-serif';
        ctx.fillText("No records yet", centerX, centerY + radius + 27);
    } else {
        let angle = -Math.PI / 2;
        values.forEach(function (item) {
            if (!item.value) return;
            const sweep = (item.value / total) * Math.PI * 2;
            ctx.beginPath();
            ctx.strokeStyle = item.color;
            ctx.lineWidth = thickness;
            ctx.arc(centerX, centerY, radius, angle, angle + sweep);
            ctx.stroke();
            angle += sweep;
        });
        ctx.fillStyle = chartColors.dark;
        ctx.textAlign = "center";
        ctx.font = '800 25px "Segoe UI", Arial, sans-serif';
        ctx.fillText(String(total), centerX, centerY + 4);
        ctx.fillStyle = chartColors.text;
        ctx.font = '11px "Segoe UI", Arial, sans-serif';
        ctx.fillText("TOTAL", centerX, centerY + 22);
    }

    const legend = document.getElementById("statusLegend");
    if (legend) {
        legend.replaceChildren();
        values.forEach(function (item) {
            const entry = document.createElement("div");
            entry.className = "legend-item";
            const dot = document.createElement("span");
            dot.className = "legend-dot";
            dot.style.backgroundColor = item.color;
            const label = document.createElement("span");
            label.textContent = item.label;
            const value = document.createElement("strong");
            value.textContent = item.value;
            entry.append(dot, label, value);
            legend.appendChild(entry);
        });
    }
}

function drawCategoryChart() {
    const setup = prepareCanvas("categoryChart");
    if (!setup) return;
    const ctx = setup.ctx;
    const categories = ["Academic", "Administration", "Fees", "Technical", "Other"];
    const values = categories.map(function (category) {
        return grievances.filter(function (g) { return g.category === category; }).length;
    });
    const left = 34;
    const right = 12;
    const top = 16;
    const bottom = 38;
    const chartWidth = setup.width - left - right;
    const chartHeight = setup.height - top - bottom;
    const maxValue = Math.max(1, ...values);
    const tickMax = Math.max(1, Math.ceil(maxValue / 2) * 2);

    ctx.strokeStyle = chartColors.grid;
    ctx.fillStyle = chartColors.text;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    for (let tick = 0; tick <= 2; tick++) {
        const y = top + chartHeight - (tick / 2) * chartHeight;
        ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(setup.width - right, y); ctx.stroke();
        ctx.fillText(String(Math.round((tick / 2) * tickMax)), left - 8, y);
    }

    const slot = chartWidth / categories.length;
    const barWidth = Math.min(30, slot * 0.56);
    values.forEach(function (value, index) {
        const barHeight = (value / tickMax) * chartHeight;
        const x = left + index * slot + (slot - barWidth) / 2;
        const y = top + chartHeight - barHeight;
        ctx.fillStyle = [chartColors.blue, chartColors.teal, chartColors.amber, chartColors.purple, chartColors.green][index];
        if (barHeight > 0) {
            const radius = Math.min(5, barWidth / 2, barHeight / 2);
            ctx.beginPath();
            ctx.moveTo(x, y + barHeight);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.lineTo(x + barWidth - radius, y);
            ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
            ctx.lineTo(x + barWidth, y + barHeight);
            ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = chartColors.dark;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.font = '600 11px "Segoe UI", Arial, sans-serif';
        ctx.fillText(String(value), x + barWidth / 2, Math.max(top + 10, y - 4));
        ctx.fillStyle = chartColors.text;
        ctx.font = '10px "Segoe UI", Arial, sans-serif';
        ctx.textBaseline = "top";
        const shortLabels = ["Academic", "Admin", "Fees", "Technical", "Other"];
        ctx.fillText(shortLabels[index], left + index * slot + slot / 2, top + chartHeight + 10);
    });
}

function drawSubmissionTrend() {
    const setup = prepareCanvas("trendChart");
    if (!setup) return;
    const ctx = setup.ctx;
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let offset = 6; offset >= 0; offset--) {
        const date = new Date(today);
        date.setDate(today.getDate() - offset);
        days.push({ date: date, label: date.toLocaleDateString(undefined, { weekday: "short" }), value: 0 });
    }

    grievances.forEach(function (g) {
        if (!g.createdAt) return;
        // Backend timestamps are formatted as YYYY-MM-DD HH:MM:SS.
        const datePart = String(g.createdAt).slice(0, 10);
        const parts = datePart.split("-").map(Number);
        if (parts.length !== 3 || parts.some(Number.isNaN)) return;
        const submitted = new Date(parts[0], parts[1] - 1, parts[2]);
        const day = days.find(function (item) { return item.date.getTime() === submitted.getTime(); });
        if (day) day.value += 1;
    });

    const left = 30, right = 15, top = 20, bottom = 30;
    const plotWidth = setup.width - left - right;
    const plotHeight = setup.height - top - bottom;
    const maxValue = Math.max(1, ...days.map(function (day) { return day.value; }));
    const stepMax = Math.max(1, Math.ceil(maxValue / 2) * 2);

    ctx.strokeStyle = chartColors.grid;
    ctx.fillStyle = chartColors.text;
    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let tick = 0; tick <= 2; tick++) {
        const y = top + plotHeight - (tick / 2) * plotHeight;
        ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(setup.width - right, y); ctx.stroke();
        ctx.fillText(String(Math.round((tick / 2) * stepMax)), left - 7, y);
    }

    const points = days.map(function (day, index) {
        return {
            x: left + (days.length === 1 ? 0 : index * plotWidth / (days.length - 1)),
            y: top + plotHeight - (day.value / stepMax) * plotHeight,
            value: day.value,
            label: day.label
        };
    });
    ctx.beginPath();
    points.forEach(function (point, index) {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = chartColors.blue;
    ctx.lineWidth = 3;
    ctx.stroke();

    points.forEach(function (point) {
        ctx.beginPath(); ctx.fillStyle = "#ffffff"; ctx.arc(point.x, point.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = chartColors.blue; ctx.stroke();
        ctx.fillStyle = chartColors.dark; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.font = '600 10px "Segoe UI", Arial, sans-serif';
        ctx.fillText(String(point.value), point.x, point.y - 8);
        ctx.fillStyle = chartColors.text; ctx.textBaseline = "top"; ctx.font = '10px "Segoe UI", Arial, sans-serif';
        ctx.fillText(point.label, point.x, top + plotHeight + 10);
    });
}

let chartResizeFrame = null;
window.addEventListener("resize", function () {
    if (chartResizeFrame !== null) window.cancelAnimationFrame(chartResizeFrame);
    chartResizeFrame = window.requestAnimationFrame(function () {
        chartResizeFrame = null;
        if (isAdminLoggedIn) updateDashboard();
    });
});

// =====================================
// 4. LOAD RECORDS FROM SQLITE
// =====================================

async function loadGrievances() {
    if (!isAdminLoggedIn) {
        return;
    }

    isLoading = true;
    tableMessage.textContent = "Loading grievance records...";

    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (response.status === 401) {
            isAdminLoggedIn = false;
            grievances = [];
            updatePageVisibility();
            displayGrievances();
            updateDashboard();
            adminMessage.textContent =
                "Your administrator session has expired. Please log in again.";
            return;
        }

        if (!response.ok || !Array.isArray(data)) {
            throw new Error(
                data.error || "Could not load grievance records."
            );
        }

        grievances = data;
        displayGrievances();
        updateDashboard();
    } catch (error) {
        console.error("Loading error:", error);
        tableMessage.textContent =
            "Unable to load records. Check the Flask server.";
    } finally {
        isLoading = false;
        displayGrievances();
    }
}

// =====================================
// 5. DISPLAY MANAGEMENT TABLE
// =====================================

function createCell(value) {
    const cell = document.createElement("td");
    cell.textContent = value || "";
    return cell;
}

function displayGrievances() {
    grievanceTable.replaceChildren();

    if (!isAdminLoggedIn) {
        tableMessage.textContent =
            "Please log in as an administrator to manage grievances.";
        return;
    }

    const searchText = searchInput.value.trim().toLowerCase();
    const selectedCategory = categoryFilter.value;
    const selectedStatus = statusFilter.value;

    const filtered = grievances.filter(function (g) {
        const searchableText = [
            g.id, g.name, g.email, g.subject, g.category, g.description
        ].join(" ").toLowerCase();

        const matchesSearch = searchableText.includes(searchText);
        const matchesCategory =
            selectedCategory === "" || g.category === selectedCategory;
        const matchesStatus =
            selectedStatus === "" || g.status === selectedStatus;

        return matchesSearch && matchesCategory && matchesStatus;
    });

    filtered.forEach(function (g) {
        const row = document.createElement("tr");

        row.appendChild(createCell(g.id));
        row.appendChild(createCell(g.name));
        row.appendChild(createCell(g.category));
        row.appendChild(createCell(g.subject));

        const statusCell = createCell(g.status);
        statusCell.classList.add("status-cell");
        const statusBadge = document.createElement("span");
        statusBadge.className = "status-badge status-" +
            (g.status || "").toLowerCase().replace(/\s+/g, "-");
        statusBadge.textContent = g.status || "Unknown";
        statusCell.replaceChildren(statusBadge);
        row.appendChild(statusCell);

        const actionCell = document.createElement("td");
        const select = document.createElement("select");

        select.setAttribute(
            "aria-label",
            "Update status for " + g.id
        );

        ["Pending", "In Progress", "Resolved"].forEach(
            function (status) {
                const option = document.createElement("option");
                option.value = status;
                option.textContent = status;
                option.selected = g.status === status;
                select.appendChild(option);
            }
        );

        select.disabled = isLoading;

        select.addEventListener("change", async function () {
            const chosenStatus = select.value;
            let remarks = "";
            if (chosenStatus === "Resolved") {
                remarks = window.prompt("Enter resolution remarks (required). These will be shown to the student:", g.resolutionRemarks || "");
                if (remarks === null) {
                    select.value = g.status;
                    return;
                }
                remarks = remarks.trim();
                if (!remarks) {
                    window.alert("Please enter resolution remarks before marking this grievance as resolved.");
                    select.value = g.status;
                    return;
                }
            }
            select.disabled = true;
            await updateGrievanceStatus(g.id, chosenStatus, remarks);
        });

        const attachmentCell = document.createElement("td");
        if (g.attachmentName) {
            const attachmentLink = document.createElement("a");
            attachmentLink.href = API_URL + "/" + encodeURIComponent(g.id) + "/attachment";
            attachmentLink.textContent = "Download file";
            attachmentLink.setAttribute("download", "");
            attachmentCell.appendChild(attachmentLink);
        } else {
            attachmentCell.textContent = "—";
        }
        row.appendChild(attachmentCell);
        actionCell.appendChild(select);
        row.appendChild(actionCell);
        grievanceTable.appendChild(row);
    });

    if (filtered.length === 0) {
        tableMessage.textContent = grievances.length === 0
            ? "No grievances have been submitted yet."
            : "No matching grievances found.";
    } else {
        tableMessage.textContent =
            "Showing " + filtered.length +
            " of " + grievances.length + " grievance record(s).";
    }
}

// =====================================
// 6. CHECK ADMIN LOGIN SESSION
// =====================================

async function checkAdminSession() {
    try {
        const response = await fetch("/api/admin/session");
        const data = await response.json();

        isAdminLoggedIn = response.ok && data.loggedIn === true;
        updatePageVisibility();

        if (isAdminLoggedIn) {
            adminMessage.textContent =
                "Administrator session is active.";
            await loadGrievances();
        } else {
            grievances = [];
            updateDashboard();
            displayGrievances();
        }
    } catch (error) {
        console.error("Session check failed:", error);
        isAdminLoggedIn = false;
        updatePageVisibility();
        adminMessage.textContent =
            "Cannot connect to the server. Please try again.";
    }
}

// =====================================
// 7. ADMINISTRATOR LOGIN
// =====================================

adminLoginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const username =
        document.getElementById("adminUsername").value.trim();

    const password =
        document.getElementById("adminPassword").value;

    const loginButton = adminLoginForm.querySelector(
        'button[type="submit"]'
    );

    loginButton.disabled = true;
    adminMessage.textContent = "Signing in...";

    try {
        const response = await fetch("/api/admin/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Administrator login failed."
            );
        }

        isAdminLoggedIn = true;
        document.getElementById("adminPassword").value = "";

        updatePageVisibility();
        adminMessage.textContent = "Login successful!";

        await loadGrievances();
    } catch (error) {
        isAdminLoggedIn = false;
        updatePageVisibility();
        adminMessage.textContent = error.message;
    } finally {
        loginButton.disabled = false;
    }
});

// =====================================
// 8. ADMINISTRATOR LOGOUT
// =====================================

adminLogoutButton.addEventListener("click", async function () {
    adminLogoutButton.disabled = true;

    try {
        const response = await fetch("/api/admin/logout", {
            method: "POST"
        });

        if (!response.ok) {
            throw new Error("Logout failed.");
        }

        isAdminLoggedIn = false;
        grievances = [];

        updatePageVisibility();
        displayGrievances();
        updateDashboard();

        adminMessage.textContent =
            "You have logged out successfully.";
    } catch (error) {
        adminMessage.textContent = error.message;
    } finally {
        adminLogoutButton.disabled = false;
    }
});

// =====================================
// 9. SUBMIT A GRIEVANCE
// =====================================

function downloadGrievanceReceipt(grievance) {
    // Build a simple receipt page and let the browser save it as PDF.
    const receiptWindow = window.open("", "_blank");

    if (!receiptWindow) {
        formMessage.textContent = "Please allow pop-ups to create your PDF receipt.";
        return;
    }

    function safeText(value) {
        return String(value || "Not available").replace(/[&<>"']/g, function (character) {
            const entities = {
                "&": "&amp;", "<": "&lt;", ">": "&gt;",
                '"': "&quot;", "'": "&#39;"
            };
            return entities[character];
        });
    }

    const receiptHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Grievance Receipt - ${safeText(grievance.id)}</title>
<style>
body{font-family:Arial,sans-serif;color:#1f2937;margin:0;padding:32px;background:#f3f6fb}
.receipt{max-width:720px;margin:0 auto;background:#fff;border:1px solid #dbe3ef;border-radius:14px;padding:32px}
.top{border-bottom:3px solid #2563eb;padding-bottom:18px;margin-bottom:22px}
h1{color:#17365d;margin:0 0 8px;font-size:25px}p{line-height:1.5}.tag{display:inline-block;background:#e8f1ff;color:#1d4ed8;padding:6px 12px;border-radius:20px;font-weight:bold}
.row{padding:12px 0;border-bottom:1px solid #e5e7eb}.label{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin-bottom:4px}.value{font-size:16px;overflow-wrap:anywhere}
.note{background:#f8fafc;padding:14px;border-radius:8px;margin-top:22px;font-size:13px}.actions{margin:20px auto;text-align:center;display:flex;justify-content:center;gap:12px;flex-wrap:wrap}.actions button{padding:11px 18px;background:#2563eb;color:white;border:0;border-radius:7px;font-size:15px;cursor:pointer}.actions .save-button{background:#15803d}
@media print{body{background:white;padding:0}.receipt{border:0;border-radius:0;padding:12px}.actions{display:none}}
</style></head><body><main class="receipt">
<div class="top"><h1>E-Grievance Redressal Portal</h1><p>Grievance Submission Receipt</p><span class="tag">Submitted successfully</span></div>
<div class="row"><span class="label">Grievance ID</span><div class="value">${safeText(grievance.id)}</div></div>
<div class="row"><span class="label">Full Name</span><div class="value">${safeText(grievance.name)}</div></div>
<div class="row"><span class="label">Email Address</span><div class="value">${safeText(grievance.email)}</div></div>
<div class="row"><span class="label">Category</span><div class="value">${safeText(grievance.category)}</div></div>
<div class="row"><span class="label">Subject</span><div class="value">${safeText(grievance.subject)}</div></div>
<div class="row"><span class="label">Description</span><div class="value">${safeText(grievance.description)}</div></div>
<div class="row"><span class="label">Current Status</span><div class="value">${safeText(grievance.status || "Pending")}</div></div>
<div class="row"><span class="label">Submitted On</span><div class="value">${safeText(grievance.createdAt)}</div></div>
<div class="note">Please keep your grievance ID safe. You will need it to track the progress of your grievance. This receipt confirms that your submission was received by the portal.</div>
<div class="actions"><button type="button" onclick="window.print()">Print Receipt</button><button type="button" class="save-button" onclick="window.print()">Save as PDF</button></div>
</main></body></html>`;

    receiptWindow.document.open();
    receiptWindow.document.write(receiptHtml);
    receiptWindow.document.close();
}

function addFeedbackForm(container, grievanceId, onSubmitted) {
    const form = document.createElement("form"); form.className = "resolution-rating-form";
    const label = document.createElement("label"); label.textContent = "Your rating (1–5 stars)"; form.appendChild(label);
    const stars = document.createElement("div"); stars.className = "rating-buttons";
    let selectedRating = 0;
    for (let number = 1; number <= 5; number++) {
        const star = document.createElement("button"); star.type = "button"; star.textContent = "★"; star.title = number + " star" + (number > 1 ? "s" : ""); star.setAttribute("aria-label", star.title); star.className = "rating-star";
        star.addEventListener("click", function () { selectedRating = number; Array.from(stars.children).forEach(function (button, index) { button.classList.toggle("selected", index < selectedRating); }); });
        stars.appendChild(star);
    }
    form.appendChild(stars);
    const feedbackLabel = document.createElement("label"); feedbackLabel.textContent = "Additional feedback (optional)"; form.appendChild(feedbackLabel);
    const feedback = document.createElement("textarea"); feedback.rows = 2; feedback.maxLength = 1000; feedback.placeholder = "Tell us about your experience"; form.appendChild(feedback);
    const message = document.createElement("p"); message.className = "feedback-message"; message.setAttribute("aria-live", "polite"); form.appendChild(message);
    const submit = document.createElement("button"); submit.type = "submit"; submit.textContent = "Submit Rating"; form.appendChild(submit);
    form.addEventListener("submit", async function (event) { event.preventDefault(); if (!selectedRating) { message.textContent = "Please select a star rating first."; return; } submit.disabled = true; try { const response = await fetch(API_URL + "/" + encodeURIComponent(grievanceId) + "/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating: selectedRating, feedback: feedback.value.trim() }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not submit rating."); message.textContent = "Thank you for your feedback!"; if (onSubmitted) onSubmitted(); } catch (error) { message.textContent = error.message; submit.disabled = false; } });
    container.appendChild(form);
}

async function loadMyGrievances() {
    const section = document.getElementById("myGrievances");
    const list = document.getElementById("myGrievancesList");
    if (!section || !list) return;
    try {
        const response = await fetch("/api/student/grievances");
        const data = await response.json();
        if (!response.ok) { section.hidden = true; return; }
        section.hidden = false;
        list.replaceChildren();
        if (!data.length) { list.textContent = "You have not submitted any grievances yet."; return; }
        data.forEach(function (g) {
            const card = document.createElement("article"); card.className = "my-grievance-card";
            const heading = document.createElement("h3"); heading.textContent = g.subject; card.appendChild(heading);
            const id = document.createElement("p"); id.textContent = "Grievance ID: " + g.id; card.appendChild(id);
            const meta = document.createElement("div"); meta.className = "my-grievance-meta";
            [g.category, g.status, g.createdAt].forEach(function (value) { const span = document.createElement("span"); span.textContent = value || ""; meta.appendChild(span); });
            card.appendChild(meta);
            const desc = document.createElement("p"); desc.textContent = g.description; card.appendChild(desc);
            if (g.attachmentName) { const link = document.createElement("a"); link.href = API_URL + "/" + encodeURIComponent(g.id) + "/attachment"; link.textContent = "Download attachment: " + g.attachmentName; card.appendChild(link); }
            if (g.status === "Resolved") {
                const resolvedBox = document.createElement("div"); resolvedBox.className = "resolution-feedback-box";
                const solved = document.createElement("h4"); solved.textContent = "Your problem has been solved!"; resolvedBox.appendChild(solved);
                const remarksLabel = document.createElement("strong"); remarksLabel.textContent = "Resolution remarks"; resolvedBox.appendChild(remarksLabel);
                const remarks = document.createElement("p"); remarks.textContent = g.resolutionRemarks || "The administration has marked this grievance as resolved."; resolvedBox.appendChild(remarks);
                const rateTitle = document.createElement("p"); rateTitle.textContent = g.studentRating ? "Thank you! You rated us " + g.studentRating + "/5 stars." : "Kindly rate us:"; resolvedBox.appendChild(rateTitle);
                if (!g.studentRating) addFeedbackForm(resolvedBox, g.id, function () { loadMyGrievances(); });
                resolvedBox.style.marginTop = "14px"; card.appendChild(resolvedBox);
            }
            const track = document.createElement("button"); track.type = "button"; track.textContent = "View tracking details";
            track.addEventListener("click", function () { document.getElementById("grievanceId").value = g.id; document.getElementById("track").scrollIntoView({behavior:"smooth"}); document.getElementById("trackingForm").requestSubmit(); });
            card.appendChild(track); list.appendChild(card);
        });
    } catch (error) { list.textContent = "Unable to load your grievances. Please refresh the page."; }
}

grievanceForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const submitButton = grievanceForm.querySelector(
        'button[type="submit"]'
    );

    const originalText = submitButton.textContent;

    const requiredValues = [
        document.getElementById("name").value.trim(),
        document.getElementById("email").value.trim(),
        document.getElementById("category").value,
        document.getElementById("subject").value.trim(),
        document.getElementById("description").value.trim()
    ];
    const attachmentInput = document.getElementById("attachment");
    const chosenFile = attachmentInput && attachmentInput.files[0];
    if (requiredValues.some(function (value) { return !value; })) {
        formMessage.textContent = "Please fill in all required fields.";
        return;
    }
    if (chosenFile && chosenFile.size > 5 * 1024 * 1024) {
        formMessage.textContent = "Attachment must be 5 MB or smaller.";
        return;
    }
    const grievance = {
        name: requiredValues[0], email: requiredValues[1], category: requiredValues[2],
        subject: requiredValues[3], description: requiredValues[4]
    };

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
    formMessage.textContent = "";

    try {
        const formData = new FormData(grievanceForm);
        const response = await fetch(API_URL, { method: "POST", body: formData });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Submission failed.");
        }

        formMessage.textContent =
            "Grievance submitted successfully! Your ID is " +
            data.grievance.id +
            ". Save this ID to track your complaint.";

        // Open a receipt window so the user can print or save it as PDF.
        downloadGrievanceReceipt(data.grievance);

        grievanceForm.reset();

        // Refresh the student's personal list after a successful submission.
        await loadMyGrievances();
        if (isAdminLoggedIn) await loadGrievances();
    } catch (error) {
        console.error("Submission error:", error);
        formMessage.textContent =
            "Unable to submit grievance: " + error.message;
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
});

// =====================================
// 10. UPDATE STATUS
// =====================================

async function updateGrievanceStatus(grievanceId, newStatus, remarks) {
    if (!isAdminLoggedIn) {
        adminMessage.textContent =
            "Please log in to manage grievance statuses.";
        return;
    }

    try {
        const response = await fetch(
            API_URL + "/" + encodeURIComponent(grievanceId) + "/status",
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ status: newStatus, remarks: remarks || "" })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Status update failed.");
        }

        await loadGrievances();
        // Explicit redraw after a status change, after the refreshed records/layout settle.
        window.requestAnimationFrame(function () {
            if (isAdminLoggedIn && !dashboardSection.hidden) updateDashboard();
        });

        const trackedId = trackingInput.value.trim();

        if (trackedId.toLowerCase() === grievanceId.toLowerCase()) {
            await trackGrievanceById(trackedId);
        }

        adminMessage.textContent =
            "Status updated successfully for " + grievanceId + ".";
    } catch (error) {
        console.error("Status update error:", error);
        adminMessage.textContent =
            "Could not update status: " + error.message;
        await loadGrievances();
    }
}

// =====================================
// 11. PUBLIC GRIEVANCE TRACKING
// =====================================

function showTrackingResult(grievance) {
    trackingResult.replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent = "Grievance Found";
    trackingResult.appendChild(heading);

    const detailsCard = document.createElement("div");
    detailsCard.className = "tracking-details-card";

    const details = [
        ["Grievance ID", grievance.id],
        ["Category", grievance.category],
        ["Subject", grievance.subject],
        ["Status", grievance.status],
        ["Submitted On", grievance.createdAt]
    ];

    details.forEach(function (detail) {
        const row = document.createElement("div");
        row.className = "tracking-detail-row";

        const label = document.createElement("strong");
        label.textContent = detail[0];

        const value = document.createElement("span");
        value.textContent = detail[1] || "Not available";

        row.appendChild(label);
        row.appendChild(value);
        detailsCard.appendChild(row);
    });

    trackingResult.appendChild(detailsCard);

    const timelineHeading = document.createElement("h4");
    timelineHeading.className = "timeline-heading";
    timelineHeading.textContent = "Grievance Progress";
    trackingResult.appendChild(timelineHeading);

    const timeline = document.createElement("div");
    timeline.className = "grievance-timeline";
    timeline.setAttribute("aria-label", "Grievance progress timeline");

    const stages = [
        {
            title: "Grievance Submitted",
            description: "Your grievance has been received by the portal."
        },
        {
            title: "In Progress",
            description: "The administration is reviewing or working on your grievance."
        },
        {
            title: "Resolved",
            description: "The grievance has been marked as resolved."
        }
    ];

    const statusIndex = {
        "Pending": 0,
        "In Progress": 1,
        "Resolved": 2
    };
    const currentStage = Object.prototype.hasOwnProperty.call(statusIndex, grievance.status)
        ? statusIndex[grievance.status]
        : 0;

    stages.forEach(function (stage, index) {
        const item = document.createElement("div");
        item.className = "timeline-item";

        if (index < currentStage) {
            item.classList.add("completed");
        } else if (index === currentStage) {
            item.classList.add("current");
        } else {
            item.classList.add("upcoming");
        }

        const marker = document.createElement("div");
        marker.className = "timeline-marker";
        marker.setAttribute("aria-hidden", "true");
        marker.textContent = index < currentStage ? "✓" : String(index + 1);

        const content = document.createElement("div");
        content.className = "timeline-content";

        const stageTitle = document.createElement("h4");
        stageTitle.textContent = stage.title;
        content.appendChild(stageTitle);

        const description = document.createElement("p");
        description.textContent = stage.description;
        content.appendChild(description);

        if (index === currentStage) {
            const currentLabel = document.createElement("span");
            currentLabel.className = "timeline-current-label";
            currentLabel.textContent = "Current status";
            content.appendChild(currentLabel);
        }

        item.appendChild(marker);
        item.appendChild(content);
        timeline.appendChild(item);
    });

    trackingResult.appendChild(timeline);

    if (grievance.status === "Resolved") {
        const resolutionBox = document.createElement("section"); resolutionBox.className = "resolution-feedback-box";
        const solved = document.createElement("h3"); solved.textContent = "Your problem has been solved!"; resolutionBox.appendChild(solved);
        const remarksTitle = document.createElement("strong"); remarksTitle.textContent = "Resolution remarks"; resolutionBox.appendChild(remarksTitle);
        const remarksText = document.createElement("p"); remarksText.textContent = grievance.resolutionRemarks || "The administration has marked this grievance as resolved."; resolutionBox.appendChild(remarksText);
        const ratingPrompt = document.createElement("p"); ratingPrompt.textContent = "Kindly rate us:"; resolutionBox.appendChild(ratingPrompt);
        if (grievance.studentRating) {
            const alreadyRated = document.createElement("p"); alreadyRated.textContent = "Thank you! You rated us " + grievance.studentRating + "/5 stars."; resolutionBox.appendChild(alreadyRated);
        } else {
            const loginNote = document.createElement("p"); loginNote.textContent = "To submit your rating, log in and open this grievance in My Grievances."; resolutionBox.appendChild(loginNote);
        }
        trackingResult.appendChild(resolutionBox);
    }
}
async function trackGrievanceById(enteredId) {
    trackingResult.textContent = "Searching for your grievance...";

    try {
        const response = await fetch(
            API_URL + "/" + encodeURIComponent(enteredId)
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Grievance not found.");
        }

        showTrackingResult(data);
    } catch (error) {
        trackingResult.replaceChildren();

        const message = document.createElement("p");
        message.textContent =
            error.message === "Grievance not found."
                ? "No grievance found with that ID. Please check it and try again."
                : "Unable to track grievance. Please try again.";

        trackingResult.appendChild(message);
    }
}

trackingForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const enteredId = trackingInput.value.trim();

    if (enteredId) {
        await trackGrievanceById(enteredId);
    }
});

// =====================================
// 12. SEARCH AND FILTER
// =====================================

searchInput.addEventListener("input", displayGrievances);
categoryFilter.addEventListener("change", displayGrievances);
statusFilter.addEventListener("change", displayGrievances);

// =====================================
// 13. INITIALIZE PAGE
// =====================================

updatePageVisibility();
updateDashboard();
displayGrievances();
checkAdminSession();


// Student session controls
async function checkStudentSession() {
    const logoutButton = document.getElementById("studentLogoutButton");
    if (!logoutButton) return;
    try {
        const response = await fetch("/api/student/session");
        const data = await response.json();
        logoutButton.hidden = !data.loggedIn;
    } catch (error) {
        console.error("Could not check student session:", error);
    }
}

const studentLogoutButton = document.getElementById("studentLogoutButton");
if (studentLogoutButton) {
    studentLogoutButton.addEventListener("click", async function () {
        try {
            await fetch("/api/student/logout", { method: "POST" });
            window.location.href = "/";
        } catch (error) {
            alert("Unable to log out right now. Please try again.");
        }
    });
}
checkStudentSession();


// Load the personal grievance list only for the currently authenticated student.
fetch("/api/student/session").then(function (response) { return response.json(); }).then(function (data) {
    if (data.loggedIn) { loadMyGrievances(); }
}).catch(function () {});
