// ===================================================================
// COMMON.JS — Hằng số, DOM references, helpers, state dùng chung
// ===================================================================
// Được load ngay sau ui.js, trước tất cả module khác.
// → Sử dụng: window.DiabetesUI (từ ui.js)
// → Được dùng bởi: guest.js, user.js, admin.js, auth-rbac.js

// --- Hằng số cấu hình ứng dụng ---
// → Dùng bởi: guest.js (savePredictionState, restorePredictionState)
const STORAGE_KEY = "diabetesClinicalDashboardState";

// --- Thứ tự 8 feature đầu vào cho model dự đoán ---
// → Dùng bởi: guest.js (getInputPayload, renderRadarChart), user.js (renderHistoryV2Detail), admin.js (admin detail)
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

// --- Nhãn tiếng Việt fallback cho từng feature ---
// → Dùng bởi: guest.js (labelsMap), user.js (historyLabelsMap)
const fallbackLabels = {
    Pregnancies: "Số lần mang thai",
    Glucose: "Đường huyết",
    BloodPressure: "Huyết áp tâm trương",
    SkinThickness: "Độ dày lớp mỡ dưới da",
    Insulin: "Insulin",
    BMI: "BMI",
    DiabetesPedigreeFunction: "Yếu tố gia đình",
    Age: "Tuổi"
};

// --- Đơn vị đo lường fallback cho từng feature ---
// → Dùng bởi: user.js (historyUnitsMap), admin.js (admin detail)
const fallbackUnits = {
    Pregnancies: "lần",
    Glucose: "mg/dL",
    BloodPressure: "mmHg",
    SkinThickness: "mm",
    Insulin: "mu U/mL",
    BMI: "kg/m²",
    DiabetesPedigreeFunction: "điểm",
    Age: "tuổi"
};

// --- DOM element references dùng chung ---
// → Dùng bởi: guest.js (render functions), user.js (history table), auth-rbac.js (nav)
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
// tabButtons and tabPanels are queried fresh each time since auth-rbac.js rebuilds the nav dynamically.
const libraryBandsCanvas = document.getElementById("libraryBandsChart");
const librarySpreadCanvas = document.getElementById("librarySpreadChart");

// --- Tham chiếu UI utility module ---
// → Dùng bởi: mọi file (riskTone, toneClass, formatPercent, updateRiskMeter, ...)
const UI = window.DiabetesUI;

// --- State dữ liệu nền (được populate bởi guest.js bootstrap) ---
// → Dùng bởi: guest.js (renderRadarChart, labelsMap, renderModelInfo, ...)
let radarChart = null;
let libraryBandsChart = null;
let librarySpreadChart = null;
let referenceStats = {};
let clinicalContent = {};
let modelInfo = {};
let carePathwayItems = [];

// --- Count-up observer cho animation số ---
// → Dùng bởi: guest.js (bootstrap, primeCountUp)
const countObserver = UI.createCountObserver();

// --- Shared auth state (populated bởi auth-rbac.js) ---
// → Dùng bởi: auth-rbac.js (session management), admin.js (Supabase calls)
window.AppState = {
    client: null,
    session: null,
    profile: null,
    profiles: [],
    selectedProfile: null
};

// --- Shorthand helpers ---
// → Dùng bởi: admin.js, auth-rbac.js
// getElementById shorthand
const $ = (id) => document.getElementById(id);
// Escape HTML output (phiên bản ngắn, không escape single quote)
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Build API URL từ endpoint
const api = (ep) => `/api/${ep.replace(/^\/+/, "")}`;

// --- Role check helpers ---
// → Dùng bởi: admin.js (guard admin-only functions), auth-rbac.js (renderNav, routing)
const isAdmin = () => window.AppState.profile?.role === "admin";
const isAuth = () => !!window.AppState.session;

// ===================================================================
// HELPER FUNCTIONS — Dùng chung bởi nhiều module
// ===================================================================

// Trả về map tên hiển thị của các feature cho giao diện.
// → Dùng bởi: guest.js (renderRadarChart), user.js (renderHistoryV2Detail)
// → Sử dụng: clinicalContent (state)
function labelsMap() {
    return clinicalContent.feature_labels || fallbackLabels;
}

// Ghép endpoint con thành URL API đầy đủ.
// → Dùng bởi: guest.js (bootstrap, fetchJson), user.js (form submit)
function buildApiUrl(endpoint) {
    const safeEndpoint = String(endpoint || "").replace(/^\/+/, "");
    return `/api/${safeEndpoint}`;
}

// Lấy toàn bộ dữ liệu hiện tại từ form nhập liệu.
// → Dùng bởi: guest.js (form submit handler, renderQuickSignals)
// → Sử dụng: featureOrder (const), document.getElementById
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
// → Dùng bởi: guest.js (restorePredictionState)
// → Sử dụng: featureOrder (const)
function setInputPayload(input) {
    featureOrder.forEach((feature) => {
        const field = document.getElementById(feature);
        if (field && input?.[feature] !== undefined) {
            field.value = input[feature];
        }
    });
}


// Hàm helper gọi API GET và trả về JSON.
// → Dùng bởi: guest.js (bootstrap)
// → Sử dụng: buildApiUrl()
async function fetchJson(endpoint) {
    // Helper chung cho các API GET trả JSON.
    const response = await fetch(buildApiUrl(endpoint));
    if (!response.ok) {
        throw new Error(`Không tải được ${endpoint}`);
    }
    return response.json();
}

// Hiển thị thông báo toast ngắn trên màn hình.
// → Dùng bởi: guest.js, user.js, admin.js, auth-rbac.js
function showToast(message) {
    let toast = document.getElementById("appToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "appToast";
        toast.className = "app-toast";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        document.body.appendChild(toast);
    }

    window.clearTimeout(showToast.timeoutId);
    toast.textContent = message;
    toast.classList.add("is-visible");
    showToast.timeoutId = window.setTimeout(() => {
        toast.classList.remove("is-visible");
    }, 3200);
}
