// ===================================================================
// ADMIN.JS — Logic dành cho Admin: user management, activity log
// ===================================================================
// Load sau: user.js | Load trước: auth-rbac.js
// Sử dụng: window.AppState, $, esc, api từ common.js

// --- Activity logs storage ---
let _adminLogs = [];

// --- Admin modal state ---
const adminModal = {
    allRows: [],
    selectedId: null,
    detailCache: new Map(),
    filtersBound: false
};

// Chuẩn hóa text tiếng Việt để tìm kiếm không phân biệt dấu.
// → Không gọi function khác.
function adminNorm(v) {
    return String(v ?? "").toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Format ngày giờ theo locale vi-VN, safe với giá trị lỗi.
// → Không gọi function khác.
function adminFmt(v) {
    try { return new Date(v).toLocaleString("vi-VN"); } catch (_) { return String(v ?? "–"); }
}

// Format số chỉ số lâm sàng (làm tròn phù hợp theo loại metric).
// → Không gọi function khác.
function adminFmtNum(metric, value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "–";
    if (metric === "Pregnancies" || metric === "Age") return String(Math.round(n));
    if (metric === "DiabetesPedigreeFunction") return n.toFixed(3);
    return n.toFixed(1);
}

// Trả về CSS class tone theo mức xác suất nguy cơ.
// → Không gọi function khác.
function adminRiskTone(prob) {
    const p = Number(prob) || 0;
    if (p >= 0.75) return "tone-critical";
    if (p >= 0.5) return "tone-high";
    if (p >= 0.25) return "tone-medium";
    return "tone-low";
}

// Tải danh sách user (loại trừ admin) qua Supabase RPC.
// → Gọi: isAdmin() [common.js], $() [common.js], esc() [common.js]
async function loadAdminUsers() {
    if (!isAdmin()) return;
    const state = window.AppState;
    const { data, error } = await state.client.rpc("admin_search_profiles", { search_text: $("adminUserSearch")?.value || "", disease_filter: $("adminDiseaseFilter")?.value || null });
    const body = $("adminUsersBody"); if (!body) return;
    if (error) { body.innerHTML = `<tr><td colspan="4">${esc(error.message)}</td></tr>`; return; }
    state.profiles = (data || []).filter(p => p.role !== "admin");
    body.innerHTML = state.profiles.length
        ? state.profiles.map(p => `<tr data-admin-user-id="${p.id}" tabindex="0" role="button"><td>${esc(p.full_name || "–")}</td><td>${esc(p.email || "–")}</td><td>${esc(p.latest_has_diabetes || "Chưa có")}</td><td>${esc(new Date(p.created_at).toLocaleDateString("vi-VN"))}</td></tr>`).join("")
        : '<tr><td colspan="4">Không có người dùng.</td></tr>';
}

// Tải activity logs từ bảng profiles + predictions, merge + sort.
// → Gọi: isAdmin() [common.js], renderLogs()
async function loadLogs() {
    if (!isAdmin()) return;
    const state = window.AppState;
    const [{ data: profiles }, { data: preds }] = await Promise.all([
        state.client.from("profiles").select("full_name,email,role,created_at,updated_at").order("updated_at", { ascending: false }).limit(200),
        state.client.from("predictions").select("created_at,has_diabetes,probability,pregnancies,glucose,blood_pressure,skin_thickness,insulin,bmi,diabetes_pedigree,age,profiles(full_name,email)").order("created_at", { ascending: false }).limit(200)
    ]);
    const logs = [];
    (profiles || []).forEach(p => {
        logs.push({ ts: p.created_at, type: "auth", level: "info", user: p.full_name || p.email, email: p.email, detail: `Tài khoản tạo (${p.role})` });
        if (p.updated_at && p.updated_at !== p.created_at)
            logs.push({ ts: p.updated_at, type: "auth", level: "info", user: p.full_name || p.email, email: p.email, detail: "Hoạt động gần nhất" });
    });
    (preds || []).forEach(p => {
        logs.push(buildPredictionLog(p));
    });
    logs.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    _adminLogs = logs;
    renderLogs();
}

// Tạo object log từ 1 prediction row (dùng chung cho loadLogs + realtime).
// → Không gọi function khác.
function buildPredictionLog(p) {
    const prob = ((p.probability || 0) * 100).toFixed(1);
    const lvl = (p.probability || 0) >= 0.75 ? "critical" : (p.probability || 0) >= 0.4 ? "warn" : "ok";
    const detail = `${p.has_diabetes} — ${prob}%`
        + ` | Preg:${p.pregnancies ?? "–"}`
        + ` Glu:${p.glucose ?? "–"}`
        + ` BP:${p.blood_pressure ?? "–"}`
        + ` Skin:${p.skin_thickness ?? "–"}`
        + ` Ins:${p.insulin ?? "–"}`
        + ` BMI:${p.bmi ?? "–"}`
        + ` DPF:${p.diabetes_pedigree != null ? Number(p.diabetes_pedigree).toFixed(2) : "–"}`
        + ` Age:${p.age ?? "–"}`;
    return {
        ts: p.created_at,
        type: "prediction",
        level: lvl,
        user: p.profiles?.full_name || "–",
        email: p.profiles?.email || "",
        detail
    };
}

// Render bảng activity log với bộ lọc keyword, type, date.
// → Gọi: $() [common.js], esc() [common.js]
function renderLogs() {
    const body = $("logBody"), cnt = $("logCount"); if (!body) return;
    const q = ($("logSearch")?.value || "").toLowerCase(), tf = $("logTypeFilter")?.value || "", df = $("logDateFilter")?.value || "", now = Date.now();
    const out = _adminLogs.filter(l => {
        if (tf && l.type !== tf) return false;
        if (q && !(l.user + l.email + l.detail).toLowerCase().includes(q)) return false;
        if (df) { const d = new Date(l.ts).getTime(); if (df === "today" && new Date(d).toDateString() !== new Date(now).toDateString()) return false; if (df === "7d" && now - d > 6048e5) return false; if (df === "30d" && now - d > 2592e6) return false; }
        return true;
    });
    if (cnt) cnt.textContent = `${out.length} bản ghi`;
    if (!out.length) { body.innerHTML = '<tr><td colspan="4" class="log-empty">Không có bản ghi.</td></tr>'; return; }
    body.innerHTML = out.slice(0, 150).map(l => {
        const t = new Date(l.ts).toISOString().replace("T", " ").slice(0, 19);
        const badge = l.type === "auth" ? '<span class="log-type log-type--auth">AUTH</span>' : '<span class="log-type log-type--pred">PREDICT</span>';
        const cls = l.level === "critical" ? "log-lvl--crit" : l.level === "warn" ? "log-lvl--warn" : "log-lvl--ok";
        return `<tr class="${cls}"><td class="log-cell-time"><code>${esc(t)}</code></td><td class="log-cell-type">${badge}</td><td class="log-cell-user">${esc(l.user)}</td><td class="log-cell-detail">${esc(l.detail)}</td></tr>`;
    }).join("");
}

// Lọc + sắp xếp dữ liệu lịch sử người dùng trong admin modal.
// → Gọi: adminNorm(), $() [common.js]
function adminGetFilteredRows() {
    const q = adminNorm($("adminHisQuery")?.value || "");
    const out = adminNorm($("adminHisOutcome")?.value || "");
    const rsk = adminNorm($("adminHisRisk")?.value || "");
    const srt = $("adminHisSort")?.value || "newest";
    let rows = adminModal.allRows.filter(item => {
        const hay = adminNorm([item.created_at, item.has_diabetes, item.risk_band, item.glucose, item.bmi, item.age].join(" "));
        return (!q || hay.includes(q)) && (!out || adminNorm(item.has_diabetes).includes(out)) && (!rsk || adminNorm(item.risk_band).includes(rsk));
    });
    rows.sort((a, b) => {
        if (srt === "oldest") return new Date(a.created_at) - new Date(b.created_at);
        if (srt === "risk_desc") return (b.risk_score ?? 0) - (a.risk_score ?? 0);
        if (srt === "risk_asc") return (a.risk_score ?? 0) - (b.risk_score ?? 0);
        return new Date(b.created_at) - new Date(a.created_at);
    });
    return rows;
}

// Render bảng lịch sử người dùng trong admin modal (với filter + highlight).
// → Gọi: adminGetFilteredRows(), esc() [common.js], adminFmt(), adminFmtNum(), adminRiskTone()
function adminRenderHistoryTable() {
    const body = $("adminUserHistoryBody"), cnt = $("adminHisCount"); if (!body) return;
    const rows = adminGetFilteredRows();
    if (cnt) cnt.textContent = `Hiển thị ${rows.length}/${adminModal.allRows.length} bản ghi`;
    if (!rows.length) { body.innerHTML = `<tr><td colspan="6" class="log-empty">${adminModal.allRows.length ? "Không khớp bộ lọc." : "Chưa có lịch sử."}</td></tr>`; return; }
    body.innerHTML = rows.map(item => `
        <tr class="${adminModal.selectedId === item.id ? "is-active" : ""}" data-admin-his-id="${item.id}" tabindex="0" role="button">
            <td>${esc(adminFmt(item.created_at))}</td>
            <td><span class="status-chip ${adminRiskTone(item.probability)}">${esc(item.has_diabetes)}</span></td>
            <td>${esc(item.risk_band)} (${((item.probability || 0) * 100).toFixed(1)}%)</td>
            <td>${esc(adminFmtNum("Glucose", item.glucose))}</td>
            <td>${esc(adminFmtNum("BMI", item.bmi))}</td>
            <td>${esc(adminFmtNum("Age", item.age))}</td>
        </tr>`).join("");
}

// Render nhật ký hoạt động của 1 người dùng cụ thể (theo email).
// → Gọi: $() [common.js], esc() [common.js]
function adminRenderUserLogs(email) {
    const body = $("adminUserLogBody"); if (!body) return;
    const userLogs = (_adminLogs || []).filter(l => l.email === email);
    if (!userLogs.length) { body.innerHTML = '<tr><td colspan="3" class="log-empty">Không có nhật ký cho người dùng này.</td></tr>'; return; }
    body.innerHTML = userLogs.slice(0, 100).map(l => {
        const t = new Date(l.ts).toISOString().replace("T", " ").slice(0, 19);
        const badge = l.type === "auth" ? '<span class="log-type log-type--auth">AUTH</span>' : '<span class="log-type log-type--pred">PREDICT</span>';
        const cls = l.level === "critical" ? "log-lvl--crit" : l.level === "warn" ? "log-lvl--warn" : "log-lvl--ok";
        return `<tr class="${cls}"><td class="log-cell-time"><code>${esc(t)}</code></td><td>${badge}</td><td>${esc(l.detail)}</td></tr>`;
    }).join("");
}

// Chọn bản ghi lịch sử trong admin modal, render detail từ cache.
// → Gọi: adminRenderHistoryTable(), window.renderHistoryV2Detail() [user.js],
//        window.renderHistoryV2Placeholder() [user.js]
function adminSelectRecord(id) {
    adminModal.selectedId = id;
    adminRenderHistoryTable();
    const panel = $("adminHisDetail"); if (!panel) return;
    const cached = adminModal.detailCache.get(id);
    if (cached) {
        if (window.renderHistoryV2Detail) { window.renderHistoryV2Detail(cached, panel); }
        else { panel.innerHTML = `<article class="history-record history-record--empty"><h3>Chưa sẵn sàng</h3><p>App chưa tải xong module hiển thị.</p></article>`; }
        return;
    }
    if (window.renderHistoryV2Placeholder) { window.renderHistoryV2Placeholder("Đang tải…", "Đang lấy chi tiết lâm sàng cho bản ghi này.", panel); }
}

// Hiển thị modal chi tiết người dùng (profile/history/log tabs).
// Tải lịch sử và nhật ký qua Supabase RPC.
// → Gọi: $() [common.js], esc() [common.js], adminRenderHistoryTable(),
//        adminRenderUserLogs(), adminSelectRecord()
function showUserModal(profile) {
    const state = window.AppState;
    state.selectedProfile = profile;
    adminModal.allRows = []; adminModal.selectedId = null; adminModal.detailCache = new Map(); adminModal.filtersBound = false;
    const d = $("adminUserDetail"); if (!d) return;
    const joinDate = profile.created_at ? new Date(profile.created_at).toLocaleDateString("vi-VN") : "–";
    d.innerHTML = `
        <div class="admin-modal-header">
            <div class="admin-modal-avatar">${esc((profile.full_name || profile.email || "?")[0].toUpperCase())}</div>
            <div><h2 style="margin:4px 0 0">${esc(profile.full_name || profile.email)}</h2><p style="margin:2px 0 0;opacity:.65;font-size:.85rem">${esc(profile.email || "–")}</p></div>
        </div>
        <nav class="tab-nav admin-detail-tabs" style="position:static;margin:16px 0;">
            <button type="button" class="tab-button is-active" data-detail-tab="profile">Thông tin</button>
            <button type="button" class="tab-button" data-detail-tab="history">Lịch sử</button>
            <button type="button" class="tab-button" data-detail-tab="userlog">Nhật ký</button>
        </nav>
        <section data-detail-panel="profile" class="detail-panel is-active">
            <div class="admin-profile-grid">
                <div class="admin-info-block"><span class="meta-label">Họ tên</span><strong>${esc(profile.full_name || "–")}</strong></div>
                <div class="admin-info-block"><span class="meta-label">Email</span><strong>${esc(profile.email || "–")}</strong></div>
                <div class="admin-info-block"><span class="meta-label">Điện thoại</span><strong>${esc(profile.phone || "–")}</strong></div>
                <div class="admin-info-block"><span class="meta-label">Trạng thái gần nhất</span><strong>${esc(profile.latest_has_diabetes || "Chưa kiểm tra")}</strong></div>
                <div class="admin-info-block"><span class="meta-label">Ngày tạo tài khoản</span><strong>${joinDate}</strong></div>
            </div>
            <form id="adminProfileForm" class="auth-form" style="margin-top:1.5rem">
                <label class="auth-field"><span>Chỉnh sửa họ tên</span><input id="adminProfileFullName" value="${esc(profile.full_name || "")}"/></label>
                <label class="auth-field"><span>Chỉnh sửa điện thoại</span><input id="adminProfilePhone" type="tel" value="${esc(profile.phone || "")}"/></label>
                <div class="auth-actions">
                    <button type="submit">Lưu thay đổi</button>
                    <button type="button" class="button-danger" data-admin-delete-user>Xóa tài khoản</button>
                </div>
            </form>
        </section>
        <section data-detail-panel="history" class="detail-panel">
            <div class="history-toolbar" id="adminHisToolbar">
                <label class="history-filter history-filter--search"><span>Tìm kiếm</span><input id="adminHisQuery" type="search" placeholder="Kết luận, nguy cơ, glucose…"/></label>
                <div class="history-toolbar__row">
                    <label class="history-filter"><span>Kết luận</span><select id="adminHisOutcome"><option value="">Tất cả</option><option value="nguy co thap">Nguy cơ thấp</option><option value="can danh gia them">Cần đánh giá thêm</option><option value="co nguy co cao">Có nguy cơ cao</option></select></label>
                    <label class="history-filter"><span>Mức nguy cơ</span><select id="adminHisRisk"><option value="">Tất cả</option><option value="thap">Thấp</option><option value="theo doi som">Theo dõi sớm</option><option value="trung binh">Trung bình</option><option value="cao">Cao</option><option value="rat cao">Rất cao</option></select></label>
                    <label class="history-filter"><span>Sắp xếp</span><select id="adminHisSort"><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option><option value="risk_desc">Risk giảm dần</option><option value="risk_asc">Risk tăng dần</option></select></label>
                    <button id="adminHisReset" type="button" class="button-secondary history-reset-button">Đặt lại</button>
                </div>
            </div>
            <div class="history-table-status"><span id="adminHisCount">Đang tải…</span></div>
            <div class="history-table-wrap" style="margin-bottom:16px">
                <table class="historyTable" id="adminHistoryTable"><thead><tr><th>Thời gian</th><th>Kết luận</th><th>Nguy cơ</th><th>Glucose</th><th>BMI</th><th>Tuổi</th></tr></thead>
                <tbody id="adminUserHistoryBody"><tr><td colspan="6" class="log-empty">Đang tải…</td></tr></tbody></table>
            </div>
            <article class="panel history-detail-panel" id="adminHisDetailPanel" style="position:static;max-height:none">
                <div class="section-heading">Chi tiết lần kiểm tra</div>
                <div id="adminHisDetail" class="history-detail-shell">
                    <article class="history-record history-record--empty"><h3>Chọn một bản ghi</h3><p>Chi tiết lâm sàng sẽ hiển thị khi bạn chọn một dòng trong bảng lịch sử.</p></article>
                </div>
            </article>
        </section>
        <section data-detail-panel="userlog" class="detail-panel">
            <div class="log-table-wrap"><table class="log-table">
                <thead><tr><th class="log-col-time">Timestamp</th><th class="log-col-type">Type</th><th class="log-col-detail">Detail</th></tr></thead>
                <tbody id="adminUserLogBody"><tr><td colspan="3" class="log-empty">Đang tải…</td></tr></tbody>
            </table></div>
        </section>`;

    // bind filter + history row events
    const rebind = () => {
        if (adminModal.filtersBound) return;
        const rerender = () => adminRenderHistoryTable();
        $("adminHisQuery")?.addEventListener("input", rerender);
        $("adminHisOutcome")?.addEventListener("change", rerender);
        $("adminHisRisk")?.addEventListener("change", rerender);
        $("adminHisSort")?.addEventListener("change", rerender);
        $("adminHisReset")?.addEventListener("click", () => {
            $("adminHisQuery").value = ""; $("adminHisOutcome").value = ""; $("adminHisRisk").value = ""; $("adminHisSort").value = "newest";
            adminRenderHistoryTable();
        });
        $("adminUserHistoryBody")?.addEventListener("click", e => {
            const row = e.target.closest("[data-admin-his-id]"); if (!row) return;
            adminSelectRecord(Number(row.dataset.adminHisId));
        });
        adminModal.filtersBound = true;
    };
    rebind();
    adminRenderUserLogs(profile.email);
    $("adminUserModal").classList.add("is-open");

    // load history for this user
    (async () => {
        if (!state.client || !profile.id) return;
        const { data, error } = await state.client.rpc("get_prediction_history", { target_user_id: profile.id, row_limit: 100 });
        if (error) { const b = $("adminUserHistoryBody"); if (b) b.innerHTML = `<tr><td colspan="6">${esc(error.message)}</td></tr>`; return; }
        const rows = data || [];
        rows.forEach(item => adminModal.detailCache.set(item.id, { created_at: item.created_at, input_data: item.input_payload || {}, prediction: item.prediction_payload || {} }));
        adminModal.allRows = rows;
        adminRenderHistoryTable();
    })();
}

// Đăng ký Supabase Realtime: tự động thêm log khi có prediction mới.
// → Gọi: buildPredictionLog(), renderLogs()
let _realtimeChannel = null;
function subscribeRealtime() {
    const state = window.AppState;
    if (!state.client || !isAdmin() || _realtimeChannel) return;

    _realtimeChannel = state.client
        .channel("admin-predictions-realtime")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "predictions" }, async (payload) => {
            const row = payload.new;
            if (!row) return;

            // Realtime không trả join profiles → fetch tên user
            let userName = "–", userEmail = "";
            if (row.user_id) {
                const { data: prof } = await state.client
                    .from("profiles").select("full_name,email")
                    .eq("id", row.user_id).maybeSingle();
                if (prof) { userName = prof.full_name || prof.email; userEmail = prof.email; }
            }

            // Build log entry với đủ 8 chỉ số
            const logEntry = buildPredictionLog({ ...row, profiles: { full_name: userName, email: userEmail } });

            // Prepend vào đầu mảng + render
            _adminLogs.unshift(logEntry);
            renderLogs();
        })
        .subscribe();
}

// Hủy subscription khi đăng xuất.
function unsubscribeRealtime() {
    if (_realtimeChannel) {
        const state = window.AppState;
        state.client?.removeChannel(_realtimeChannel);
        _realtimeChannel = null;
    }
}

// --- Expose cho auth-rbac.js gọi ---
window.AppAdmin = {
    loadAdminUsers,
    loadLogs,
    renderLogs,
    showUserModal,
    adminModal,
    adminSelectRecord,
    subscribeRealtime,
    unsubscribeRealtime
};
