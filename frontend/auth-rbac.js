// ===================================================================
// AUTH-RBAC.JS — Authentication, RBAC, Navigation, Event Delegation
// ===================================================================
// Load sau: admin.js (cuối cùng)
// Sử dụng: window.AppState (từ common.js), window.AppAdmin (từ admin.js)
// Sử dụng: $, esc, api, isAdmin, isAuth từ common.js

(() => {
    // Tham chiếu tới shared state từ common.js
    const state = window.AppState;
    const els = { nav: document.getElementById("mainTabNav"), form: document.getElementById("predictionForm"), historyBody: document.getElementById("historyBody") };
    let navEventsBound = false;
    const TAB_STORAGE_KEY = "diabetesActiveTab";

    // ─── Local utilities ───
    const name = () => state.profile?.full_name || state.session?.user?.email || "Tài khoản";

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

    // Chuyển tab + lưu vào localStorage để khôi phục khi reload.
    function activateTab(tab) {
        document.querySelectorAll(".tab-button").forEach(b => { const on = b.dataset.tabTarget === tab; b.classList.toggle("is-active", on); b.setAttribute("aria-selected", String(on)); });
        document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("is-active", p.dataset.tabPanel === tab));
        localStorage.setItem(TAB_STORAGE_KEY, tab);
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
                    <label class="auth-field"><span>Điện thoại</span><input id="accountPhone" type="tel" placeholder="Không bắt buộc"/></label>
                    <label class="auth-field"><span>Mật khẩu mới</span><input id="accountPassword" type="password" placeholder="Để trống nếu không đổi"/></label>
                    <div class="auth-actions">
                        <button type="submit">Cập nhật</button>
                        <button type="button" class="button-sign-out" data-sign-out>Đăng xuất</button>
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
                    <thead><tr><th class="log-col-time">Thời gian</th><th class="log-col-type">Loại</th><th class="log-col-user">Người dùng</th><th class="log-col-detail">Chi tiết</th></tr></thead>
                    <tbody id="logBody"><tr><td colspan="4" class="log-empty">Đang tải…</td></tr></tbody>
                </table></div>
            </article></section></section>`);

        injectBody("authModal", `
            <div id="authModal" class="auth-modal" role="dialog" aria-modal="true">
                <div class="auth-modal__backdrop" data-close-modal="authModal"></div>
                <section class="auth-modal__panel panel">
                    <button type="button" class="auth-modal__close" data-close-modal="authModal">×</button>
                    <div class="section-heading">Tài khoản</div>
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
            ? [["predict", "Dự đoán"], ["library", "Thư viện"], ["account", "Đăng nhập"]]
            : isAdmin()
                ? [["user-management", "Quản lý"], ["activity-log", "Nhật ký"], ["account", esc(name())]]
                : [["predict", "Dự đoán"], ["library", "Thư viện"], ["history", "Lịch sử"], ["account", esc(name())]];

        els.nav.innerHTML = tabs.map(([t, l]) => `<button class="tab-button" type="button" role="tab" data-tab-target="${t}">${l}</button>`).join("");
        els.nav.style.gridTemplateColumns = `repeat(${tabs.length}, minmax(0, 1fr))`;

        if (!navEventsBound) {
            els.nav.addEventListener("click", e => {
                const btn = e.target.closest(".tab-button"); if (!btn) return;
                const t = btn.dataset.tabTarget;
                if (!isAuth() && t === "account") { openAuth(); return; }
                if (t === "user-management") window.AppAdmin?.loadAdminUsers();
                if (t === "history") loadHistory();
                if (t === "activity-log") window.AppAdmin?.loadLogs();
                if (t === "account") fillAccount();
                activateTab(t);
            });
            navEventsBound = true;
        }

        // Khôi phục tab từ localStorage, hoặc dùng tab mặc định theo role
        const savedTab = localStorage.getItem(TAB_STORAGE_KEY);
        const validTabs = tabs.map(t => t[0]);
        const defaultTab = isAdmin() ? "user-management" : "predict";
        const targetTab = savedTab && validTabs.includes(savedTab) ? savedTab : defaultTab;

        // Trigger data loading cho tab được khôi phục
        if (targetTab === "user-management") window.AppAdmin?.loadAdminUsers();
        if (targetTab === "history") loadHistory();
        if (targetTab === "activity-log") window.AppAdmin?.loadLogs();
        if (targetTab === "account" && isAuth()) fillAccount();
        activateTab(targetTab);
    }

    // ─── Profile ───
    async function ensureMyProfile() {
        if (!state.client || !state.session) return;
        const { error } = await state.client.rpc("ensure_my_profile");
        if (error) { }
    }

    async function loadProfile() {
        if (!state.session) { state.profile = null; return; }
        await ensureMyProfile();
        const { data, error } = await state.client.from("profiles").select("id,email,phone,full_name,role,created_at,updated_at").eq("id", state.session.user.id).maybeSingle();
        if (error) throw error;
        const profile = data || { id: state.session.user.id, email: state.session.user.email, full_name: state.session.user.user_metadata?.full_name || state.session.user.email, role: "user" };
        state.profile = { ...profile, phone: typeof profile.phone === "string" ? profile.phone : "" };
    }

    function fillAccount() {
        const n = $("accountFullName"), e = $("accountEmail"), p = $("accountPassword"), ph = $("accountPhone");
        if (n) n.value = state.profile?.full_name || "";
        if (e) e.value = state.profile?.email || state.session?.user?.email || "";
        if (ph) ph.value = state.profile?.phone || "";
        if (p) p.value = "";
    }

    // Reset tất cả form về trạng thái watermark/placeholder gốc.
    // Dùng form.reset() thay vì querySelectorAll — nhanh hơn, reset cả select về default.
    function clearAllForms() {
        document.querySelectorAll("form").forEach(f => f.reset());
        // Xóa prediction state + tab index khi chuyển phiên
        sessionStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TAB_STORAGE_KEY);
    }

    // ─── History (Supabase fetch, gọi window.renderHistory) ───
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

    // ─── User Realtime: tự cập nhật lịch sử khi có prediction mới ───
    let _userRealtimeChannel = null;
    function subscribeUserRealtime() {
        if (!state.client || !state.session || isAdmin() || _userRealtimeChannel) return;
        const userId = state.session.user.id;

        _userRealtimeChannel = state.client
            .channel("user-predictions-realtime")
            .on("postgres_changes", {
                event: "INSERT", schema: "public", table: "predictions",
                filter: `user_id=eq.${userId}`
            }, (payload) => {
                const row = payload.new;
                if (!row || !window.historyV2State || !window.renderHistory) return;

                // Kiểm tra đã có row tạm (từ prediction-complete event) chưa
                const existing = window.historyV2State.rows.find(r =>
                    r.id === row.id || (Math.abs(new Date(r.created_at) - new Date(row.created_at)) < 3000 && r.id > 1e12)
                );

                if (existing && existing.id > 1e12) {
                    // Thay thế row tạm bằng row chính thức từ DB
                    const oldId = existing.id;
                    Object.assign(existing, {
                        id: row.id,
                        created_at: row.created_at,
                        has_diabetes: row.has_diabetes || "–",
                        risk_band: row.risk_band || "–",
                        risk_score: row.risk_score ?? 0,
                        probability: row.probability || 0,
                        glucose: row.glucose ?? 0,
                        bmi: row.bmi ?? 0,
                        age: row.age ?? 0
                    });
                    // Chuyển cache detail sang ID mới
                    const cached = window.historyV2State.detailCache.get(oldId);
                    if (cached) {
                        window.historyV2State.detailCache.set(row.id, cached);
                        window.historyV2State.detailCache.delete(oldId);
                    }
                    if (window.historyV2State.selectedId === oldId) {
                        window.historyV2State.selectedId = row.id;
                    }
                } else if (!existing) {
                    // Row hoàn toàn mới (ví dụ từ tab khác)
                    const newRow = {
                        id: row.id,
                        created_at: row.created_at,
                        has_diabetes: row.has_diabetes || "–",
                        risk_band: row.risk_band || "–",
                        risk_score: row.risk_score ?? 0,
                        probability: row.probability || 0,
                        glucose: row.glucose ?? 0,
                        bmi: row.bmi ?? 0,
                        age: row.age ?? 0
                    };
                    window.historyV2State.detailCache.set(row.id, {
                        created_at: row.created_at,
                        input_data: row.input_payload || {
                            Pregnancies: row.pregnancies, Glucose: row.glucose,
                            BloodPressure: row.blood_pressure, SkinThickness: row.skin_thickness,
                            Insulin: row.insulin, BMI: row.bmi,
                            DiabetesPedigreeFunction: row.diabetes_pedigree, Age: row.age
                        },
                        prediction: row.prediction_payload || {}
                    });
                    window.historyV2State.rows.unshift(newRow);
                }

                window.renderHistory(window.historyV2State.rows);
            })
            .subscribe();
    }

    function unsubscribeUserRealtime() {
        if (_userRealtimeChannel) {
            state.client?.removeChannel(_userRealtimeChannel);
            _userRealtimeChannel = null;
        }
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
        if (isAuth()) {
            fillAccount();
            if (!isAdmin()) { loadHistory(); subscribeUserRealtime(); }
            if (isAdmin()) { window.AppAdmin?.loadAdminUsers(); window.AppAdmin?.loadLogs(); window.AppAdmin?.subscribeRealtime(); }
        }

        state.client.auth.onAuthStateChange(async (_, session) => {
            state.session = session;
            if (session) await loadProfile().catch(e => toast(e.message));
            else {
                state.profile = null;
                unsubscribeUserRealtime();
                if (els.historyBody) els.historyBody.innerHTML = '<tr><td colspan="6">Đăng nhập để xem.</td></tr>';
            }
            // Chỉ cập nhật giao diện, KHÔNG tải data ở đây
            // (data loading đã xử lý trong init() và authForm submit handler)
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
                state.session = null; state.profile = null;
                window.AppAdmin?.unsubscribeRealtime();
                unsubscribeUserRealtime();
                clearAllForms();
                if (els.historyBody) els.historyBody.innerHTML = '<tr><td colspan="6">Đăng nhập để xem.</td></tr>';
                renderNav(); activateTab("predict");
                toast("Đã đăng xuất");
                state.client?.auth.signOut({ scope: "local" }).catch(() => { });
            }
            if (e.target.closest("[data-admin-delete-user]")) {
                const confirmed = confirm(`Xóa tài khoản ${esc(state.selectedProfile?.email || "?")}? Hành động này không thể hoàn tác.`);
                if (!confirmed) return;
                (async () => {
                    try {
                        const { data: { session } } = await state.client.auth.getSession();
                        if (!session?.access_token) { toast("Không có phiên làm việc hợp lệ."); return; }
                        const response = await fetch(api("admin/delete-user"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
                            body: JSON.stringify({ target_user_id: state.selectedProfile?.id })
                        });
                        const result = await response.json();
                        if (response.ok) { toast(result.message); closeModal("adminUserModal"); await window.AppAdmin?.loadAdminUsers(); }
                        else { toast(`Lỗi: ${result.detail || result.message}`); }
                    } catch (err) { toast(`Lỗi: ${err.message}`); }
                })();
            }
            // Admin user row click → open modal
            const row = e.target.closest("[data-admin-user-id]");
            if (row) { const p = state.profiles.find(x => x.id === row.dataset.adminUserId); if (p) window.AppAdmin?.showUserModal(p); }
            // Admin detail tab switching
            const dt = e.target.closest("[data-detail-tab]");
            if (dt) {
                const t = dt.dataset.detailTab;
                const scope = dt.closest("#adminUserDetail") || document;
                scope.querySelectorAll("[data-detail-tab]").forEach(b => b.classList.toggle("is-active", b === dt));
                scope.querySelectorAll("[data-detail-panel]").forEach(p => p.classList.toggle("is-active", p.dataset.detailPanel === t));
            }
            // Admin history detail close
            if (e.target.closest("[data-close-history-detail]") && e.target.closest("#adminHisDetailPanel")) {
                if (window.AppAdmin) { window.AppAdmin.adminModal.selectedId = null; }
                if (window.renderHistoryV2Placeholder) {
                    window.renderHistoryV2Placeholder("Chọn một bản ghi", "Chi tiết sẽ được tải khi bạn chọn một dòng trong lịch sử ở bên trên.", $("adminHisDetail"));
                }
            }
        });

        document.addEventListener("submit", async e => {
            const form = e.target.closest("form"); if (!form) return;

            if (form.id === "authForm") {
                e.preventDefault(); if (!state.client) { toast("Supabase chưa kết nối."); return; }
                const mode = $("authModal").dataset.mode, email = $("authEmail").value.trim().toLowerCase(), pw = $("authPassword").value, fn = $("authFullName").value.trim();
                if (mode === "signup" && fn.length < 2) { toast("Họ tên ≥ 2 ký tự."); return; }
                const r = mode === "signup" ? await state.client.auth.signUp({ email, password: pw, options: { data: { full_name: fn } } }) : await state.client.auth.signInWithPassword({ email, password: pw });
                if (r.error) { toast(r.error.message); return; }
                state.session = r.data.session || state.session;
                if (state.session) {
                    await ensureMyProfile(); await loadProfile().catch(x => toast(x.message));
                    clearAllForms(); renderNav(); fillAccount();
                    // Tải dữ liệu phù hợp với role ngay sau khi đăng nhập
                    if (isAdmin()) { window.AppAdmin?.loadAdminUsers(); window.AppAdmin?.loadLogs(); window.AppAdmin?.subscribeRealtime(); }
                    else { loadHistory(); subscribeUserRealtime(); }
                }
                closeModal("authModal"); toast(mode === "signup" ? "Đăng ký thành công" : "Đăng nhập thành công");
            }
            if (form.id === "accountForm") {
                e.preventDefault();
                const fn = $("accountFullName").value.trim(); if (fn.length < 2) { toast("Họ tên ≥ 2 ký tự."); return; }
                const ph = $("accountPhone").value.trim();
                const pw = $("accountPassword").value;
                if (pw) { const ar = await state.client.auth.updateUser({ password: pw }); if (ar.error) { toast(ar.error.message); return; } }
                const { error } = await state.client.rpc("update_my_profile", { new_full_name: fn, new_phone: ph || null });
                if (error) { toast(error.message); return; }
                await loadProfile(); renderNav(); fillAccount(); toast("Đã cập nhật.");
            }
            if (form.id === "adminProfileForm") {
                e.preventDefault();
                const fn = $("adminProfileFullName").value.trim(); if (fn.length < 2) { toast("Họ tên ≥ 2 ký tự."); return; }
                const ph = $("adminProfilePhone").value.trim();
                const { error } = await state.client.rpc("admin_update_profile", { target_user_id: state.selectedProfile.id, new_full_name: fn, new_role: "user", new_phone: ph || null });
                if (error) { toast(error.message); return; }
                closeModal("adminUserModal"); await window.AppAdmin?.loadAdminUsers(); toast("Đã cập nhật.");
            }
        });

        document.addEventListener("input", e => {
            if (e.target.id === "adminUserSearch") debounce("adminSearch", () => window.AppAdmin?.loadAdminUsers());
            if (e.target.id === "logSearch") debounce("logSearch", () => window.AppAdmin?.renderLogs(), 150);
        });
        document.addEventListener("change", e => {
            if (e.target.id === "adminDiseaseFilter") window.AppAdmin?.loadAdminUsers();
            if (e.target.id === "logTypeFilter" || e.target.id === "logDateFilter") window.AppAdmin?.renderLogs();
        });

        els.form?.addEventListener("submit", e => {
            if (!state.session) { e.preventDefault(); e.stopImmediatePropagation(); openAuth(); }
        }, true);

        window.addEventListener("diabetes:prediction-complete", async e => {
            const pred = e.detail?.prediction, input = e.detail?.input || {};
            if (!pred || !state.session) return;

            // Lưu vào DB (background, không block UI)
            savePrediction(input, pred).catch(x => toast(x.message));

            // Thêm row mới vào đầu history (không fetch lại toàn bộ)
            if (window.historyV2State && window.renderHistory) {
                const now = new Date().toISOString();
                const newRow = {
                    id: Date.now(), // ID tạm, sẽ được thay khi fetch lại
                    created_at: now,
                    has_diabetes: pred.has_diabetes || "–",
                    risk_band: pred.risk_band || "–",
                    risk_score: pred.risk_score ?? 0,
                    probability: pred.probability || 0,
                    glucose: input.Glucose ?? 0,
                    bmi: input.BMI ?? 0,
                    age: input.Age ?? 0
                };
                // Cache detail cho row mới
                window.historyV2State.detailCache.set(newRow.id, {
                    created_at: now,
                    input_data: input,
                    prediction: pred
                });
                // Prepend vào đầu mảng rồi render lại table
                window.historyV2State.rows.unshift(newRow);
                window.renderHistory(window.historyV2State.rows);
            }
        });
    }

    ensurePanels(); bindEvents(); init();
})();
