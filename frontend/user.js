// ===================================================================
// USER.JS — Logic dành cho User đã đăng nhập
// Bao gồm: Prediction submit, History V2, filters, detail panel
// ===================================================================
// Load sau: guest.js | Load trước: admin.js
// Sử dụng: UI (window.DiabetesUI), các biến từ common.js

// --- History V2 State ---
const historyV2State = {
    rows: [],
    filteredRows: [],
    selectedId: null,
    detailCache: new Map(),
    activeRequestId: 0,
    filtersBound: false,
    detailBound: false
};
window.historyV2State = historyV2State;

// Chuẩn hóa text tiếng Việt để tìm kiếm không phân biệt dấu.
// → Không gọi function khác.
function historyNormalizeText(value) {
    return String(value ?? "").toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Escape HTML output đầy đủ (bao gồm single quote).
// → Không gọi function khác.
function historyEscapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Format ngày tháng theo locale vi-VN.
// → Không gọi function khác.
function historyFormatDate(value) {
    return new Date(value).toLocaleString("vi-VN");
}

// Format giá trị số theo loại chỉ số (làm tròn phù hợp).
// → Không gọi function khác.
function historyFormatMetricValue(metric, value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return "-";
    if (metric === "Pregnancies" || metric === "Age") return `${Math.round(numericValue)}`;
    if (metric === "DiabetesPedigreeFunction") return numericValue.toFixed(3);
    return numericValue.toFixed(1);
}

// Trả về map nhãn tiếng Việt cho từng feature.
// → Sử dụng: fallbackLabels [common.js]
function historyLabelsMap() {
    return fallbackLabels;
}

// Trả về map đơn vị đo lường cho từng feature.
// → Sử dụng: fallbackUnits [common.js]
function historyUnitsMap() {
    return fallbackUnits;
}

// Dựng layout History V2: toolbar filters, status row, detail panel.
// Bind filter + close events (chỉ bind 1 lần).
// → Gọi: renderHistory(), closeHistoryDetail()
function ensureHistoryV2Layout() {
    const historyGrid = document.querySelector('[data-tab-panel="history"] .dashboard-grid--history');
    const historyPanel = historyGrid?.querySelector(".history-panel");
    const historyHeading = historyPanel?.querySelector(".section-heading");
    const tableWrap = historyPanel?.querySelector(".table-wrap");
    const tableHeadRow = historyPanel?.querySelector("#historyTable thead tr");
    if (!historyGrid || !historyPanel || !historyHeading || !tableWrap || !tableHeadRow) return null;

    historyHeading.textContent = "Lịch sử kiểm tra";
    tableWrap.classList.add("history-table-wrap");
    tableHeadRow.innerHTML = `<th>Thời gian</th><th>Kết luận</th><th>Nguy cơ</th><th>Glucose</th><th>BMI</th><th>Tuổi</th>`;

    let toolbar = historyPanel.querySelector(".history-toolbar");
    if (!toolbar) {
        toolbar = document.createElement("div");
        toolbar.className = "history-toolbar";
        toolbar.innerHTML = `
            <label class="history-filter history-filter--search"><span>Tìm kiếm</span><input id="historyQuery" type="search" placeholder="Kết luận, nguy cơ, glucose..." /></label>
            <div class="history-toolbar__row">
                <label class="history-filter"><span>Kết luận</span><select id="historyOutcomeFilter"><option value="">Tất cả</option><option value="nguy co thap">Nguy cơ thấp</option><option value="can danh gia them">Cần đánh giá thêm</option><option value="co nguy co cao">Có nguy cơ cao</option></select></label>
                <label class="history-filter"><span>Mức nguy cơ</span><select id="historyRiskFilter"><option value="">Tất cả</option><option value="thap">Thấp</option><option value="theo doi som">Theo dõi sớm</option><option value="trung binh">Trung bình</option><option value="cao">Cao</option><option value="rat cao">Rất cao</option></select></label>
                <label class="history-filter"><span>Sắp xếp</span><select id="historySortFilter"><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option><option value="risk_desc">Risk giảm dần</option><option value="risk_asc">Risk tăng dần</option></select></label>
                <button id="historyResetButton" type="button" class="button-secondary history-reset-button">Đặt lại</button>
            </div>`;
        historyPanel.insertBefore(toolbar, tableWrap);
    }

    let statusRow = historyPanel.querySelector(".history-table-status");
    if (!statusRow) {
        statusRow = document.createElement("div");
        statusRow.className = "history-table-status";
        statusRow.innerHTML = '<span id="historyCountLabel">Đang tải lịch sử...</span>';
        historyPanel.insertBefore(statusRow, tableWrap);
    }

    let detailPanel = historyGrid.querySelector(".history-detail-panel");
    if (!detailPanel) {
        detailPanel = document.createElement("article");
        detailPanel.className = "panel history-detail-panel";
        historyPanel.insertAdjacentElement("afterend", detailPanel);
    }
    detailPanel.className = "panel history-detail-panel";
    if (!detailPanel.querySelector("#historyDetailContent")) {
        detailPanel.innerHTML = `
            <div class="section-heading">Chi tiết lần kiểm tra</div>
            <div id="historyDetailContent" class="history-detail-shell">
                <article class="history-record history-record--empty"><h3>Chọn một bản ghi</h3><p>Chi tiết sẽ được tải khi bạn chọn một dòng trong lịch sử ở bên trên.</p></article>
            </div>`;
    } else {
        const detailHeading = detailPanel.querySelector(".section-heading");
        if (detailHeading) detailHeading.textContent = "Chi tiết lần kiểm tra";
    }

    if (!historyV2State.filtersBound) {
        const rerender = () => renderHistory(historyV2State.rows);
        toolbar.querySelector("#historyQuery")?.addEventListener("input", rerender);
        toolbar.querySelector("#historyOutcomeFilter")?.addEventListener("change", rerender);
        toolbar.querySelector("#historyRiskFilter")?.addEventListener("change", rerender);
        toolbar.querySelector("#historySortFilter")?.addEventListener("change", rerender);
        toolbar.querySelector("#historyResetButton")?.addEventListener("click", () => {
            toolbar.querySelector("#historyQuery").value = "";
            toolbar.querySelector("#historyOutcomeFilter").value = "";
            toolbar.querySelector("#historyRiskFilter").value = "";
            toolbar.querySelector("#historySortFilter").value = "newest";
            renderHistory(historyV2State.rows);
        });
        historyV2State.filtersBound = true;
    }

    if (!historyV2State.detailBound) {
        detailPanel.addEventListener("click", (event) => {
            if (!event.target.closest("[data-close-history-detail]")) return;
            closeHistoryDetail();
        });
        historyV2State.detailBound = true;
    }

    return {
        toolbar, detailPanel,
        detailContent: detailPanel.querySelector("#historyDetailContent"),
        countLabel: historyPanel.querySelector("#historyCountLabel")
    };
}

// Lấy các DOM controls của History V2 (search, filters, count, detail).
// → Gọi: ensureHistoryV2Layout()
function getHistoryV2Controls() {
    const refs = ensureHistoryV2Layout();
    if (!refs) return null;
    return {
        queryInput: refs.toolbar.querySelector("#historyQuery"),
        outcomeFilter: refs.toolbar.querySelector("#historyOutcomeFilter"),
        riskFilter: refs.toolbar.querySelector("#historyRiskFilter"),
        sortFilter: refs.toolbar.querySelector("#historySortFilter"),
        countLabel: refs.countLabel,
        detailContent: refs.detailContent
    };
}

// Render placeholder vào detail panel (trạng thái chờ/rỗng).
// → Gọi: getHistoryV2Controls(), historyEscapeHtml()
function renderHistoryV2Placeholder(title, message, targetEl) {
    const container = targetEl ?? getHistoryV2Controls()?.detailContent;
    if (!container) return;
    container.innerHTML = `<article class="history-record history-record--empty"><h3>${historyEscapeHtml(title)}</h3><p>${historyEscapeHtml(message)}</p></article>`;
}

// Đóng detail panel, bỏ chọn bản ghi, render lại table.
// → Gọi: renderHistory(), renderHistoryV2Placeholder()
function closeHistoryDetail() {
    historyV2State.selectedId = null;
    historyV2State.activeRequestId += 1;
    renderHistory(historyV2State.rows);
    renderHistoryV2Placeholder("Chọn một bản ghi", "Chi tiết sẽ được tải khi bạn chọn một dòng trong lịch sử ở bên trên.");
}

// Lọc + sắp xếp dữ liệu history theo giá trị filter hiện tại.
// → Gọi: getHistoryV2Controls(), historyNormalizeText()
function getFilteredHistoryRows() {
    const controls = getHistoryV2Controls();
    if (!controls) return historyV2State.rows;
    const query = historyNormalizeText(controls.queryInput.value);
    const outcome = historyNormalizeText(controls.outcomeFilter.value);
    const risk = historyNormalizeText(controls.riskFilter.value);
    const sortBy = controls.sortFilter.value || "newest";
    const rows = historyV2State.rows.filter((item) => {
        const haystack = historyNormalizeText([item.created_at, item.has_diabetes, item.risk_band, item.glucose, item.bmi, item.age].join(" "));
        return (!query || haystack.includes(query)) && (!outcome || historyNormalizeText(item.has_diabetes).includes(outcome)) && (!risk || historyNormalizeText(item.risk_band).includes(risk));
    });
    rows.sort((left, right) => {
        if (sortBy === "oldest") return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
        if (sortBy === "risk_desc") return (right.risk_score ?? 0) - (left.risk_score ?? 0);
        if (sortBy === "risk_asc") return (left.risk_score ?? 0) - (right.risk_score ?? 0);
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
    return rows;
}

// Render toàn bộ detail panel cho 1 bản ghi lịch sử (full clinical view).
// → Gọi: historyLabelsMap(), historyUnitsMap(), historyFormatDate(),
//        historyFormatMetricValue(), historyEscapeHtml(), UI.formatPercent(),
//        UI.riskTone(), featureOrder [common.js]
function renderHistoryV2Detail(detail, targetEl) {
    const container = targetEl ?? getHistoryV2Controls()?.detailContent;
    if (!container) return;
    const input = detail.input_data || {};
    const prediction = detail.prediction || {};
    const labels = historyLabelsMap();
    const units = historyUnitsMap();
    const summary = prediction.summary || "Chưa có tóm tắt cho bản ghi này.";
    const outcome = prediction.has_diabetes || "Không rõ";
    const riskBandVal = prediction.risk_band || "-";
    const riskScore = prediction.risk_score ?? "--";
    const probability = UI.formatPercent(prediction.probability || 0);
    const savedAt = historyFormatDate(detail.created_at);
    const generatedAt = historyFormatDate(prediction.generated_at || detail.created_at);
    const driverList = (prediction.key_drivers || []).length ? prediction.key_drivers.map((d) => `<li>${historyEscapeHtml(d)}</li>`).join("") : "<li>Chưa có yếu tố nổi bật được lưu.</li>";
    const alertList = (prediction.alerts || []).length ? prediction.alerts.map((a) => `<li><strong>${historyEscapeHtml(a.title)}:</strong> ${historyEscapeHtml(a.detail)}</li>`).join("") : "<li>Không có cảnh báo lâm sàng được lưu cho bản ghi này.</li>";
    const actionList = (prediction.recommended_actions || []).length ? prediction.recommended_actions.map((a) => `<li><strong>${historyEscapeHtml(a.timeframe)} - ${historyEscapeHtml(a.action)}:</strong> ${historyEscapeHtml(a.reason)}</li>`).join("") : "<li>Chưa có khuyến nghị chi tiết được lưu.</li>";
    const missingFlagList = (prediction.missing_data_flags || []).length ? prediction.missing_data_flags.map((f) => `<li>${historyEscapeHtml(f)}</li>`).join("") : "";
    const insightRows = (prediction.metric_insights || []).length
        ? prediction.metric_insights.map((item) => `<tr><td>${historyEscapeHtml(labels[item.metric] || item.label)}</td><td>${historyEscapeHtml(`${historyFormatMetricValue(item.metric, item.value)}${units[item.metric] || item.unit ? ` ${units[item.metric] || item.unit}` : ""}`)}</td><td>${historyEscapeHtml(item.status)}</td><td>${historyEscapeHtml(item.reference)}</td></tr>`).join("")
        : `<tr><td colspan="4">Chưa có metric insight chi tiết trong bản ghi này.</td></tr>`;

    container.innerHTML = `
        <article class="history-record">
            <header class="history-record__topbar">
                <div class="history-record__headline">
                    <p class="history-record__eyebrow">Hồ sơ lần kiểm tra</p>
                    <h3>${historyEscapeHtml(riskBandVal)} - ${historyEscapeHtml(riskScore)}/100</h3>
                    <p>${historyEscapeHtml(summary)}</p>
                </div>
                <button type="button" class="history-detail-close" data-close-history-detail>Đóng</button>
            </header>
            <section class="history-record__section"><h4>Tóm tắt hồ sơ</h4>
                <dl class="history-record__summary">
                    <div><dt>Kết luận</dt><dd><span class="status-chip ${UI.riskTone(prediction.probability || 0)}">${historyEscapeHtml(outcome)}</span></dd></div>
                    <div><dt>Mức nguy cơ</dt><dd>${historyEscapeHtml(`${riskBandVal} - ${riskScore}/100`)}</dd></div>
                    <div><dt>Xác suất AI</dt><dd>${historyEscapeHtml(probability)}</dd></div>
                    <div><dt>Thời gian lưu</dt><dd>${historyEscapeHtml(savedAt)}</dd></div>
                    <div><dt>Thời điểm AI kết luận</dt><dd>${historyEscapeHtml(generatedAt)}</dd></div>
                </dl>
            </section>
            <section class="history-record__section"><h4>Thông tin lâm sàng đầu vào</h4>
                <dl class="history-record__fields">${featureOrder.map((f) => `<div><dt>${historyEscapeHtml(labels[f] || f)}</dt><dd>${historyEscapeHtml(`${historyFormatMetricValue(f, input[f])}${units[f] ? ` ${units[f]}` : ""}`)}</dd></div>`).join("")}</dl>
            </section>
            <section class="history-record__section"><h4>Nhận định lâm sàng</h4>
                <div class="history-record__notes">
                    <p><strong>Diễn giải:</strong> ${historyEscapeHtml(prediction.clinical_interpretation || "Chưa có dữ liệu.")}</p>
                    <p><strong>Khuyến nghị ngắn:</strong> ${historyEscapeHtml(prediction.advice || "Chưa có dữ liệu.")}</p>
                    <p><strong>Lưu ý:</strong> ${historyEscapeHtml(prediction.disclaimer || "Chưa có dữ liệu.")}</p>
                </div>
            </section>
            <section class="history-record__section"><h4>Yếu tố nổi bật</h4><ol class="history-record__list">${driverList}</ol></section>
            ${missingFlagList ? `<section class="history-record__section"><h4>Dữ liệu nội suy</h4><ul class="history-record__list">${missingFlagList}</ul></section>` : ""}
            <section class="history-record__section"><h4>Cảnh báo lâm sàng</h4><ul class="history-record__list">${alertList}</ul></section>
            <section class="history-record__section"><h4>Khuyến nghị tiếp theo</h4><ul class="history-record__list">${actionList}</ul></section>
            <section class="history-record__section"><h4>Bảng giải thích chỉ số</h4>
                <div class="history-record__table-wrap"><table class="history-record__table"><thead><tr><th>Chỉ số</th><th>Giá trị</th><th>Trạng thái</th><th>Tham chiếu</th></tr></thead><tbody>${insightRows}</tbody></table></div>
            </section>
        </article>`;
}

// --- Expose cho admin.js dùng lại ---
window.renderHistoryV2Detail = renderHistoryV2Detail;
window.renderHistoryV2Placeholder = renderHistoryV2Placeholder;

// --- Override renderHistory (V2 với filters) ---
// Chọn 1 bản ghi, highlight row và render detail từ cache.
// → Gọi: renderHistory(), renderHistoryV2Detail(), renderHistoryV2Placeholder()
selectHistoryRecord = async function(recordId) {
    const numericId = Number(recordId);
    if (!Number.isFinite(numericId)) return;
    historyV2State.selectedId = numericId;
    renderHistory(historyV2State.rows);
    const cachedDetail = historyV2State.detailCache.get(numericId);
    if (cachedDetail) { renderHistoryV2Detail(cachedDetail); return; }
    renderHistoryV2Placeholder("Đang tải chi tiết", "Đang lấy phần diễn giải lâm sàng cho bản ghi này...");
};

// Override renderHistory từ guest.js: render bảng V2 với filter + highlight.
// → Gọi: getHistoryV2Controls(), getFilteredHistoryRows(), renderHistoryV2Placeholder(),
//        historyEscapeHtml(), historyFormatDate(), historyFormatMetricValue(),
//        UI.riskTone(), UI.formatPercent()
renderHistory = function(rows = []) {
    const controls = getHistoryV2Controls();
    if (!controls) return;
    historyV2State.rows = Array.isArray(rows) ? rows : [];
    historyV2State.filteredRows = getFilteredHistoryRows();
    if (controls.countLabel) {
        controls.countLabel.textContent = `Đang hiển thị ${historyV2State.filteredRows.length}/${historyV2State.rows.length} bản ghi`;
    }
    if (!historyV2State.filteredRows.length) {
        const emptyMessage = historyV2State.rows.length ? "Không có bản ghi phù hợp với bộ lọc hiện tại." : "Chưa có dữ liệu.";
        historyBody.innerHTML = `<tr><td colspan="6">${emptyMessage}</td></tr>`;
        if (!historyV2State.selectedId || !historyV2State.rows.length) {
            renderHistoryV2Placeholder("Chọn một bản ghi", "Chi tiết sẽ được tải khi bạn chọn một dòng trong lịch sử ở bên trên.");
        }
        return;
    }
    const visibleIds = new Set(historyV2State.filteredRows.map((item) => item.id));
    if (historyV2State.selectedId && !visibleIds.has(historyV2State.selectedId)) {
        historyV2State.selectedId = null;
        renderHistoryV2Placeholder("Bản ghi đã bị ẩn bởi bộ lọc", "Hãy chọn một bản ghi đang hiển thị để xem chi tiết.");
    } else if (!historyV2State.selectedId) {
        renderHistoryV2Placeholder("Chọn một bản ghi", "Chi tiết sẽ được tải khi bạn chọn một dòng trong lịch sử ở bên trên.");
    }
    historyBody.innerHTML = historyV2State.filteredRows.map((item) => `
        <tr class="${historyV2State.selectedId === item.id ? "is-active" : ""}" data-history-id="${item.id}" tabindex="0" role="button" aria-label="Mở chi tiết bản ghi ${item.id}" aria-pressed="${historyV2State.selectedId === item.id ? "true" : "false"}">
            <td>${historyEscapeHtml(historyFormatDate(item.created_at))}</td>
            <td><span class="status-chip ${UI.riskTone(item.probability)}">${historyEscapeHtml(item.has_diabetes)}</span></td>
            <td>${historyEscapeHtml(item.risk_band)} (${historyEscapeHtml(UI.formatPercent(item.probability))})</td>
            <td>${historyEscapeHtml(historyFormatMetricValue("Glucose", item.glucose))}</td>
            <td>${historyEscapeHtml(historyFormatMetricValue("BMI", item.bmi))}</td>
            <td>${historyEscapeHtml(historyFormatMetricValue("Age", item.age))}</td>
        </tr>
    `).join("");
};

// Stub loadHistory (sẽ bị auth-rbac.js override với Supabase fetch).
loadHistory = async function(selectedId = null) {
    renderHistory([]);
    renderHistoryV2Placeholder("Đăng nhập để xem lịch sử", "Lịch sử dự đoán được tải trực tiếp từ Supabase theo tài khoản đang đăng nhập.");
};

// Handler gửi form dự đoán — chỉ chạy khi user đã đăng nhập (auth-rbac.js chặn guest).
// → Gọi: getInputPayload() [common.js], buildApiUrl() [common.js],
//        UI.updateRiskMeter() [ui.js], renderResult() [guest.js],
//        renderAlerts(), renderActions(), renderMetricInsights() [guest.js],
//        renderRadarChart() [guest.js], savePredictionState() [guest.js]
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = getInputPayload();
    submitButton.disabled = true;
    submitButton.textContent = "Đang phân tích...";
    try {
        const response = await fetch(buildApiUrl("predict"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
        if (!response.ok) { throw new Error("API dự đoán chưa phản hồi thành công. Hãy kiểm tra backend."); }
        const prediction = await response.json();
        UI.updateRiskMeter(prediction, { riskMeter, riskPercent, riskBand, certaintyValue, modelProbability, clinicalProbability });
        renderResult(prediction);
        renderAlerts(prediction.alerts || []);
        renderActions(prediction.recommended_actions || []);
        renderMetricInsights(prediction.metric_insights || []);
        if (Object.keys(referenceStats).length) { renderRadarChart(input); }
        savePredictionState(prediction, input);
        window.dispatchEvent(new CustomEvent("diabetes:prediction-complete", { detail: { input, prediction } }));
        UI.activateTab("predict", Array.from(document.querySelectorAll(".tab-button")), Array.from(document.querySelectorAll(".tab-panel")), [radarChart, libraryBandsChart, librarySpreadChart]);
    } catch (error) { renderError(error.message); }
    finally { submitButton.disabled = false; submitButton.textContent = "Phân tích hồ sơ nguy cơ"; }
});

// --- History row click/keyboard event listeners ---
historyBody.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-history-id]"); if (!trigger) return;
    selectHistoryRecord(Number(trigger.dataset.historyId));
});
historyBody.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const trigger = event.target.closest("[data-history-id]"); if (!trigger) return;
    event.preventDefault();
    selectHistoryRecord(Number(trigger.dataset.historyId));
});

// --- Expose globals ---
window.renderHistory = renderHistory;

// Khởi tạo module user: dựng layout History V2 + gọi loadHistory.
// → Gọi: ensureHistoryV2Layout(), loadHistory(), showToast() [common.js]
function initUserModule() {
    try {
        ensureHistoryV2Layout();
        loadHistory();
    } catch (err) {
        showToast("Lỗi khởi tạo dữ liệu, vui lòng F5");
    }
}
initUserModule();
