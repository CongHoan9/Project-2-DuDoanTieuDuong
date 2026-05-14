// ===================================================================
// GUEST.JS — Logic dành cho khách: prediction form, charts, clinical
// ===================================================================
// Load sau: common.js | Load trước: user.js
// Sử dụng: UI (window.DiabetesUI), các biến từ common.js

// Đánh giá nhanh các chỉ số đầu vào, trả về mảng tín hiệu (label, text, tone).
// → Không gọi function khác.
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

// Render các card tín hiệu nhanh lên giao diện từ dữ liệu form hiện tại.
// → Gọi: metricPreview(), getInputPayload() [common.js], UI.toneClass() [ui.js]
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

// Render danh sách tag chuyên khoa lên hero section.
// → Không gọi function khác.
function renderSpecialties(items = []) {
    specialtyTags.innerHTML = items.map((item) => `<span>${item}</span>`).join("");
}

// Render kết luận chính của AI lên panel kết quả (summary + chi tiết).
// → Gọi: UI.riskTone() [ui.js]
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

// Render danh sách cờ cảnh báo lâm sàng.
// → Gọi: UI.toneClass() [ui.js]
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

// Render danh sách khuyến nghị tiếp theo cho bệnh nhân.
// → Không gọi function khác.
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

// Render bảng giải thích chi tiết từng chỉ số lâm sàng.
// → Gọi: UI.toneClass() [ui.js]
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

// Vẽ radar chart so sánh input bệnh nhân với median tham chiếu.
// → Gọi: labelsMap() [common.js], referenceStats [common.js], Chart.js
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
                { label: "Median tham chiếu = 100", data: normalizedReferenceValues, backgroundColor: "rgba(11, 139, 109, 0.14)", borderColor: "rgba(11, 139, 109, 1)", borderWidth: 2 },
                { label: "Hồ sơ hiện tại", data: normalizedUserValues, backgroundColor: "rgba(194, 75, 67, 0.18)", borderColor: "rgba(194, 75, 67, 1)", borderWidth: 2 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: "top" }, tooltip: { callbacks: { label(context) { const feature = featureOrder[context.dataIndex]; return `${labelsMap()[feature] || feature}: ${input[feature]} so với median ${referenceStats[feature]}`; } } } },
            scales: { r: { suggestedMin: 0, suggestedMax: 220, ticks: { stepSize: 50, backdropColor: "transparent" }, grid: { color: "rgba(21, 49, 38, 0.12)" }, angleLines: { color: "rgba(21, 49, 38, 0.1)" } } }
        }
    });
}

// Tách các số từ chuỗi mô tả range (ví dụ "70-100" → [70, 100]).
// → Không gọi function khác.
function extractRangeNumbers(value) {
    const matches = String(value ?? "").match(/-?\d+(?:\.\d+)?/g);
    return matches ? matches.map(Number).filter((item) => Number.isFinite(item)) : [];
}

// Chuẩn hóa range profile thành object {optimalUpper, watchUpper, highUpper, ...}.
// → Gọi: extractRangeNumbers()
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
    return { optimalUpper, watchUpper, highUpper, watchWidth: watchWidthBase || (watchUpper > 0 ? watchUpper * 0.16 : 0), highWidth: highWidthBase || (highUpper > 0 ? highUpper * 0.2 : 0) };
}

// Render 2 biểu đồ thư viện (stacked bar + line) so sánh ngưỡng lâm sàng.
// → Gọi: deriveRangeProfile(), Chart.js
function renderLibraryVisuals(ranges = []) {
    if (!libraryBandsCanvas || !librarySpreadCanvas) return;
    const items = ranges.slice(0, 6).map((item) => ({ label: item.label, ...deriveRangeProfile(item) })).filter((item) => item.highUpper > 0 || item.watchUpper > 0 || item.optimalUpper > 0);
    if (libraryBandsChart) { libraryBandsChart.destroy(); libraryBandsChart = null; }
    if (librarySpreadChart) { librarySpreadChart.destroy(); librarySpreadChart = null; }
    if (!items.length) return;
    libraryBandsChart = new Chart(libraryBandsCanvas.getContext("2d"), {
        type: "bar",
        data: { labels: items.map((i) => i.label), datasets: [
            { label: "Tốt", data: items.map((i) => Number(i.optimalUpper.toFixed(2))), backgroundColor: "rgba(13, 107, 89, 0.78)", borderRadius: 999 },
            { label: "Theo dõi", data: items.map((i) => Number(i.watchWidth.toFixed(2))), backgroundColor: "rgba(197, 138, 36, 0.74)", borderRadius: 999 },
            { label: "Cảnh báo", data: items.map((i) => Number(i.highWidth.toFixed(2))), backgroundColor: "rgba(182, 84, 70, 0.7)", borderRadius: 999 }
        ] },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { position: "top" } }, scales: { x: { stacked: true, grid: { color: "rgba(21, 49, 38, 0.08)" }, ticks: { color: "rgba(18, 38, 32, 0.58)" } }, y: { stacked: true, grid: { display: false }, ticks: { color: "rgba(18, 38, 32, 0.74)" } } } }
    });
    librarySpreadChart = new Chart(librarySpreadCanvas.getContext("2d"), {
        type: "line",
        data: { labels: items.map((i) => i.label), datasets: [
            { label: "Trần tốt", data: items.map((i) => Number(i.optimalUpper.toFixed(2))), borderColor: "rgba(13, 107, 89, 1)", backgroundColor: "rgba(13, 107, 89, 0.12)", tension: 0.34, fill: false },
            { label: "Trần theo dõi", data: items.map((i) => Number(i.watchUpper.toFixed(2))), borderColor: "rgba(197, 138, 36, 1)", backgroundColor: "rgba(197, 138, 36, 0.12)", tension: 0.34, fill: false },
            { label: "Trần cảnh báo", data: items.map((i) => Number(i.highUpper.toFixed(2))), borderColor: "rgba(182, 84, 70, 1)", backgroundColor: "rgba(182, 84, 70, 0.12)", tension: 0.34, fill: false }
        ] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } }, scales: { x: { grid: { color: "rgba(21, 49, 38, 0.06)" }, ticks: { color: "rgba(18, 38, 32, 0.7)" } }, y: { grid: { color: "rgba(21, 49, 38, 0.08)" }, ticks: { color: "rgba(18, 38, 32, 0.58)" } } } }
    });
}

// Render grid mốc tham chiếu lâm sàng (tốt/theo dõi/cảnh báo).
// → Không gọi function khác.
function renderReferenceGrid(ranges = []) {
    referenceGrid.innerHTML = ranges.map((item) => `
        <article class="reference-card">
            <h3>${item.label}</h3>
            <p><strong>Tốt:</strong> ${item.optimal} ${item.unit}</p>
            <p><strong>Theo dõi:</strong> ${item.watch} ${item.unit}</p>
            <p><strong>Cảnh báo:</strong> ${item.high} ${item.unit}</p>
            <p>${item.note}</p>
        </article>
    `).join("");
}

// Tăng cường reference grid bằng thanh band màu + vẽ library charts.
// → Gọi: renderReferenceGrid(), deriveRangeProfile(), renderLibraryVisuals()
function enhanceReferenceGrid(ranges = []) {
    renderReferenceGrid(ranges);
    Array.from(referenceGrid.querySelectorAll(".reference-card")).forEach((card, index) => {
        const item = ranges[index]; if (!item) return;
        const profile = deriveRangeProfile(item);
        const total = Math.max(1, profile.optimalUpper + profile.watchWidth + profile.highWidth);
        const optimalWidth = ((profile.optimalUpper / total) * 100).toFixed(2);
        const watchWidth = ((profile.watchWidth / total) * 100).toFixed(2);
        const highWidth = ((profile.highWidth / total) * 100).toFixed(2);
        const note = card.querySelector("p:last-of-type"); if (!note) return;
        note.insertAdjacentHTML("beforebegin", `
            <div class="reference-band" aria-hidden="true">
                <div class="reference-band__track">
                    <span class="reference-band__segment reference-band__segment--good" style="width:${optimalWidth}%"></span>
                    <span class="reference-band__segment reference-band__segment--watch" style="width:${watchWidth}%"></span>
                    <span class="reference-band__segment reference-band__segment--high" style="width:${highWidth}%"></span>
                </div>
                <div class="reference-band__legend"><span>Tốt</span><span>Theo dõi</span><span>Cảnh báo</span></div>
            </div>
        `);
    });
    renderLibraryVisuals(ranges);
}

// Render lộ trình theo dõi (stepper UI) từ dữ liệu care_pathway backend.
// → Gọi: syncCarePathwayPreview()
function renderCarePathway(items = []) {
    if (!carePathway) return;
    carePathwayItems = items;
    if (!items.length) { carePathway.innerHTML = '<article class="stack-card"><p>Chưa tải được workflow từ backend.</p></article>'; return; }
    carePathway.innerHTML = `
        <div class="stepper"><div class="stepper-track">
            ${items.map((item, index) => `
                <button type="button" class="stepper-step ${index === 0 ? "is-active" : ""}" data-step-index="${index}">
                    <span class="stepper-step__dot">${index + 1}</span>
                    <span class="stepper-step__content">
                        <span class="stepper-step__eyebrow">${item.timeframe}</span>
                        <span class="stepper-step__title">${item.title}</span>
                    </span>
                </button>
            `).join("")}
        </div><div class="stepper-preview"></div></div>
    `;
    syncCarePathwayPreview(0);
}

// Đồng bộ preview nội dung cho bước lộ trình đang chọn.
// → Không gọi function khác.
function syncCarePathwayPreview(activeIndex) {
    if (!carePathway || !carePathwayItems.length) return;
    const safeIndex = Math.max(0, Math.min(activeIndex, carePathwayItems.length - 1));
    const preview = carePathway.querySelector(".stepper-preview");
    const activeItem = carePathwayItems[safeIndex];
    carePathway.querySelectorAll(".stepper-step").forEach((step) => { step.classList.toggle("is-active", Number(step.dataset.stepIndex) === safeIndex); });
    if (!preview) return;
    preview.innerHTML = `<span class="status-chip tone-neutral">${activeItem.timeframe}</span><h3>${activeItem.title}</h3><p>${activeItem.detail}</p>`;
}

// Render danh sách bài viết kiến thức chuyên khoa.
// → Không gọi function khác.
function renderEducation(items = []) {
    educationList.innerHTML = items.map((item) => `<article class="stack-card"><h3>${item.title}</h3><p>${item.detail}</p></article>`).join("");
}

// Render thông tin model (version, benchmark accuracy/ROC-AUC).
// → Gọi: UI.primeCountUp(), UI.animateMetricNumber() [ui.js]
function renderModelInfo(info = {}) {
    const benchmark = info.benchmark || {};
    const accuracyValue = benchmark.holdout_accuracy != null ? `${(benchmark.holdout_accuracy * 100).toFixed(1)}%` : "N/A";
    const rocAucValue = benchmark.holdout_roc_auc != null ? benchmark.holdout_roc_auc.toFixed(3) : "N/A";
    const cvRocAucValue = benchmark.cross_validation_roc_auc != null ? benchmark.cross_validation_roc_auc.toFixed(3) : "N/A";
    modelVersion.textContent = `v${info.version || "2.0"}`;
    if (benchmark.holdout_roc_auc != null) {
        benchmarkStat.classList.add("count-up");
        UI.primeCountUp(benchmarkStat, benchmark.holdout_roc_auc, 3);
        benchmarkStat.textContent = "0.000";
        if (benchmarkStat.dataset.countAnimated === "true") { UI.animateMetricNumber(benchmarkStat, benchmark.holdout_roc_auc, { start: 0, decimals: 3 }); }
    } else { benchmarkStat.classList.remove("count-up"); benchmarkStat.dataset.countAnimated = "true"; benchmarkStat.textContent = "N/A"; }
    if (!modelInfoPanel) return;
    modelInfoPanel.innerHTML = `
        <article class="stack-card"><h3>${info.name || "Diabetes Clinical Hybrid"}</h3><p>${info.serving_strategy || "AI kết hợp diễn giải lâm sàng."}</p></article>
        <article class="stack-card"><span class="status-chip tone-neutral">Benchmark</span>
            <div class="table-wrap table-wrap--compact"><table><thead><tr><th>Accuracy</th><th>ROC-AUC</th><th>CV ROC-AUC</th></tr></thead><tbody><tr><td>${accuracyValue}</td><td>${rocAucValue}</td><td>${cvRocAucValue}</td></tr></tbody></table></div>
        </article>
        ${(info.notes || []).map((note) => `<article class="stack-card"><p>${note}</p></article>`).join("")}
    `;
}

// Hiển thị thông báo lỗi khi API predict thất bại.
// → Không gọi function khác.
function renderError(message) {
    resultPanel.classList.remove("hidden");
    summaryCard.innerHTML = `<span class="section-heading">Tóm tắt hồ sơ</span><h3>Không thể phân tích hồ sơ</h3><p>${message}</p>`;
    result.innerHTML = `<p>${message}</p>`;
    alertsList.innerHTML = ""; actionsList.innerHTML = ""; metricInsights.innerHTML = "";
}

// Lưu kết quả dự đoán + input vào sessionStorage để khôi phục khi F5.
// → Không gọi function khác.
function savePredictionState(prediction, input) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ prediction, input, savedAt: new Date().toISOString() }));
}

// Khôi phục kết quả dự đoán từ sessionStorage (nếu có).
// → Gọi: setInputPayload() [common.js], UI.updateRiskMeter() [ui.js],
//        renderResult(), renderAlerts(), renderActions(), renderMetricInsights(), renderRadarChart()
function restorePredictionState() {
    const raw = sessionStorage.getItem(STORAGE_KEY); if (!raw) return;
    try {
        const parsed = JSON.parse(raw); if (!parsed?.prediction || !parsed?.input) return;
        setInputPayload(parsed.input);
        UI.updateRiskMeter(parsed.prediction, { riskMeter, riskPercent, riskBand, certaintyValue, modelProbability, clinicalProbability });
        renderResult(parsed.prediction);
        renderAlerts(parsed.prediction.alerts || []);
        renderActions(parsed.prediction.recommended_actions || []);
        renderMetricInsights(parsed.prediction.metric_insights || []);
        if (Object.keys(referenceStats).length) { renderRadarChart(parsed.input); }
    } catch (error) { sessionStorage.removeItem(STORAGE_KEY); }
}

// Render bảng history đơn giản (stub, sẽ bị user.js override thành V2).
// → Gọi: UI.riskTone(), UI.formatPercent() [ui.js]
function renderHistory(rows = []) {
    if (!rows.length) { historyBody.innerHTML = '<tr><td colspan="6">Chưa có dữ liệu.</td></tr>'; return; }
    historyBody.innerHTML = rows.map((item) => `
        <tr>
            <td>${new Date(item.created_at).toLocaleString("vi-VN")}</td>
            <td><span class="status-chip ${UI.riskTone(item.probability)}">${item.has_diabetes}</span></td>
            <td>${UI.formatPercent(item.probability)}</td>
            <td>${item.glucose}</td>
            <td>${item.bmi}</td>
            <td>${item.age}</td>
        </tr>
    `).join("");
}

// Stub selectHistoryRecord (sẽ bị user.js override thành V2 với detail panel).
// → Không gọi function khác.
function selectHistoryRecord() {}

// Stub loadHistory (sẽ bị auth-rbac.js override khi có Supabase session).
async function loadHistory() { renderHistory([]); }

// Khởi tạo dữ liệu nền: tải clinical content, model info, reference stats từ backend.
// → Gọi: fetchJson() [common.js], enhanceReferenceGrid(), renderCarePathway(),
//        renderEducation(), renderSpecialties(), renderModelInfo(), restorePredictionState(),
//        renderQuickSignals()
async function bootstrap() {
    const [clinicalRes, modelRes, refRes] = await Promise.allSettled([ fetchJson("clinical-content"), fetchJson("model-info"), fetchJson("reference-stats") ]);
    if (clinicalRes.status === "fulfilled") {
        clinicalContent = clinicalRes.value;
        enhanceReferenceGrid(clinicalContent.reference_ranges || []);
        renderCarePathway(clinicalContent.care_pathway || []);
        renderEducation(clinicalContent.education_modules || []);
        renderSpecialties(clinicalContent.specialties || []);
    } else {
        referenceGrid.innerHTML = '<article class="reference-card"><h3>Chưa tải được mốc tham chiếu</h3><p>Frontend vẫn hoạt động, nhưng cần backend để hiển thị phần chuyên khoa đầy đủ.</p></article>';
        if (carePathway) { carePathway.innerHTML = '<article class="stack-card"><p>Chưa tải được lộ trình theo dõi từ backend.</p></article>'; }
        educationList.innerHTML = '<article class="stack-card"><p>Chưa tải được thư viện kiến thức chuyên khoa.</p></article>';
    }
    if (modelRes.status === "fulfilled") { modelInfo = modelRes.value; renderModelInfo(modelInfo); }
    else { renderModelInfo({ name: "Diabetes Clinical Hybrid", notes: ["Chưa tải được metadata mô hình từ backend."] }); }
    if (refRes.status === "fulfilled") { referenceStats = refRes.value; }
    restorePredictionState();
    renderQuickSignals();
}

// --- Event listeners ---
form.addEventListener("input", () => { renderQuickSignals(); });

window.addEventListener("diabetes:tab-activated", () => {
    [radarChart, libraryBandsChart, librarySpreadChart].forEach((c) => c?.resize?.());
});

if (carePathway) {
    carePathway.addEventListener("click", (event) => { const target = event.target.closest(".stepper-step"); if (!target) return; syncCarePathwayPreview(Number(target.dataset.stepIndex)); });
    carePathway.addEventListener("pointerover", (event) => { if (window.innerWidth < 960) return; const target = event.target.closest(".stepper-step"); if (!target) return; syncCarePathwayPreview(Number(target.dataset.stepIndex)); });
}

UI.primeCountUp(document.querySelector(".stat-card--primary .count-up"), 8, 0);
UI.primeCountUp(benchmarkStat, UI.numericValue(benchmarkStat.dataset.countTarget, 0.829), 3);
bootstrap().finally(() => {
    UI.activateTab("predict", Array.from(document.querySelectorAll(".tab-button")), Array.from(document.querySelectorAll(".tab-panel")), [radarChart, libraryBandsChart, librarySpreadChart]);
    UI.observeCountUps(document, countObserver);
});
