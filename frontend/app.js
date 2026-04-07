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
const UI = window.DiabetesUI;

let radarChart = null;
let libraryBandsChart = null;
let librarySpreadChart = null;
let referenceStats = {};
let clinicalContent = {};
let modelInfo = {};
let carePathwayItems = [];
// Frontend luôn gọi cùng backend FastAPI qua /api trên cùng domain.
const apiBase = DEFAULT_API_BASE;

const countObserver = UI.createCountObserver();

// Trả về map tên hiển thị của các feature cho giao diện.
function labelsMap() {
    return clinicalContent.feature_labels || fallbackLabels;
}

// Ghép endpoint con thành URL API đầy đủ.
function buildApiUrl(endpoint) {
    const safeEndpoint = String(endpoint || "").replace(/^\/+/, "");
    return `${apiBase}/${safeEndpoint}`; // /api + / + endpoint
}

// Lấy toàn bộ dữ liệu hiện tại từ form nhập liệu.
function getInputPayload() {
    // Đọc toàn bộ dữ liệu người dùng nhập từ form để gửi lên /api/predict.
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

// Đổ dữ liệu vào form, thường dùng khi khôi phục trạng thái cũ.
function setInputPayload(input) {
    featureOrder.forEach((feature) => {
        const field = document.getElementById(feature);
        if (field && input?.[feature] !== undefined) {
            field.value = input[feature];
        }
    });
}

// Sinh các tín hiệu nhanh từ input hiện tại trước khi gọi model.
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

// Render các card tín hiệu nhanh ở phần overview.
function renderQuickSignals(input = getInputPayload()) {
    const signals = metricPreview(input);
    quickSignals.innerHTML = signals
        .map(
            (signal) => `
                <article class="signal-card">
                    <span class="status-chip ${UI.toneClass(signal.tone)}">${signal.label}</span>
                    <p>${signal.text}</p>
                </article>
            `
        )
        .join("");
}

// Hiển thị các tag chuyên khoa hỗ trợ cho ứng dụng.
function renderSpecialties(items = []) {
    specialtyTags.innerHTML = items.map((item) => `<span>${item}</span>`).join("");
}

// Render phần kết luận chính sau khi có kết quả dự đoán.
function renderResult(prediction) {
    resultPanel.classList.remove("hidden");
    summaryCard.innerHTML = `
        <span class="section-heading">Tóm tắt hồ sơ</span>
        <h3>${prediction.has_diabetes}</h3>
        <p>${prediction.summary}</p>
    `;
    result.innerHTML = `
        <span class="status-chip ${UI.riskTone(prediction.probability)}">${prediction.has_diabetes}</span>
        <h2>Điểm nguy cơ ${prediction.risk_score}/100</h2>
        <p>${prediction.summary}</p>
        <p><strong>Diễn giải:</strong> ${prediction.clinical_interpretation}</p>
        <p><strong>Khuyến nghị ngắn:</strong> ${prediction.advice}</p>
        <p><strong>Yếu tố nổi bật:</strong> ${prediction.key_drivers.length ? prediction.key_drivers.join(" ") : "Chưa có yếu tố vượt trội."}</p>
        <p><strong>Lưu ý:</strong> ${prediction.disclaimer}</p>
    `;
}

// Render danh sách các cảnh báo lâm sàng nổi bật.
function renderAlerts(alerts = []) {
    alertsList.innerHTML = alerts
        .map(
            (alert) => `
                <article class="stack-card">
                    <span class="status-chip ${UI.toneClass(alert.level)}">${alert.level}</span>
                    <h3>${alert.title}</h3>
                    <p>${alert.detail}</p>
                </article>
            `
        )
        .join("");
}

// Render danh sách hành động gợi ý tiếp theo.
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

// Render các card giải thích theo từng chỉ số đầu vào.
function renderMetricInsights(insights = []) {
    metricInsights.innerHTML = insights
        .map(
            (item) => `
                <article class="metric-card">
                    <span class="status-chip ${UI.toneClass(item.severity)}">${item.status}</span>
                    <h3>${item.label}: ${item.value} ${item.unit}</h3>
                    <p><strong>Tham chiếu:</strong> ${item.reference}</p>
                    <p><strong>Ý nghĩa:</strong> ${item.clinical_note}</p>
                    <p><strong>Tác động:</strong> ${item.effect}</p>
                </article>
            `
        )
        .join("");
}

// Vẽ radar chart để so sánh input hiện tại với median tham chiếu.
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

// Tách các con số từ chuỗi range để phục vụ trực quan hóa.
function extractRangeNumbers(value) {
    const matches = String(value ?? "").match(/-?\d+(?:\.\d+)?/g);
    return matches ? matches.map(Number).filter((item) => Number.isFinite(item)) : [];
}

// Chuẩn hóa dữ liệu range tham chiếu thành profile dùng cho UI.
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

// Render hai biểu đồ thư viện lâm sàng ở tab Clinical Library.
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

// Render grid các mốc tham chiếu lâm sàng.
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

// Tăng cường thẻ tham chiếu bằng thanh band trực quan.
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

// Render lộ trình theo dõi/điều trị theo từng bước.
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

// Đồng bộ phần preview khi người dùng chọn một bước trong lộ trình.
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

// Render thư viện nội dung giáo dục sức khỏe.
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

// Render thông tin model, benchmark và metadata phục vụ demo.
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
        UI.primeCountUp(benchmarkStat, benchmark.holdout_roc_auc, 3);
        benchmarkStat.textContent = "0.000";

        if (benchmarkStat.dataset.countAnimated === "true") {
            UI.animateMetricNumber(benchmarkStat, benchmark.holdout_roc_auc, {
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

// Render bảng lịch sử kiểm tra gần nhất.
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
                    <td><span class="status-chip ${UI.riskTone(item.probability)}">${item.has_diabetes}</span></td>
                    <td>${UI.formatPercent(item.probability)}</td>
                    <td>${item.glucose}</td>
                    <td>${item.bmi}</td>
                    <td>${item.age}</td>
                </tr>
            `
        )
        .join("");
}

// Lưu trạng thái dự đoán gần nhất trong session để reload trang không bị mất.
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

// Khôi phục trạng thái dự đoán gần nhất từ session storage.
function restorePredictionState() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
        const parsed = JSON.parse(raw);
        if (!parsed?.prediction || !parsed?.input) return;
        setInputPayload(parsed.input);
        UI.updateRiskMeter(parsed.prediction, {
            riskMeter,
            riskPercent,
            riskBand,
            certaintyValue,
            modelProbability,
            clinicalProbability
        });
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

// Hàm helper gọi API GET và trả về JSON.
async function fetchJson(endpoint) {
    // Helper chung cho các API GET trả JSON.
    const response = await fetch(buildApiUrl(endpoint));
    if (!response.ok) {
        throw new Error(`Không tải được ${endpoint}`);
    }
    return response.json();
}

// Tải lịch sử từ backend rồi render ra bảng.
async function loadHistory() {
    // Nạp các bản ghi gần nhất để đổ vào bảng History.
    const history = await fetchJson("history?limit=10");
    renderHistory(history);
}

// Hiển thị trạng thái lỗi khi gọi API hoặc render thất bại.
function renderError(message) {
    resultPanel.classList.remove("hidden");
    summaryCard.innerHTML = `
        <span class="section-heading">Tóm tắt hồ sơ</span>
        <h3>Không thể phân tích hồ sơ</h3>
        <p>${message}</p>
    `;
    result.innerHTML = `<p>${message}</p>`;
    alertsList.innerHTML = "";
    actionsList.innerHTML = "";
    metricInsights.innerHTML = "";
}

// Khởi tạo toàn bộ dữ liệu nền cần cho frontend khi mở ứng dụng.
async function bootstrap() {
    // Khi app mở lần đầu, tải toàn bộ dữ liệu nền cho giao diện.
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
        UI.activateTab(button.dataset.tabTarget, tabButtons, tabPanels, [
            radarChart,
            libraryBandsChart,
            librarySpreadChart
        ]);
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
    event.preventDefault();          // Ngăn form reload trang.
    const input = getInputPayload(); // lấy các giá trị hiện tại từ form để gửi lên API dự đoán.

    // Khi submit: gọi API dự đoán rồi cập nhật toàn bộ dashboard kết quả.
    submitButton.disabled = true;
    submitButton.textContent = "Đang phân tích...";
    // Gọi API dự đoán với input hiện tại.
    try {
        const response = await fetch(buildApiUrl("predict"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input)
        }); // gửi lên server với kiểu POST và payload là JSON chứa input người dùng.

        if (!response.ok) {
            throw new Error("API dự đoán chưa phản hồi thành công. Hãy kiểm tra backend.");
        } // Nếu phản hồi không thành công, ném lỗi để hiển thị thông báo.

        const prediction = await response.json(); // Đọc kết quả dự đoán trả về từ server, kỳ vọng là một object chứa các trường như has_diabetes, risk_score, summary, alerts, recommended_actions, v.v.
        //gọi fun updateRiskMeter bên ui.js
        UI.updateRiskMeter(prediction, { 
            riskMeter,
            riskPercent,
            riskBand,
            certaintyValue,
            modelProbability,
            clinicalProbability
        });
        // Cập nhật toàn bộ giao diện với kết quả dự đoán mới:
        renderResult(prediction);
        renderAlerts(prediction.alerts || []);
        renderActions(prediction.recommended_actions || []);
        renderMetricInsights(prediction.metric_insights || []);
        // nếu có dữ liệu tham chiếu, vẽ radar chart để so sánh input hiện tại với median tham chiếu.
        if (Object.keys(referenceStats).length) {
            renderRadarChart(input);
        }
        // Lưu trạng thái dự đoán và input hiện tại vào session storage để nếu reload trang vẫn giữ được kết quả.
        savePredictionState(prediction, input);
        // gọi fun activateTab bên ui.js.
        UI.activateTab("predict", tabButtons, tabPanels, [
            radarChart,
            libraryBandsChart,
            librarySpreadChart
        ]);
        await loadHistory();
    } catch (error) {
        renderError(error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Phân tích hồ sơ nguy cơ";
    }
});

UI.primeCountUp(document.querySelector(".stat-card--primary .count-up"), 8, 0);
UI.primeCountUp(benchmarkStat, UI.numericValue(benchmarkStat.dataset.countTarget, 0.829), 3);
bootstrap().finally(() => {
    UI.activateTab("predict", tabButtons, tabPanels, [
        radarChart,
        libraryBandsChart,
        librarySpreadChart
    ]);
    UI.observeCountUps(document, countObserver);
});

const historyDetailState = {
    rows: [],
    selectedId: null
};

const fallbackUnits = {
    Pregnancies: "láº§n",
    Glucose: "mg/dL",
    BloodPressure: "mmHg",
    SkinThickness: "mm",
    Insulin: "mu U/mL",
    BMI: "kg/mÂ²",
    DiabetesPedigreeFunction: "Ä‘iá»ƒm",
    Age: "tuá»•i"
};

function unitsMap() {
    return clinicalContent.feature_units || fallbackUnits;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatHistoryDate(value) {
    return new Date(value).toLocaleString("vi-VN");
}

function formatFeatureValue(feature, value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return "-";
    if (feature === "Pregnancies" || feature === "Age") {
        return `${Math.round(numericValue)}`;
    }
    if (feature === "DiabetesPedigreeFunction") {
        return numericValue.toFixed(3);
    }
    return numericValue.toFixed(1);
}

function historyCardHtml(title, body) {
    return `
        <article class="stack-card">
            <h3>${escapeHtml(title)}</h3>
            <p>${body}</p>
        </article>
    `;
}

function ensureHistoryEnhancement() {
    const historyGrid = document.querySelector('[data-tab-panel="history"] .dashboard-grid--history');
    const historyPanel = document.querySelector(".history-panel");
    const historyTableHeadRow = document.querySelector("#historyTable thead tr");

    if (!historyGrid || !historyPanel || !historyTableHeadRow) {
        return null;
    }

    if (!document.getElementById("historyEnhancementStyles")) {
        const style = document.createElement("style");
        style.id = "historyEnhancementStyles";
        style.textContent = `
            .history-panel.history-panel--enhanced {
                grid-column: 1 / span 7;
            }

            .history-detail-panel {
                grid-column: 8 / span 5;
                align-self: start;
            }

            .history-detail-shell,
            .history-detail-section,
            .history-inline-stats,
            .history-kv-grid,
            .history-driver-list,
            .history-flag-list {
                display: grid;
                gap: 14px;
            }

            .history-detail-shell {
                margin-top: 4px;
            }

            .history-detail-hero,
            .history-kv,
            .history-driver-list,
            .history-flag-list {
                padding: 20px;
                border: 1px solid var(--line);
                border-radius: var(--radius-md);
                background: var(--surface-strong);
            }

            .history-detail-hero h3,
            .history-section-title,
            .history-kv strong {
                margin: 0;
                font-family: "Sora", sans-serif;
                letter-spacing: -0.03em;
            }

            .history-detail-hero p,
            .history-kv span,
            .history-driver-list li,
            .history-flag-list li {
                margin: 0;
                color: var(--muted);
                line-height: 1.6;
            }

            .history-inline-stats,
            .history-kv-grid {
                grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .history-kv {
                gap: 8px;
                align-content: start;
            }

            .history-driver-list,
            .history-flag-list {
                margin: 0;
                padding-left: 36px;
            }

            .history-detail-button {
                min-width: 0;
                width: auto;
                padding: 10px 14px;
                border-radius: 999px;
                box-shadow: none;
            }

            #historyTable tbody tr[data-history-id] {
                cursor: pointer;
                transition: background 180ms ease;
            }

            #historyTable tbody tr[data-history-id]:hover {
                background: rgba(13, 107, 89, 0.06);
            }

            #historyTable tbody tr.is-active {
                background: rgba(13, 107, 89, 0.12);
            }

            @media (max-width: 1240px) {
                .history-panel.history-panel--enhanced,
                .history-detail-panel {
                    grid-column: auto;
                }
            }

            @media (max-width: 720px) {
                .history-inline-stats,
                .history-kv-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
    }

    historyPanel.classList.add("history-panel--enhanced");

    if (historyTableHeadRow.children.length < 7) {
        const actionHead = document.createElement("th");
        actionHead.textContent = "Chi tiáº¿t";
        historyTableHeadRow.appendChild(actionHead);
    }

    const emptyCell = historyBody.querySelector("td[colspan='6']");
    if (emptyCell) {
        emptyCell.colSpan = 7;
    }

    let detailPanel = document.getElementById("historyDetailContent");
    if (!detailPanel) {
        const aside = document.createElement("aside");
        aside.className = "panel history-detail-panel";
        aside.innerHTML = `
            <div class="section-heading">Chi tiáº¿t láº§n kiá»ƒm tra</div>
            <div id="historyDetailContent" class="history-detail-shell">
                <article class="stack-card">
                    <h3>Chá»n má»™t dÃ²ng trong báº£ng</h3>
                    <p>Panel nÃ y sáº½ hiá»ƒn thá»‹ Ä‘áº§y Ä‘á»§ input lÃ¢m sÃ ng, diá»…n giáº£i AI, cáº£nh bÃ¡o vÃ  khuyáº¿n nghá»‹.</p>
                </article>
            </div>
        `;
        historyGrid.appendChild(aside);
        detailPanel = aside.querySelector("#historyDetailContent");
    }

    return detailPanel;
}

function renderHistoryDetailPlaceholder(title, message) {
    const detailPanel = ensureHistoryEnhancement();
    if (!detailPanel) return;

    detailPanel.innerHTML = `
        <article class="stack-card">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(message)}</p>
        </article>
    `;
}

function renderHistoryDetail(detail) {
    const detailPanel = ensureHistoryEnhancement();
    if (!detailPanel) return;

    const input = detail.input_data || {};
    const prediction = detail.prediction || {};
    const labels = labelsMap();
    const units = unitsMap();
    const alertsHtml = (prediction.alerts || []).length
        ? (prediction.alerts || [])
            .map(
                (alert) => `
                    <article class="stack-card">
                        <span class="status-chip ${UI.toneClass(alert.level)}">${escapeHtml(alert.level)}</span>
                        <h3>${escapeHtml(alert.title)}</h3>
                        <p>${escapeHtml(alert.detail)}</p>
                    </article>
                `
            )
            .join("")
        : historyCardHtml("Cáº£nh bÃ¡o", "KhÃ´ng cÃ³ cáº£nh bÃ¡o lÃ¢m sÃ ng Ä‘Æ°á»£c lÆ°u cho láº§n nÃ y.");

    const actionsHtml = (prediction.recommended_actions || []).length
        ? (prediction.recommended_actions || [])
            .map(
                (action) => `
                    <article class="stack-card">
                        <span class="status-chip tone-neutral">${escapeHtml(action.timeframe)}</span>
                        <h3>${escapeHtml(action.action)}</h3>
                        <p>${escapeHtml(action.reason)}</p>
                    </article>
                `
            )
            .join("")
        : historyCardHtml("Khuyáº¿n nghá»‹", "ChÆ°a cÃ³ khuyáº¿n nghá»‹ chi tiáº¿t Ä‘Æ°á»£c lÆ°u.");

    const insightsHtml = (prediction.metric_insights || []).length
        ? (prediction.metric_insights || [])
            .map(
                (item) => `
                    <article class="metric-card">
                        <span class="status-chip ${UI.toneClass(item.severity)}">${escapeHtml(item.status)}</span>
                        <h3>${escapeHtml(item.label)}: ${escapeHtml(formatFeatureValue(item.metric, item.value))} ${escapeHtml(item.unit)}</h3>
                        <p><strong>Tham chiáº¿u:</strong> ${escapeHtml(item.reference)}</p>
                        <p><strong>Ã nghÄ©a:</strong> ${escapeHtml(item.clinical_note)}</p>
                        <p><strong>TÃ¡c Ä‘á»™ng:</strong> ${escapeHtml(item.effect)}</p>
                    </article>
                `
            )
            .join("")
        : historyCardHtml("Giáº£i thÃ­ch chá»‰ sá»‘", "ChÆ°a cÃ³ metric insight chi tiáº¿t trong báº£n ghi nÃ y.");

    const driversHtml = (prediction.key_drivers || []).length
        ? `
            <section class="history-detail-section">
                <h3 class="history-section-title">Yáº¿u tá»‘ ná»•i báº­t</h3>
                <ol class="history-driver-list">
                    ${(prediction.key_drivers || []).map((driver) => `<li>${escapeHtml(driver)}</li>`).join("")}
                </ol>
            </section>
        `
        : "";

    const missingFlagsHtml = (prediction.missing_data_flags || []).length
        ? `
            <section class="history-detail-section">
                <h3 class="history-section-title">Dá»¯ liá»‡u Ä‘Æ°á»£c ná»™i suy</h3>
                <ul class="history-flag-list">
                    ${(prediction.missing_data_flags || []).map((flag) => `<li>${escapeHtml(flag)}</li>`).join("")}
                </ul>
            </section>
        `
        : "";

    detailPanel.innerHTML = `
        <article class="history-detail-hero">
            <span class="status-chip ${UI.riskTone(prediction.probability || 0)}">${escapeHtml(prediction.has_diabetes || "KhÃ´ng rÃµ")}</span>
            <h3>${escapeHtml(prediction.risk_band || "-")} - ${escapeHtml(prediction.risk_score ?? "--")}/100</h3>
            <p>${escapeHtml(prediction.summary || "ChÆ°a cÃ³ tÃ³m táº¯t lÆ°u trong lá»‹ch sá»­.")}</p>
            <div class="history-inline-stats">
                <div class="history-kv">
                    <span class="meta-label">Thá»i gian lÆ°u</span>
                    <strong>${escapeHtml(formatHistoryDate(detail.created_at))}</strong>
                </div>
                <div class="history-kv">
                    <span class="meta-label">XÃ¡c suáº¥t AI</span>
                    <strong>${escapeHtml(UI.formatPercent(prediction.probability || 0))}</strong>
                </div>
                <div class="history-kv">
                    <span class="meta-label">Generated At</span>
                    <strong>${escapeHtml(formatHistoryDate(prediction.generated_at || detail.created_at))}</strong>
                </div>
            </div>
        </article>

        <section class="history-detail-section">
            <h3 class="history-section-title">Input lÃ¢m sÃ ng</h3>
            <div class="history-kv-grid">
                ${featureOrder
                    .map(
                        (feature) => `
                            <article class="history-kv">
                                <span class="meta-label">${escapeHtml(labels[feature] || feature)}</span>
                                <strong>${escapeHtml(formatFeatureValue(feature, input[feature]))}</strong>
                                <span>${escapeHtml(units[feature] || "")}</span>
                            </article>
                        `
                    )
                    .join("")}
            </div>
        </section>

        <section class="history-detail-section">
            <h3 class="history-section-title">Diá»…n giáº£i tÃ³m táº¯t</h3>
            <div class="stack-list compact">
                ${historyCardHtml("Káº¿t luáº­n", escapeHtml(prediction.summary || ""))}
                ${historyCardHtml("Diá»…n giáº£i lÃ¢m sÃ ng", escapeHtml(prediction.clinical_interpretation || ""))}
                ${historyCardHtml("Khuyáº¿n nghá»‹ ngáº¯n", escapeHtml(prediction.advice || ""))}
                ${historyCardHtml("LÆ°u Ã½", escapeHtml(prediction.disclaimer || ""))}
            </div>
        </section>

        ${driversHtml}
        ${missingFlagsHtml}

        <section class="history-detail-section">
            <h3 class="history-section-title">Cáº£nh bÃ¡o lÃ¢m sÃ ng</h3>
            <div class="stack-list">${alertsHtml}</div>
        </section>

        <section class="history-detail-section">
            <h3 class="history-section-title">Khuyáº¿n nghá»‹ tiáº¿p theo</h3>
            <div class="stack-list">${actionsHtml}</div>
        </section>

        <section class="history-detail-section">
            <h3 class="history-section-title">Giáº£i thÃ­ch theo tá»«ng chá»‰ sá»‘</h3>
            <div class="metric-grid">${insightsHtml}</div>
        </section>
    `;
}

async function selectHistoryRecord(recordId) {
    if (!Number.isFinite(Number(recordId))) return;

    historyDetailState.selectedId = Number(recordId);
    renderHistory(historyDetailState.rows);
    renderHistoryDetailPlaceholder("Äang táº£i chi tiáº¿t", "Äang láº¥y pháº§n diá»…n giáº£i lÃ¢m sÃ ng cho báº£n ghi nÃ y...");

    try {
        const detail = await fetchJson(`history/${recordId}`);
        renderHistoryDetail(detail);
    } catch (error) {
        renderHistoryDetailPlaceholder("KhÃ´ng táº£i Ä‘Æ°á»£c chi tiáº¿t", error.message);
    }
}

renderHistory = function(rows = []) {
    ensureHistoryEnhancement();
    historyDetailState.rows = rows;

    if (!rows.length) {
        historyBody.innerHTML = '<tr><td colspan="7">ChÆ°a cÃ³ dá»¯ liá»‡u.</td></tr>';
        renderHistoryDetailPlaceholder("ChÆ°a cÃ³ lá»‹ch sá»­", "HÃ£y thá»±c hiá»‡n má»™t láº§n dá»± Ä‘oÃ¡n Ä‘á»ƒ há»‡ thá»‘ng lÆ°u báº£n ghi Ä‘áº§u tiÃªn.");
        return;
    }

    historyBody.innerHTML = rows
        .map(
            (item) => `
                <tr class="${historyDetailState.selectedId === item.id ? "is-active" : ""}" data-history-id="${item.id}" tabindex="0">
                    <td>${escapeHtml(formatHistoryDate(item.created_at))}</td>
                    <td><span class="status-chip ${UI.riskTone(item.probability)}">${escapeHtml(item.has_diabetes)}</span></td>
                    <td>${escapeHtml(item.risk_band)} (${escapeHtml(UI.formatPercent(item.probability))})</td>
                    <td>${escapeHtml(formatFeatureValue("Glucose", item.glucose))}</td>
                    <td>${escapeHtml(formatFeatureValue("BMI", item.bmi))}</td>
                    <td>${escapeHtml(formatFeatureValue("Age", item.age))}</td>
                    <td><button type="button" class="history-detail-button" data-history-id="${item.id}">Xem</button></td>
                </tr>
            `
        )
        .join("");
};

loadHistory = async function(selectedId = null) {
    const history = await fetchJson("history?limit=10");
    renderHistory(history);

    if (!history.length) {
        return;
    }

    const requestedId = selectedId || historyDetailState.selectedId;
    const preferredRow = history.find((item) => item.id === requestedId) || history[0];
    const preferredId = preferredRow.id;
    await selectHistoryRecord(preferredId);
};

historyBody.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-history-id]");
    if (!trigger) return;
    selectHistoryRecord(Number(trigger.dataset.historyId));
});

historyBody.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const trigger = event.target.closest("[data-history-id]");
    if (!trigger) return;

    event.preventDefault();
    selectHistoryRecord(Number(trigger.dataset.historyId));
});
