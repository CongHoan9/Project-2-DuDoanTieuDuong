(() => {
    const state = { client: null, session: null, profile: null, profiles: [], selectedProfile: null };
    const els = { nav: document.getElementById("mainTabNav"), form: document.getElementById("predictionForm"), historyBody: document.getElementById("historyBody") };

    // ─── Utilities ───
    const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const $ = id => document.getElementById(id);
    const api = ep => `/api/${ep.replace(/^\/+/, "")}`;
    const isAdmin = () => state.profile?.role === "admin";
    const isAuth = () => !!state.session;
    const name = () => state.profile?.full_name || state.session?.user?.email || "Account";

    let _toastTimer;
    function toast(msg) {
        let el = $("appToast");
        if (!el) { el = document.createElement("div"); el.id = "appToast"; el.className = "app-toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
        clearTimeout(_toastTimer); el.textContent = msg; el.classList.add("is-visible");
        _toastTimer = setTimeout(() => el.classList.remove("is-visible"), 3200);
    }

    let _debounceTimers = {};
    function debounce(key, fn, ms = 300) {
        clearTimeout(_debounceTimers[key]);
        _debounceTimers[key] = setTimeout(fn, ms);
    }

    // ─── Tab activation ───
    function activateTab(tab) {
        document.querySelectorAll(".tab-button").forEach(b => { const on = b.dataset.tabTarget === tab; b.classList.toggle("is-active", on); b.setAttribute("aria-selected", String(on)); });
        document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("is-active", p.dataset.tabPanel === tab));
        window.dispatchEvent(new CustomEvent("diabetes:tab-activated", { detail: { tab } }));
    }

    // ─── Auth modal ───
    function openAuth(mode = "signin") { $("authModal")?.classList.add("is-open"); setAuthMode(mode); }
    function closeModal(id) { $(id)?.classList.remove("is-open"); }
    function setAuthMode(mode) {
        const m = $("authModal"); if (!m) return;
        m.dataset.mode = mode;
        m.querySelector("[data-auth-title]").textContent = mode === "signup" ? "Tạo tài khoản" : "Đăng nhập";
        m.querySelector("[data-auth-submit]").textContent = mode === "signup" ? "Đăng ký" : "Đăng nhập";
        m.querySelector("[data-auth-full-name]").classList.toggle("hidden", mode !== "signup");
        m.querySelector("[data-auth-switch]").textContent = mode === "signup" ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký";
    }

    // ─── Inject panels (once) ───
    function ensurePanels() {
        const shell = document.querySelector(".tabs-shell"); if (!shell) return;
        const inject = (sel, html) => { if (!document.querySelector(sel)) shell.insertAdjacentHTML("beforeend", html); };
        const injectBody = (sel, html) => { if (!$(sel)) document.body.insertAdjacentHTML("beforeend", html); };

        inject('[data-tab-panel="account"]', `
            <section class="tab-panel" data-tab-panel="account"><section class="dashboard-grid content-frame content-frame--main paper-sheet"><article class="panel account-panel">
                <div class="section-heading">Tài khoản</div>
                <form id="accountForm" class="auth-form">
                    <label class="auth-field"><span>Họ tên</span><input id="accountFullName" type="text" autocomplete="name"/></label>
                    <label class="auth-field"><span>Email</span><input id="accountEmail" type="email" disabled/></label>
                    <label class="auth-field"><span>Mật khẩu mới</span><input id="accountPassword" type="password" placeholder="Để trống nếu không đổi"/></label>
                    <div class="auth-actions">
                        <button type="submit">Cập nhật</button>
                        <button type="button" class="button-sign-out" data-sign-out>Đăng xuất</button>
                        <button type="button" class="button-danger" data-delete-account>Xóa tài khoản</button>
                    </div>
                </form>
            </article></section></section>`);

        inject('[data-tab-panel="user-management"]', `
            <section class="tab-panel" data-tab-panel="user-management"><section class="dashboard-grid content-frame content-frame--main paper-sheet"><article class="panel user-management-panel">
                <div class="section-heading">Quản lý người dùng</div>
                <div class="admin-toolbar">
                    <label class="auth-field"><span>Tìm kiếm</span><input id="adminUserSearch" type="search" placeholder="Tên hoặc email"/></label>
                    <label class="auth-field"><span>Tình trạng</span><select id="adminDiseaseFilter"><option value="">Tất cả</option><option value="diabetes">Có nguy cơ</option><option value="normal">Bình thường</option></select></label>
                </div>
                <div class="table-wrap"><table><thead><tr><th>Người dùng</th><th>Email</th><th>Tình trạng</th><th>Ngày tạo</th></tr></thead>
                <tbody id="adminUsersBody"><tr><td colspan="4">Đang tải…</td></tr></tbody></table></div>
            </article></section></section>`);

        inject('[data-tab-panel="activity-log"]', `
            <section class="tab-panel" data-tab-panel="activity-log"><section class="dashboard-grid content-frame content-frame--main paper-sheet"><article class="panel activity-log-panel">
                <div class="section-heading">Nhật ký hệ thống</div>
                <div class="log-toolbar">
                    <label class="auth-field log-toolbar__search"><span>Tìm kiếm</span><input id="logSearch" type="search" placeholder="Tên, email…"/></label>
                    <label class="auth-field"><span>Loại</span><select id="logTypeFilter"><option value="">Tất cả</option><option value="auth">Xác thực</option><option value="prediction">Dự đoán</option></select></label>
                    <label class="auth-field"><span>Thời gian</span><select id="logDateFilter"><option value="">Mọi lúc</option><option value="today">Hôm nay</option><option value="7d">7 ngày</option><option value="30d">30 ngày</option></select></label>
                    <div class="log-toolbar__meta"><span id="logCount" class="log-badge">0 bản ghi</span></div>
                </div>
                <div class="log-table-wrap"><table class="log-table">
                    <thead><tr><th class="log-col-time">Timestamp</th><th class="log-col-type">Type</th><th class="log-col-user">User</th><th class="log-col-detail">Detail</th></tr></thead>
                    <tbody id="logBody"><tr><td colspan="4" class="log-empty">Đang tải…</td></tr></tbody>
                </table></div>
            </article></section></section>`);

        injectBody("authModal", `
            <div id="authModal" class="auth-modal" role="dialog" aria-modal="true">
                <div class="auth-modal__backdrop" data-close-modal="authModal"></div>
                <section class="auth-modal__panel panel">
                    <button type="button" class="auth-modal__close" data-close-modal="authModal">×</button>
                    <div class="section-heading">Account</div>
                    <h2 data-auth-title>Đăng nhập</h2>
                    <form id="authForm" class="auth-form">
                        <label class="auth-field" data-auth-full-name><span>Họ tên</span><input id="authFullName" type="text"/></label>
                        <label class="auth-field"><span>Email</span><input id="authEmail" type="email" required/></label>
                        <label class="auth-field"><span>Mật khẩu</span><input id="authPassword" type="password" required minlength="6"/></label>
                        <button type="submit" data-auth-submit>Đăng nhập</button>
                        <button type="button" class="button-secondary" data-auth-switch>Chưa có tài khoản? Đăng ký</button>
                    </form>
                </section>
            </div>`);
        setAuthMode("signin");

        injectBody("adminUserModal", `
            <div id="adminUserModal" class="auth-modal" role="dialog" aria-modal="true">
                <div class="auth-modal__backdrop" data-close-modal="adminUserModal"></div>
                <section class="auth-modal__panel panel auth-modal__panel--fullscreen">
                    <button type="button" class="auth-modal__close" data-close-modal="adminUserModal">×</button>
                    <div id="adminUserDetail"></div>
                </section>
            </div>`);
    }

    // ─── Nav render ───
    function renderNav() {
        if (!els.nav) return;
        const tabs = !isAuth()
            ? [["predict", "Dự đoán"], ["library", "Library"], ["account", "Login / Sign In"]]
            : isAdmin()
                ? [["user-management", "Management"], ["activity-log", "Activity Log"], ["account", esc(name())]]
                : [["predict", "Dự đoán"], ["library", "Library"], ["history", "History"], ["account", esc(name())]];

        els.nav.innerHTML = tabs.map(([t, l]) => `<button class="tab-button" type="button" role="tab" data-tab-target="${t}">${l}</button>`).join("");
        els.nav.style.gridTemplateColumns = `repeat(${tabs.length}, minmax(0, 1fr))`;

        els.nav.addEventListener("click", e => {
            const btn = e.target.closest(".tab-button"); if (!btn) return;
            const t = btn.dataset.tabTarget;
            if (!isAuth() && t === "account") { openAuth(); return; }
            if (t === "user-management") loadAdminUsers();
            if (t === "history") loadHistory();
            if (t === "activity-log") loadLogs();
            if (t === "account") fillAccount();
            activateTab(t);
        });

        activateTab(isAdmin() ? "user-management" : "predict");
        const del = document.querySelector("[data-delete-account]");
        if (del) del.classList.toggle("hidden", isAdmin());
    }

    // ─── Profile ───
    async function loadProfile() {
        if (!state.session) { state.profile = null; return; }

        const { data, error } = await state.client.from("profiles").select("id,email,full_name,role,created_at,updated_at").eq("id", state.session.user.id).maybeSingle();
        if (error) throw error;
        state.profile = data || { id: state.session.user.id, email: state.session.user.email, full_name: state.session.user.user_metadata?.full_name || state.session.user.email, role: "user" };
    }

    function fillAccount() {
        const n = $("accountFullName"), e = $("accountEmail"), p = $("accountPassword");
        if (n) n.value = state.profile?.full_name || "";
        if (e) e.value = state.profile?.email || state.session?.user?.email || "";
        if (p) p.value = "";
    }

    // ─── History ───
    async function loadHistory(uid = state.session?.user?.id, body = els.historyBody) {
        if (!state.client || !uid || !body) return;
        const { data, error } = await state.client.rpc("get_prediction_history", { target_user_id: uid, row_limit: 50 });
        if (error) { body.innerHTML = `<tr><td colspan="6">${esc(error.message)}</td></tr>`; return; }

        if (body.id === "historyBody" && window.renderHistory && window.historyV2State) {
            (data || []).forEach(item => {
                window.historyV2State.detailCache.set(item.id, {
                    created_at: item.created_at,
                    input_data: item.input_payload || {},
                    prediction: item.prediction_payload || {}
                });
            });
            window.renderHistory(data || []);
        } else {
            const UI = window.DiabetesUI;
            body.innerHTML = (data || []).length
                ? data.map(i => `<tr><td>${esc(new Date(i.created_at).toLocaleString("vi-VN"))}</td><td><span class="status-chip ${UI?.riskTone?.(i.probability || 0) || "tone-neutral"}">${esc(i.has_diabetes)}</span></td><td>${esc(i.risk_band)} (${((i.probability || 0) * 100).toFixed(1)}%)</td><td>${esc(i.glucose)}</td><td>${esc(i.bmi)}</td><td>${esc(i.age)}</td></tr>`).join("")
                : '<tr><td colspan="6">Chưa có dữ liệu.</td></tr>';
        }
    }

    async function savePrediction(input, pred) {
        if (!state.session) return;
        const { error } = await state.client.rpc("create_prediction", { input_payload: input, prediction_payload: pred });
        if (error) throw error;
    }

    // ─── Admin: users (exclude admins) ───
    async function loadAdminUsers() {
        if (!isAdmin()) return;
        const { data, error } = await state.client.rpc("admin_search_profiles", { search_text: $("adminUserSearch")?.value || "", disease_filter: $("adminDiseaseFilter")?.value || null });
        const body = $("adminUsersBody"); if (!body) return;
        if (error) { body.innerHTML = `<tr><td colspan="4">${esc(error.message)}</td></tr>`; return; }
        state.profiles = (data || []).filter(p => p.role !== "admin");
        body.innerHTML = state.profiles.length
            ? state.profiles.map(p => `<tr data-admin-user-id="${p.id}" tabindex="0" role="button"><td>${esc(p.full_name || "–")}</td><td>${esc(p.email || "–")}</td><td>${esc(p.latest_has_diabetes || "Chưa có")}</td><td>${esc(new Date(p.created_at).toLocaleDateString("vi-VN"))}</td></tr>`).join("")
            : '<tr><td colspan="4">Không có người dùng.</td></tr>';
    }

    // ─── Activity logs (parallel fetch + client filter) ───
    let _logs = [];
    async function loadLogs() {
        if (!isAdmin()) return;
        const [{ data: profiles }, { data: preds }] = await Promise.all([
            state.client.from("profiles").select("full_name,email,role,created_at,updated_at").order("updated_at", { ascending: false }).limit(200),
            state.client.from("predictions").select("created_at,has_diabetes,probability,glucose,bmi,age,profiles(full_name,email)").order("created_at", { ascending: false }).limit(200)
        ]);
        const logs = [];
        (profiles || []).forEach(p => {
            logs.push({ ts: p.created_at, type: "auth", level: "info", user: p.full_name || p.email, email: p.email, detail: `Tài khoản tạo (${p.role})` });
            if (p.updated_at && p.updated_at !== p.created_at)
                logs.push({ ts: p.updated_at, type: "auth", level: "info", user: p.full_name || p.email, email: p.email, detail: "Hoạt động gần nhất" });
        });
        (preds || []).forEach(p => {
            const prob = ((p.probability || 0) * 100).toFixed(1);
            const lvl = (p.probability || 0) >= 0.75 ? "critical" : (p.probability || 0) >= 0.4 ? "warn" : "ok";
            logs.push({ ts: p.created_at, type: "prediction", level: lvl, user: p.profiles?.full_name || "–", email: p.profiles?.email || "", detail: `${p.has_diabetes} — ${prob}% | Glu:${p.glucose} BMI:${p.bmi} Age:${p.age}` });
        });
        logs.sort((a, b) => new Date(b.ts) - new Date(a.ts));
        _logs = logs;
        renderLogs();
    }

    function renderLogs() {
        const body = $("logBody"), cnt = $("logCount"); if (!body) return;
        const q = ($("logSearch")?.value || "").toLowerCase(), tf = $("logTypeFilter")?.value || "", df = $("logDateFilter")?.value || "", now = Date.now();
        const out = _logs.filter(l => {
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

    // ─── Admin user modal (full history V2 mirror) ───
    const adminModal = {
        allRows: [],
        selectedId: null,
        detailCache: new Map(),
        filtersBound: false
    };

    function adminNorm(v) {
        return String(v ?? "").toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    function adminFmt(v) {
        try { return new Date(v).toLocaleString("vi-VN"); } catch (_) { return String(v ?? "–"); }
    }

    function adminFmtNum(metric, value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return "–";
        if (metric === "Pregnancies" || metric === "Age") return String(Math.round(n));
        if (metric === "DiabetesPedigreeFunction") return n.toFixed(3);
        return n.toFixed(1);
    }

    function adminRiskTone(prob) {
        const p = Number(prob) || 0;
        if (p >= 0.75) return "tone-critical";
        if (p >= 0.5) return "tone-high";
        if (p >= 0.25) return "tone-medium";
        return "tone-low";
    }

    function adminGetFilteredRows() {
        const q = adminNorm($("adminHisQuery")?.value || "");
        const out = adminNorm($("adminHisOutcome")?.value || "");
        const rsk = adminNorm($("adminHisRisk")?.value || "");
        const srt = $("adminHisSort")?.value || "newest";
        let rows = adminModal.allRows.filter(item => {
            const hay = adminNorm([item.created_at, item.has_diabetes, item.risk_band, item.glucose, item.bmi, item.age].join(" "));
            return (!q || hay.includes(q))
                && (!out || adminNorm(item.has_diabetes).includes(out))
                && (!rsk || adminNorm(item.risk_band).includes(rsk));
        });
        rows.sort((a, b) => {
            if (srt === "oldest") return new Date(a.created_at) - new Date(b.created_at);
            if (srt === "risk_desc") return (b.risk_score ?? 0) - (a.risk_score ?? 0);
            if (srt === "risk_asc") return (a.risk_score ?? 0) - (b.risk_score ?? 0);
            return new Date(b.created_at) - new Date(a.created_at);
        });
        return rows;
    }

    function adminRenderHistoryTable() {
        const body = $("adminUserHistoryBody");
        const cnt = $("adminHisCount");
        if (!body) return;
        const rows = adminGetFilteredRows();
        if (cnt) cnt.textContent = `Hiển thị ${rows.length}/${adminModal.allRows.length} bản ghi`;
        if (!rows.length) {
            body.innerHTML = `<tr><td colspan="6" class="log-empty">${adminModal.allRows.length ? "Không khớp bộ lọc." : "Chưa có lịch sử."}</td></tr>`;
            return;
        }
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

    function adminRenderUserLogs(email) {
        const body = $("adminUserLogBody"); if (!body) return;
        const userLogs = (_logs || []).filter(l => l.email === email);
        if (!userLogs.length) {
            body.innerHTML = '<tr><td colspan="3" class="log-empty">Không có nhật ký cho người dùng này.</td></tr>'; return;
        }
        body.innerHTML = userLogs.slice(0, 100).map(l => {
            const t = new Date(l.ts).toISOString().replace("T", " ").slice(0, 19);
            const badge = l.type === "auth" ? '<span class="log-type log-type--auth">AUTH</span>' : '<span class="log-type log-type--pred">PREDICT</span>';
            const cls = l.level === "critical" ? "log-lvl--crit" : l.level === "warn" ? "log-lvl--warn" : "log-lvl--ok";
            return `<tr class="${cls}"><td class="log-cell-time"><code>${esc(t)}</code></td><td>${badge}</td><td>${esc(l.detail)}</td></tr>`;
        }).join("");
    }

    function adminSelectRecord(id) {
        adminModal.selectedId = id;
        adminRenderHistoryTable();
        const panel = $("adminHisDetail"); if (!panel) return;
        const cached = adminModal.detailCache.get(id);
        if (cached) {
            if (window.renderHistoryV2Detail) {
                window.renderHistoryV2Detail(cached, panel);
            } else {
                panel.innerHTML = `<article class="history-record history-record--empty"><h3>Chưa sẵn sàng</h3><p>App chưa tải xong module hiển thị.</p></article>`;
            }
            return;
        }
        if (window.renderHistoryV2Placeholder) {
            window.renderHistoryV2Placeholder("Đang tải…", "Đang lấy chi tiết lâm sàng cho bản ghi này.", panel);
        }
    }

    function showUserModal(profile) {
        state.selectedProfile = profile;
        adminModal.allRows = []; adminModal.selectedId = null; adminModal.detailCache = new Map(); adminModal.filtersBound = false;
        const d = $("adminUserDetail"); if (!d) return;
        const joinDate = profile.created_at ? new Date(profile.created_at).toLocaleDateString("vi-VN") : "–";
        const updDate = profile.updated_at ? new Date(profile.updated_at).toLocaleDateString("vi-VN") : "–";
        d.innerHTML = `
            <div class="admin-modal-header">
                <div class="admin-modal-avatar">${esc((profile.full_name || profile.email || "?")[0].toUpperCase())}</div>
                <div>
                    <h2 style="margin:4px 0 0">${esc(profile.full_name || profile.email)}</h2>
                    <p style="margin:2px 0 0;opacity:.65;font-size:.85rem">${esc(profile.email || "–")}</p>
                </div>
            </div>
            <nav class="tab-nav admin-detail-tabs" style="position:static;margin:16px 0;">
                <button type="button" class="tab-button is-active" data-detail-tab="profile">Thông tin</button>
                <button type="button" class="tab-button" data-detail-tab="history">Lịch sử</button>
                <button type="button" class="tab-button" data-detail-tab="userlog">Nhật ký</button>
            </nav>

            <!-- TAB: PROFILE -->
            <section data-detail-panel="profile" class="detail-panel is-active">
                <div class="admin-profile-grid">
                    <div class="admin-info-block">
                        <span class="meta-label">Họ tên</span>
                        <strong>${esc(profile.full_name || "–")}</strong>
                    </div>
                    <div class="admin-info-block">
                        <span class="meta-label">Email</span>
                        <strong>${esc(profile.email || "–")}</strong>
                    </div>
                    <div class="admin-info-block">
                        <span class="meta-label">Trạng thái gần nhất</span>
                        <strong>${esc(profile.latest_has_diabetes || "Chưa kiểm tra")}</strong>
                    </div>
                    <div class="admin-info-block">
                        <span class="meta-label">Ngày tạo tài khoản</span>
                        <strong>${joinDate}</strong>
                    </div>
                </div>
                <form id="adminProfileForm" class="auth-form" style="margin-top:1.5rem">
                    <label class="auth-field"><span>Chỉnh sửa họ tên</span><input id="adminProfileFullName" value="${esc(profile.full_name || "")}"/></label>
                    <button type="submit">Lưu thay đổi</button>
                </form>
            </section>

            <!-- TAB: HISTORY -->
            <section data-detail-panel="history" class="detail-panel">
                <div class="history-toolbar" id="adminHisToolbar">
                    <label class="history-filter history-filter--search">
                        <span>Tìm kiếm</span>
                        <input id="adminHisQuery" type="search" placeholder="Kết luận, nguy cơ, glucose…"/>
                    </label>
                    <div class="history-toolbar__row">
                        <label class="history-filter"><span>Kết luận</span>
                            <select id="adminHisOutcome">
                                <option value="">Tất cả</option>
                                <option value="nguy co thap">Nguy cơ thấp</option>
                                <option value="can danh gia them">Cần đánh giá thêm</option>
                                <option value="co nguy co cao">Có nguy cơ cao</option>
                            </select></label>
                        <label class="history-filter"><span>Mức nguy cơ</span>
                            <select id="adminHisRisk">
                                <option value="">Tất cả</option>
                                <option value="thap">Thấp</option>
                                <option value="theo doi som">Theo dõi sớm</option>
                                <option value="trung binh">Trung bình</option>
                                <option value="cao">Cao</option>
                                <option value="rat cao">Rất cao</option>
                            </select></label>
                        <label class="history-filter"><span>Sắp xếp</span>
                            <select id="adminHisSort">
                                <option value="newest">Mới nhất</option>
                                <option value="oldest">Cũ nhất</option>
                                <option value="risk_desc">Risk giảm dần</option>
                                <option value="risk_asc">Risk tăng dần</option>
                            </select></label>
                        <button id="adminHisReset" type="button" class="button-secondary history-reset-button">Đặt lại</button>
                    </div>
                </div>
                <div class="history-table-status"><span id="adminHisCount">Đang tải…</span></div>
                <div class="history-table-wrap" style="margin-bottom:16px">
                    <table class="historyTable" id="adminHistoryTable"><thead><tr>
                        <th>Thời gian</th><th>Kết luận</th><th>Nguy cơ</th><th>Glucose</th><th>BMI</th><th>Tuổi</th>
                    </tr></thead>
                    <tbody id="adminUserHistoryBody"><tr><td colspan="6" class="log-empty">Đang tải…</td></tr></tbody></table>
                </div>
                <article class="panel history-detail-panel" id="adminHisDetailPanel" style="position:static;max-height:none">
                    <div class="section-heading">Chi tiết lần kiểm tra</div>
                    <div id="adminHisDetail" class="history-detail-shell">
                        <article class="history-record history-record--empty">
                            <h3>Chọn một bản ghi</h3>
                            <p>Chi tiết lâm sàng sẽ hiển thị khi bạn chọn một dòng trong bảng lịch sử.</p>
                        </article>
                    </div>
                </article>
            </section>

            <!-- TAB: USER LOG -->
            <section data-detail-panel="userlog" class="detail-panel">
                <div class="log-table-wrap">
                    <table class="log-table">
                        <thead><tr>
                            <th class="log-col-time">Timestamp</th>
                            <th class="log-col-type">Type</th>
                            <th class="log-col-detail">Detail</th>
                        </tr></thead>
                        <tbody id="adminUserLogBody"><tr><td colspan="3" class="log-empty">Đang tải…</td></tr></tbody>
                    </table>
                </div>
            </section>`;

        // bind filter + log events
        const rebind = () => {
            if (adminModal.filtersBound) return;
            const tb = $("adminHisToolbar"); if (!tb) return;
            const rerender = () => adminRenderHistoryTable();
            $("adminHisQuery")?.addEventListener("input", rerender);
            $("adminHisOutcome")?.addEventListener("change", rerender);
            $("adminHisRisk")?.addEventListener("change", rerender);
            $("adminHisSort")?.addEventListener("change", rerender);
            $("adminHisReset")?.addEventListener("click", () => {
                $("adminHisQuery").value = ""; $("adminHisOutcome").value = ""; $("adminHisRisk").value = ""; $("adminHisSort").value = "newest";
                adminRenderHistoryTable();
            });
            // row click → select detail
            $("adminUserHistoryBody")?.addEventListener("click", e => {
                const row = e.target.closest("[data-admin-his-id]"); if (!row) return;
                adminSelectRecord(Number(row.dataset.adminHisId));
            });
            // close detail button
            adminModal.filtersBound = true;
        };
        rebind();
        // render user log immediately with cached _logs
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

    // ─── Init ───
    async function init() {
        const cfg = await fetch(api("supabase-config")).then(r => r.ok ? r.json() : null).catch(() => null);
        if (!cfg?.url || !cfg?.anon_key || !window.supabase?.createClient) { toast("Thiếu cấu hình Supabase."); renderNav(); return; }
        state.client = window.supabase.createClient(cfg.url, cfg.anon_key);
        const { data } = await state.client.auth.getSession();
        state.session = data.session;
        if (state.session) await loadProfile().catch(e => toast(e.message));
        renderNav();
        if (isAuth()) { fillAccount(); if (!isAdmin()) loadHistory(); if (isAdmin()) { loadAdminUsers(); loadLogs(); } }

        state.client.auth.onAuthStateChange(async (_, session) => {
            state.session = session;
            if (session) await loadProfile().catch(e => toast(e.message));
            else { state.profile = null; if (els.historyBody) els.historyBody.innerHTML = '<tr><td colspan="6">Đăng nhập để xem.</td></tr>'; }
            renderNav();
            if (isAuth()) fillAccount();
        });
    }

    // ─── Events (single delegation) ───
    function bindEvents() {
        document.addEventListener("click", e => {
            const cl = e.target.closest("[data-close-modal]"); if (cl) closeModal(cl.dataset.closeModal);
            if (e.target.closest("[data-auth-switch]")) { const m = $("authModal"); if (m) setAuthMode(m.dataset.mode === "signup" ? "signin" : "signup"); }
            if (e.target.closest("[data-sign-out]")) {
                toast("Đã đăng xuất");
                activateTab("predict");

                if (state.client) {
                    // Update state immediately without waiting for API response
                    state.session = null;
                    state.profile = null;
                    if (els.historyBody) els.historyBody.innerHTML = '<tr><td colspan="6">Đăng nhập để xem.</td></tr>';
                    renderNav();

                    // Fire and forget
                    state.client.auth.signOut({ scope: "local" }).catch(err => console.error("SignOut error:", err));
                }
            }
            if (e.target.closest("[data-delete-account]")) toast("Xóa tài khoản cần Edge Function.");
            const row = e.target.closest("[data-admin-user-id]");
            if (row) { const p = state.profiles.find(x => x.id === row.dataset.adminUserId); if (p) showUserModal(p); }
            const dt = e.target.closest("[data-detail-tab]");
            if (dt) {
                const t = dt.dataset.detailTab;
                const scope = dt.closest("#adminUserDetail") || document;
                scope.querySelectorAll("[data-detail-tab]").forEach(b => b.classList.toggle("is-active", b === dt));
                scope.querySelectorAll("[data-detail-panel]").forEach(p => p.classList.toggle("is-active", p.dataset.detailPanel === t));
            }
            if (e.target.closest("[data-close-history-detail]") && e.target.closest("#adminHisDetailPanel")) {
                adminModal.selectedId = null;
                adminRenderHistoryTable();
                if (window.renderHistoryV2Placeholder) {
                    window.renderHistoryV2Placeholder("Chọn một bản ghi", "Chi tiết sẽ được tải khi bạn chọn một dòng trong lịch sử ở bên trên.", $("adminHisDetail"));
                }
            }
        });

        document.addEventListener("submit", async e => {
            if (e.target.id === "authForm") {
                e.preventDefault(); if (!state.client) { toast("Supabase chưa kết nối."); return; }
                const mode = $("authModal").dataset.mode, email = $("authEmail").value.trim().toLowerCase(), pw = $("authPassword").value, fn = $("authFullName").value.trim();
                if (mode === "signup" && fn.length < 2) { toast("Họ tên ≥ 2 ký tự."); return; }
                const r = mode === "signup" ? await state.client.auth.signUp({ email, password: pw, options: { data: { full_name: fn } } }) : await state.client.auth.signInWithPassword({ email, password: pw });
                if (r.error) { toast(r.error.message); return; }
                state.session = r.data.session || state.session;
                if (state.session) { await loadProfile().catch(x => toast(x.message)); renderNav(); fillAccount(); }
                closeModal("authModal"); toast(mode === "signup" ? "Đăng ký thành công!" : "Đăng nhập thành công!");
            }
            if (e.target.id === "accountForm") {
                e.preventDefault();
                const fn = $("accountFullName").value.trim(); if (fn.length < 2) { toast("Họ tên ≥ 2 ký tự."); return; }
                const pw = $("accountPassword").value, up = pw ? { password: pw, data: { full_name: fn } } : { data: { full_name: fn } };
                const ar = await state.client.auth.updateUser(up); if (ar.error) { toast(ar.error.message); return; }
                const { error } = await state.client.rpc("update_my_profile", { new_full_name: fn }); if (error) { toast(error.message); return; }
                await loadProfile(); renderNav(); fillAccount(); toast("Đã cập nhật.");
            }
            if (e.target.id === "adminProfileForm") {
                e.preventDefault();
                const fn = $("adminProfileFullName").value.trim(); if (fn.length < 2) { toast("Họ tên ≥ 2 ký tự."); return; }
                const { error } = await state.client.rpc("admin_update_profile", { target_user_id: state.selectedProfile.id, new_full_name: fn, new_role: "user" });
                if (error) { toast(error.message); return; }
                closeModal("adminUserModal"); await loadAdminUsers(); toast("Đã cập nhật.");
            }
        });

        document.addEventListener("input", e => {
            if (e.target.id === "adminUserSearch") debounce("adminSearch", loadAdminUsers);
            if (e.target.id === "logSearch") debounce("logSearch", renderLogs, 150);
        });
        document.addEventListener("change", e => {
            if (e.target.id === "adminDiseaseFilter") loadAdminUsers();
            if (e.target.id === "logTypeFilter" || e.target.id === "logDateFilter") renderLogs();
        });

        els.form?.addEventListener("submit", e => {
            if (!state.session) { e.preventDefault(); e.stopImmediatePropagation(); openAuth(); }
        }, true);

        window.addEventListener("diabetes:prediction-complete", async e => {
            const pred = e.detail?.prediction; if (!pred || !state.session) return;
            await savePrediction(e.detail?.input || {}, pred).catch(x => toast(x.message));
            await loadHistory();
        });
    }

    ensurePanels(); bindEvents(); init();
})();
