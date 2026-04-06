const DEFAULT_API_BASE = "/api";
const STORAGE_KEY = "diabetesClinicalDashboardState";

const featureOrder = [
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "DiabetesPedigreeFunction",
    "Age"
];

const fallbackLabels = {
    Pregnancies: "Số lần mang thai",
    Glucose: "Đường huyết",
    BloodPressure: "Huyết áp tâm trương",
    SkinThickness: "Skin Thickness",
    Insulin: "Insulin",
    BMI: "BMI",
    DiabetesPedigreeFunction: "Tiền sử gia đình",
    Age: "Tuổi"
};

const form = document.getElementById("predictionForm");
const submitButton = document.getElementById("submitButton");
const resultPanel = document.getElementById("resultPanel");
const result = document.getElementById("result");
const alertsList = document.getElementById("alertsList");
const actionsList = document.getElementById("actionsList");
const metricInsights = document.getElementById("metricInsights");
const historyBody = document.getElementById("historyBody");
const referenceGrid = document.getElementById("referenceGrid");
const carePathway = document.getElementById("carePathway");
const educationList = document.getElementById("educationList");
const modelInfoPanel = document.getElementById("modelInfo");
const quickSignals = document.getElementById("quickSignals");
const specialtyTags = document.getElementById("specialtyTags");
const summaryCard = document.getElementById("resultSummary");
const modelVersion = document.getElementById("modelVersion");
const benchmarkStat = document.getElementById("benchmarkStat");
const riskMeter = document.getElementById("riskMeter");
const riskPercent = document.getElementById("riskPercent");
const riskBand = document.getElementById("riskBand");
const certaintyValue = document.getElementById("certaintyValue");
const modelProbability = document.getElementById("modelProbability");
const clinicalProbability = document.getElementById("clinicalProbability");
const tabButtons = Array.from(document.querySelectorAll(".tab-button"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
const libraryBandsCanvas = document.getElementById("libraryBandsChart");
const librarySpreadCanvas = document.getElementById("librarySpreadChart");

let radarChart = null;
let libraryBandsChart = null;
let librarySpreadChart = null;
let referenceStats = {};
let clinicalContent = {};
let modelInfo = {};
let carePathwayItems = [];
const apiBase = resolveApiBase();

const countObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            if (!entry.target.classList.contains("count-up")) return;
            if (entry.target.dataset.countAnimated === "true") return;

            animateCountUp(entry.target);
            countObserver.unobserve(entry.target);
        });
    },
    { threshold: 0.45 }
);

function labelsMap() {
    return clinicalContent.feature_labels || fallbackLabels;
}

function numericValue(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function storageGet(key) {
    try {
        return window.localStorage.getItem(key);
    } catch (error) {
        return null;
    }
}

function storageSet(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch (error) {
        return null;
    }
}

function isPlaceholderValue(value) {
    const normalized = String(value || "").trim().toUpperCase();
    return !normalized || normalized.includes("URL_CUA_") || normalized.includes("YOUR-");
}

function normalizeApiBase(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed || isPlaceholderValue(trimmed)) return "";

    const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
    if (withoutTrailingSlash.endsWith("/api")) {
        return withoutTrailingSlash;
    }

    return `${withoutTrailingSlash}/api`;
}

function resolveApiBase() {
    const configuredValue = normalizeApiBase(window.__APP_CONFIG__?.API_BASE_URL);

    return configuredValue || DEFAULT_API_BASE;
}

function buildApiUrl(endpoint) {
    const safeEndpoint = String(endpoint || "").replace(/^\/+/, "");
    return `${apiBase}/${safeEndpoint}`;
}

function readAnimatedValue(text = "") {
    const parsed = parseFloat(String(text).replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
}

function animateMetricNumber(element, target, options = {}) {
    if (!element || !Number.isFinite(target)) return;

    const decimals = options.decimals ?? 0;
    const prefix = options.prefix ?? "";
    const suffix = options.suffix ?? "";
    const duration = options.duration ?? 1100;
    const startValue = options.start ?? readAnimatedValue(element.textContent);
    const startTime = performance.now();

    function frame(now) {
        const progress = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = startValue + (target - startValue) * eased;
        element.textContent = `${prefix}${current.toFixed(decimals)}${suffix}`;

        if (progress < 1) {
            requestAnimationFrame(frame);
            return;
        }

        element.textContent = `${prefix}${target.toFixed(decimals)}${suffix}`;
    }

    requestAnimationFrame(frame);
}

function primeCountUp(element, value, decimals = 0) {
    if (!element) return;
    element.dataset.countTarget = `${value}`;
    element.dataset.countDecimals = `${decimals}`;
    element.dataset.countAnimated = "false";
}

function animateCountUp(element) {
    const target = numericValue(element.dataset.countTarget);
    const decimals = numericValue(element.dataset.countDecimals);
    const prefix = element.dataset.countPrefix || "";
    const suffix = element.dataset.countSuffix || "";

    element.dataset.countAnimated = "true";
    animateMetricNumber(element, target, {
        start: 0,
        decimals,
        prefix,
        suffix
    });
}

function observeCountUps(root = document) {
    const targets = root instanceof Element && root.matches(".count-up")
        ? [root, ...root.querySelectorAll(".count-up")]
        : Array.from(root.querySelectorAll(".count-up"));

    targets.forEach((element) => {
        if (element.dataset.countAnimated !== "true") {
            countObserver.observe(element);
        }
    });
}

function activateTab(tabName) {
    tabButtons.forEach((button) => {
        const isActive = button.dataset.tabTarget === tabName;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
    });

    tabPanels.forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.tabPanel === tabName);
    });

    requestAnimationFrame(() => {
        radarChart?.resize();
        libraryBandsChart?.resize();
        librarySpreadChart?.resize();
    });
}

function getInputPayload() {
    return {
        Pregnancies: parseInt(document.getElementById("Pregnancies").value, 10),
        Glucose: parseFloat(document.getElementById("Glucose").value),
        BloodPressure: parseFloat(document.getElementById("BloodPressure").value),
        SkinThickness: parseFloat(document.getElementById("SkinThickness").value),
        Insulin: parseFloat(document.getElementById("Insulin").value),
        BMI: parseFloat(document.getElementById("BMI").value),
        DiabetesPedigreeFunction: parseFloat(document.getElementById("DiabetesPedigreeFunction").value),
        Age: parseInt(document.getElementById("Age").value, 10)
    };
}

function setInputPayload(input) {
    featureOrder.forEach((feature) => {
        const field = document.getElementById(feature);
        if (field && input?.[feature] !== undefined) {
            field.value = input[feature];
        }
    });
}

function formatPercent(value) {
    return `${(value * 100).toFixed(1)}%`;
}

function toneClass(level) {
    if (["high", "critical"].includes(level)) return "tone-high";
    if (["watch", "moderate"].includes(level)) return "tone-watch";
    if (["low", "normal"].includes(level)) return "tone-normal";
    return "tone-neutral";
}

function riskTone(probability) {
    if (probability >= 0.75) return "tone-high";
    if (probability >= 0.4) return "tone-watch";
    return "tone-normal";
}

function metricPreview(input) {
    const preview = [];

    if (input.Glucose >= 126) {
        preview.push({ label: "Glucose", text: "Vượt ngưỡng cần xác nhận", tone: "high" });
    } else if (input.Glucose >= 100) {
        preview.push({ label: "Glucose", text: "Vùng tiền đái tháo đường", tone: "watch" });
    } else {
        preview.push({ label: "Glucose", text: "Đang trong vùng thuận lợi", tone: "normal" });
    }

    if (input.BMI >= 30) {
        preview.push({ label: "BMI", text: "Béo phì, cần ưu tiên kiểm soát cân nặng", tone: "high" });
    } else if (input.BMI >= 25) {
        preview.push({ label: "BMI", text: "Thừa cân, nên can thiệp sớm", tone: "watch" });
    } else {
        preview.push({ label: "BMI", text: "Tương đối tối ưu", tone: "normal" });
    }

    if (input.BloodPressure >= 90) {
        preview.push({ label: "Huyết áp", text: "Tâm trương tăng cao", tone: "high" });
    } else if (input.BloodPressure >= 80) {
        preview.push({ label: "Huyết áp", text: "Cận cao, nên theo dõi", tone: "watch" });
    } else {
        preview.push({ label: "Huyết áp", text: "Chưa có cờ đỏ lớn", tone: "normal" });
    }

    if (input.Age >= 45 || input.DiabetesPedigreeFunction >= 0.8) {
        preview.push({ label: "Nền nguy cơ", text: "Tuổi hoặc yếu tố gia đình đang tăng nền rủi ro", tone: "watch" });
    }

    return preview;
}

function renderQuickSignals(input = getInputPayload()) {
    const signals = metricPreview(input);
    quickSignals.innerHTML = signals
        .map(
            (signal) => `
                <article class="signal-card">
                    <span class="status-chip ${toneClass(signal.tone)}">${signal.label}</span>
                    <p>${signal.text}</p>
                </article>
            `
        )
        .join("");
}

function renderSpecialties(items = []) {
    specialtyTags.innerHTML = items.map((item) => `<span>${item}</span>`).join("");
}

function updateRiskMeter(prediction) {
    riskMeter.style.setProperty("--progress", `${Math.round(prediction.probability * 360)}deg`);
    animateMetricNumber(riskPercent, prediction.probability * 100, {
        decimals: 1,
        suffix: "%"
    });
    riskBand.textContent = `${prediction.risk_band} - ${prediction.has_diabetes}`;
    certaintyValue.textContent = prediction.certainty;
    animateMetricNumber(modelProbability, prediction.model_probability * 100, {
        decimals: 1,
        suffix: "%"
    });
    animateMetricNumber(clinicalProbability, prediction.clinical_probability * 100, {
        decimals: 1,
        suffix: "%"
    });
}

function renderResult(prediction) {
    resultPanel.classList.remove("hidden");
    summaryCard.innerHTML = `
        <h3>${prediction.has_diabetes}</h3>
        <p>${prediction.summary}</p>
    `;

    result.innerHTML = `
        <span class="status-chip ${riskTone(prediction.probability)}">${prediction.has_diabetes}</span>
        <h2>Điểm nguy cơ ${prediction.risk_score}/100</h2>
        <p>${prediction.summary}</p>
        <p><strong>Diễn giải:</strong> ${prediction.clinical_interpretation}</p>
        <p><strong>Khuyến nghị ngắn:</strong> ${prediction.advice}</p>
        <p><strong>Yếu tố nổi bật:</strong> ${prediction.key_drivers.length ? prediction.key_drivers.join(" ") : "Chưa có yếu tố vượt trội."}</p>
        <p><strong>Lưu ý:</strong> ${prediction.disclaimer}</p>
    `;
}

function renderAlerts(alerts = []) {
    alertsList.innerHTML = alerts
        .map(
            (alert) => `
                <article class="stack-card">
                    <span class="status-chip ${toneClass(alert.level)}">${alert.level}</span>
                    <h3>${alert.title}</h3>
                    <p>${alert.detail}</p>
                </article>
            `
        )
        .join("");
}

function renderActions(actions = []) {
    actionsList.innerHTML = actions
        .map(
            (action) => `
                <article class="stack-card">
                    <span class="status-chip tone-neutral">${action.timeframe}</span>
                    <h3>${action.action}</h3>
                    <p>${action.reason}</p>
                </article>
            `
        )
        .join("");
}

function renderMetricInsights(insights = []) {
    metricInsights.innerHTML = insights
        .map(
            (item) => `
                <article class="metric-card">
                    <span class="status-chip ${toneClass(item.severity)}">${item.status}</span>
                    <h3>${item.label}: ${item.value} ${item.unit}</h3>
                    <p><strong>Tham chiếu:</strong> ${item.reference}</p>
                    <p><strong>Ý nghĩa:</strong> ${item.clinical_note}</p>
                    <p><strong>Tác động:</strong> ${item.effect}</p>
                </article>
            `
        )
        .join("");
}

function renderRadarChart(input) {
    const labels = featureOrder.map((feature) => labelsMap()[feature] || feature);
    const normalizedUserValues = featureOrder.map((feature) => {
        const reference = referenceStats[feature] || 1;
        return Math.min(220, Math.max(0, ((input[feature] || 0) / reference) * 100));
    });
    const normalizedReferenceValues = featureOrder.map(() => 100);

    const ctx = document.getElementById("radarChart").getContext("2d");
    if (radarChart) radarChart.destroy();

    radarChart = new Chart(ctx, {
        type: "radar",
        data: {
            labels,
            datasets: [
                {
                    label: "Median tham chiếu = 100",
                    data: normalizedReferenceValues,
                    backgroundColor: "rgba(11, 139, 109, 0.14)",
                    borderColor: "rgba(11, 139, 109, 1)",
                    borderWidth: 2
                },
                {
                    label: "Hồ sơ hiện tại",
                    data: normalizedUserValues,
                    backgroundColor: "rgba(194, 75, 67, 0.18)",
                    borderColor: "rgba(194, 75, 67, 1)",
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "top" },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const feature = featureOrder[context.dataIndex];
                            const reference = referenceStats[feature];
                            const value = input[feature];
                            return `${labelsMap()[feature] || feature}: ${value} so với median ${reference}`;
                        }
                    }
                }
            },
            scales: {
                r: {
                    suggestedMin: 0,
                    suggestedMax: 220,
                    ticks: { stepSize: 50, backdropColor: "transparent" },
                    grid: { color: "rgba(21, 49, 38, 0.12)" },
                    angleLines: { color: "rgba(21, 49, 38, 0.1)" }
                }
            }
        }
    });
}

function extractRangeNumbers(value) {
    const matches = String(value ?? "").match(/-?\d+(?:\.\d+)?/g);
    return matches ? matches.map(Number).filter((item) => Number.isFinite(item)) : [];
}

function deriveRangeProfile(item = {}) {
    const optimalNumbers = extractRangeNumbers(item.optimal);
    const watchNumbers = extractRangeNumbers(item.watch);
    const highNumbers = extractRangeNumbers(item.high);

    const optimalUpper = optimalNumbers.length ? Math.max(...optimalNumbers) : 0;
    const watchUpper = watchNumbers.length ? Math.max(...watchNumbers) : optimalUpper;
    const highUpperBase = highNumbers.length ? Math.max(...highNumbers) : Math.max(watchUpper, optimalUpper);
    const highUpper = Math.max(highUpperBase, watchUpper, optimalUpper);
    const watchWidthBase = Math.max(0, watchUpper - optimalUpper);
    const highWidthBase = Math.max(0, highUpper - Math.max(watchUpper, optimalUpper));

    return {
        optimalUpper,
        watchUpper,
        highUpper,
        watchWidth: watchWidthBase || (watchUpper > 0 ? watchUpper * 0.16 : 0),
        highWidth: highWidthBase || (highUpper > 0 ? highUpper * 0.2 : 0)
    };
}

function renderLibraryVisuals(ranges = []) {
    if (!libraryBandsCanvas || !librarySpreadCanvas) return;

    const items = ranges
        .slice(0, 6)
        .map((item) => ({
            label: item.label,
            ...deriveRangeProfile(item)
        }))
        .filter((item) => item.highUpper > 0 || item.watchUpper > 0 || item.optimalUpper > 0);

    if (libraryBandsChart) {
        libraryBandsChart.destroy();
        libraryBandsChart = null;
    }

    if (librarySpreadChart) {
        librarySpreadChart.destroy();
        librarySpreadChart = null;
    }

    if (!items.length) return;

    libraryBandsChart = new Chart(libraryBandsCanvas.getContext("2d"), {
        type: "bar",
        data: {
            labels: items.map((item) => item.label),
            datasets: [
                {
                    label: "Tốt",
                    data: items.map((item) => Number(item.optimalUpper.toFixed(2))),
                    backgroundColor: "rgba(13, 107, 89, 0.78)",
                    borderRadius: 999
                },
                {
                    label: "Theo dõi",
                    data: items.map((item) => Number(item.watchWidth.toFixed(2))),
                    backgroundColor: "rgba(197, 138, 36, 0.74)",
                    borderRadius: 999
                },
                {
                    label: "Cảnh báo",
                    data: items.map((item) => Number(item.highWidth.toFixed(2))),
                    backgroundColor: "rgba(182, 84, 70, 0.7)",
                    borderRadius: 999
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "y",
            plugins: {
                legend: { position: "top" }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { color: "rgba(21, 49, 38, 0.08)" },
                    ticks: { color: "rgba(18, 38, 32, 0.58)" }
                },
                y: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: "rgba(18, 38, 32, 0.74)" }
                }
            }
        }
    });

    librarySpreadChart = new Chart(librarySpreadCanvas.getContext("2d"), {
        type: "line",
        data: {
            labels: items.map((item) => item.label),
            datasets: [
                {
                    label: "Trần tốt",
                    data: items.map((item) => Number(item.optimalUpper.toFixed(2))),
                    borderColor: "rgba(13, 107, 89, 1)",
                    backgroundColor: "rgba(13, 107, 89, 0.12)",
                    tension: 0.34,
                    fill: false
                },
                {
                    label: "Trần theo dõi",
                    data: items.map((item) => Number(item.watchUpper.toFixed(2))),
                    borderColor: "rgba(197, 138, 36, 1)",
                    backgroundColor: "rgba(197, 138, 36, 0.12)",
                    tension: 0.34,
                    fill: false
                },
                {
                    label: "Trần cảnh báo",
                    data: items.map((item) => Number(item.highUpper.toFixed(2))),
                    borderColor: "rgba(182, 84, 70, 1)",
                    backgroundColor: "rgba(182, 84, 70, 0.12)",
                    tension: 0.34,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "top" }
            },
            scales: {
                x: {
                    grid: { color: "rgba(21, 49, 38, 0.06)" },
                    ticks: { color: "rgba(18, 38, 32, 0.7)" }
                },
                y: {
                    grid: { color: "rgba(21, 49, 38, 0.08)" },
                    ticks: { color: "rgba(18, 38, 32, 0.58)" }
                }
            }
        }
    });
}

function renderReferenceGrid(ranges = []) {
    referenceGrid.innerHTML = ranges
        .map(
            (item) => `
                <article class="reference-card">
                    <h3>${item.label}</h3>
                    <p><strong>Tốt:</strong> ${item.optimal} ${item.unit}</p>
                    <p><strong>Theo dõi:</strong> ${item.watch} ${item.unit}</p>
                    <p><strong>Cảnh báo:</strong> ${item.high} ${item.unit}</p>
                    <p>${item.note}</p>
                </article>
            `
        )
        .join("");
}

function enhanceReferenceGrid(ranges = []) {
    renderReferenceGrid(ranges);

    Array.from(referenceGrid.querySelectorAll(".reference-card")).forEach((card, index) => {
        const item = ranges[index];
        if (!item) return;

        const profile = deriveRangeProfile(item);
        const total = Math.max(1, profile.optimalUpper + profile.watchWidth + profile.highWidth);
        const optimalWidth = ((profile.optimalUpper / total) * 100).toFixed(2);
        const watchWidth = ((profile.watchWidth / total) * 100).toFixed(2);
        const highWidth = ((profile.highWidth / total) * 100).toFixed(2);
        const note = card.querySelector("p:last-of-type");

        if (!note) return;

        note.insertAdjacentHTML(
            "beforebegin",
            `
                <div class="reference-band" aria-hidden="true">
                    <div class="reference-band__track">
                        <span class="reference-band__segment reference-band__segment--good" style="width:${optimalWidth}%"></span>
                        <span class="reference-band__segment reference-band__segment--watch" style="width:${watchWidth}%"></span>
                        <span class="reference-band__segment reference-band__segment--high" style="width:${highWidth}%"></span>
                    </div>
                    <div class="reference-band__legend">
                        <span>Tốt</span>
                        <span>Theo dõi</span>
                        <span>Cảnh báo</span>
                    </div>
                </div>
            `
        );
    });

    renderLibraryVisuals(ranges);
}

function renderCarePathway(items = []) {
    if (!carePathway) return;

    carePathwayItems = items;

    if (!items.length) {
        carePathway.innerHTML = '<article class="stack-card"><p>Chưa tải được workflow từ backend.</p></article>';
        return;
    }

    carePathway.innerHTML = `
        <div class="stepper">
            <div class="stepper-track">
                ${items
                    .map(
                        (item, index) => `
                            <button type="button" class="stepper-step ${index === 0 ? "is-active" : ""}" data-step-index="${index}">
                                <span class="stepper-step__dot">${index + 1}</span>
                                <span class="stepper-step__content">
                                    <span class="stepper-step__eyebrow">${item.timeframe}</span>
                                    <span class="stepper-step__title">${item.title}</span>
                                </span>
                            </button>
                        `
                    )
                    .join("")}
            </div>
            <div class="stepper-preview"></div>
        </div>
    `;

    syncCarePathwayPreview(0);
}

function syncCarePathwayPreview(activeIndex) {
    if (!carePathway || !carePathwayItems.length) return;

    const safeIndex = Math.max(0, Math.min(activeIndex, carePathwayItems.length - 1));
    const preview = carePathway.querySelector(".stepper-preview");
    const activeItem = carePathwayItems[safeIndex];

    carePathway.querySelectorAll(".stepper-step").forEach((step) => {
        step.classList.toggle("is-active", Number(step.dataset.stepIndex) === safeIndex);
    });

    if (!preview) return;

    preview.innerHTML = `
        <span class="status-chip tone-neutral">${activeItem.timeframe}</span>
        <h3>${activeItem.title}</h3>
        <p>${activeItem.detail}</p>
    `;
}

function renderEducation(items = []) {
    educationList.innerHTML = items
        .map(
            (item) => `
                <article class="stack-card">
                    <h3>${item.title}</h3>
                    <p>${item.detail}</p>
                </article>
            `
        )
        .join("");
}

function renderModelInfo(info = {}) {
    const benchmark = info.benchmark || {};
    const accuracyValue = benchmark.holdout_accuracy != null
        ? `${(benchmark.holdout_accuracy * 100).toFixed(1)}%`
        : "N/A";
    const rocAucValue = benchmark.holdout_roc_auc != null
        ? benchmark.holdout_roc_auc.toFixed(3)
        : "N/A";
    const cvRocAucValue = benchmark.cross_validation_roc_auc != null
        ? benchmark.cross_validation_roc_auc.toFixed(3)
        : "N/A";

    modelVersion.textContent = `v${info.version || "2.0"}`;
    if (benchmark.holdout_roc_auc != null) {
        benchmarkStat.classList.add("count-up");
        primeCountUp(benchmarkStat, benchmark.holdout_roc_auc, 3);
        benchmarkStat.textContent = "0.000";

        if (benchmarkStat.dataset.countAnimated === "true") {
            animateMetricNumber(benchmarkStat, benchmark.holdout_roc_auc, {
                start: 0,
                decimals: 3
            });
        }
    } else {
        benchmarkStat.classList.remove("count-up");
        benchmarkStat.dataset.countAnimated = "true";
        benchmarkStat.textContent = "N/A";
    }

    if (!modelInfoPanel) return;

    modelInfoPanel.innerHTML = `
        <article class="stack-card">
            <h3>${info.name || "Diabetes Clinical Hybrid"}</h3>
            <p>${info.serving_strategy || "AI kết hợp diễn giải lâm sàng."}</p>
        </article>
        <article class="stack-card">
            <span class="status-chip tone-neutral">Benchmark</span>
            <div class="table-wrap table-wrap--compact">
                <table>
                    <thead>
                        <tr>
                            <th>Accuracy</th>
                            <th>ROC-AUC</th>
                            <th>CV ROC-AUC</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${accuracyValue}</td>
                            <td>${rocAucValue}</td>
                            <td>${cvRocAucValue}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </article>
        ${(info.notes || [])
            .map(
                (note) => `
                    <article class="stack-card">
                        <p>${note}</p>
                    </article>
                `
            )
            .join("")}
    `;
}

function renderHistory(rows = []) {
    if (!rows.length) {
        historyBody.innerHTML = '<tr><td colspan="6">Chưa có dữ liệu.</td></tr>';
        return;
    }

    historyBody.innerHTML = rows
        .map(
            (item) => `
                <tr>
                    <td>${new Date(item.created_at).toLocaleString("vi-VN")}</td>
                    <td><span class="status-chip ${riskTone(item.probability)}">${item.has_diabetes}</span></td>
                    <td>${formatPercent(item.probability)}</td>
                    <td>${item.glucose}</td>
                    <td>${item.bmi}</td>
                    <td>${item.age}</td>
                </tr>
            `
        )
        .join("");
}

function savePredictionState(prediction, input) {
    sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
            prediction,
            input,
            savedAt: new Date().toISOString()
        })
    );
}

function restorePredictionState() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
        const parsed = JSON.parse(raw);
        if (!parsed?.prediction || !parsed?.input) return;
        setInputPayload(parsed.input);
        updateRiskMeter(parsed.prediction);
        renderResult(parsed.prediction);
        renderAlerts(parsed.prediction.alerts || []);
        renderActions(parsed.prediction.recommended_actions || []);
        renderMetricInsights(parsed.prediction.metric_insights || []);
        if (Object.keys(referenceStats).length) {
            renderRadarChart(parsed.input);
        }
    } catch (error) {
        sessionStorage.removeItem(STORAGE_KEY);
    }
}

async function fetchJson(endpoint) {
    const response = await fetch(buildApiUrl(endpoint));
    if (!response.ok) {
        throw new Error(`Không tải được ${endpoint}`);
    }
    return response.json();
}

async function loadHistory() {
    const history = await fetchJson("history?limit=10");
    renderHistory(history);
}

function renderError(message) {
    resultPanel.classList.remove("hidden");
    summaryCard.innerHTML = `
        <h3>Không thể phân tích hồ sơ</h3>
        <p>${message}</p>
    `;
    result.innerHTML = `<p>${message}</p>`;
    alertsList.innerHTML = "";
    actionsList.innerHTML = "";
    metricInsights.innerHTML = "";
}

async function bootstrap() {
    const [clinicalRes, modelRes, refRes] = await Promise.allSettled([
        fetchJson("clinical-content"),
        fetchJson("model-info"),
        fetchJson("reference-stats")
    ]);

    if (clinicalRes.status === "fulfilled") {
        clinicalContent = clinicalRes.value;
        enhanceReferenceGrid(clinicalContent.reference_ranges || []);
        renderCarePathway(clinicalContent.care_pathway || []);
        renderEducation(clinicalContent.education_modules || []);
        renderSpecialties(clinicalContent.specialties || []);
    } else {
        referenceGrid.innerHTML = '<article class="reference-card"><h3>Chưa tải được mốc tham chiếu</h3><p>Frontend vẫn hoạt động, nhưng cần backend để hiển thị phần chuyên khoa đầy đủ.</p></article>';
        if (carePathway) {
            carePathway.innerHTML = '<article class="stack-card"><p>Chưa tải được lộ trình theo dõi từ backend.</p></article>';
        }
        educationList.innerHTML = '<article class="stack-card"><p>Chưa tải được thư viện kiến thức chuyên khoa.</p></article>';
    }

    if (modelRes.status === "fulfilled") {
        modelInfo = modelRes.value;
        renderModelInfo(modelInfo);
    } else {
        renderModelInfo({
            name: "Diabetes Clinical Hybrid",
            notes: ["Chưa tải được metadata mô hình từ backend."]
        });
    }

    if (refRes.status === "fulfilled") {
        referenceStats = refRes.value;
    }

    await loadHistory().catch(() => {
        historyBody.innerHTML = '<tr><td colspan="6">Không tải được lịch sử từ backend.</td></tr>';
    });

    restorePredictionState();
    renderQuickSignals();
}

form.addEventListener("input", () => {
    renderQuickSignals();
});

tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
        activateTab(button.dataset.tabTarget);
    });
});

if (carePathway) {
    carePathway.addEventListener("click", (event) => {
        const target = event.target.closest(".stepper-step");
        if (!target) return;
        syncCarePathwayPreview(Number(target.dataset.stepIndex));
    });

    carePathway.addEventListener("pointerover", (event) => {
        if (window.innerWidth < 960) return;

        const target = event.target.closest(".stepper-step");
        if (!target) return;
        syncCarePathwayPreview(Number(target.dataset.stepIndex));
    });
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = getInputPayload();

    submitButton.disabled = true;
    submitButton.textContent = "Đang phân tích...";

    try {
        const response = await fetch(buildApiUrl("predict"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input)
        });

        if (!response.ok) {
            throw new Error("API dự đoán chưa phản hồi thành công. Hãy kiểm tra backend.");
        }

        const prediction = await response.json();
        updateRiskMeter(prediction);
        renderResult(prediction);
        renderAlerts(prediction.alerts || []);
        renderActions(prediction.recommended_actions || []);
        renderMetricInsights(prediction.metric_insights || []);
        if (Object.keys(referenceStats).length) {
            renderRadarChart(input);
        }
        savePredictionState(prediction, input);
        activateTab("predict");
        await loadHistory();
    } catch (error) {
        renderError(error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Phân tích hồ sơ nguy cơ";
    }
});

primeCountUp(document.querySelector(".stat-card--primary .count-up"), 8, 0);
primeCountUp(benchmarkStat, numericValue(benchmarkStat.dataset.countTarget, 0.829), 3);
bootstrap().finally(() => {
    activateTab("predict");
    observeCountUps();
});
