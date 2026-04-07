window.DiabetesUI = (() => {
    // Ép giá trị về số hợp lệ, nếu lỗi thì dùng giá trị mặc định.
    function numericValue(value, fallback = 0) {
        return Number.isFinite(Number(value)) ? Number(value) : fallback;
    }

    // Đọc số hiện tại từ text của một phần tử để phục vụ animation.
    function readAnimatedValue(text = "") {
        const parsed = parseFloat(String(text).replace(/[^\d.-]/g, ""));
        return Number.isFinite(parsed) ? parsed : 0;
    }

    // Animate số liệu trên giao diện từ giá trị đầu đến giá trị đích.
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

    // Gắn dữ liệu mục tiêu cho hiệu ứng count-up.
    function primeCountUp(element, value, decimals = 0) {
        if (!element) return;
        element.dataset.countTarget = `${value}`;
        element.dataset.countDecimals = `${decimals}`;
        element.dataset.countAnimated = "false";
    }

    // Chạy hiệu ứng đếm số tăng dần cho một phần tử.
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

    // Tạo IntersectionObserver cho các phần tử count-up.
    function createCountObserver() {
        return new IntersectionObserver(
            (entries, observer) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    if (!entry.target.classList.contains("count-up")) return;
                    if (entry.target.dataset.countAnimated === "true") return;

                    animateCountUp(entry.target);
                    observer.unobserve(entry.target);
                });
            },
            { threshold: 0.45 }
        );
    }

    // Theo dõi các phần tử count-up để chỉ animate khi chúng xuất hiện trên màn hình.
    function observeCountUps(root = document, countObserver) {
        const targets = root instanceof Element && root.matches(".count-up")
            ? [root, ...root.querySelectorAll(".count-up")]
            : Array.from(root.querySelectorAll(".count-up"));

        targets.forEach((element) => {
            if (element.dataset.countAnimated !== "true") {
                countObserver.observe(element);
            }
        });
    }

    // Chuyển tab đang xem và cập nhật trạng thái active của nút/tab panel.
    function activateTab(tabName, tabButtons, tabPanels, charts = []) {
        tabButtons.forEach((button) => {
            const isActive = button.dataset.tabTarget === tabName;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-selected", String(isActive));
        });

        tabPanels.forEach((panel) => {
            panel.classList.toggle("is-active", panel.dataset.tabPanel === tabName);
        });

        requestAnimationFrame(() => {
            charts.forEach((chart) => chart?.resize?.());
        });
    }

    // Đổi xác suất sang chuỗi phần trăm để hiển thị.
    function formatPercent(value) {
        return `${(value * 100).toFixed(1)}%`; // hàm toFixed(1) để làm tròn đến 1 chữ số thập phân, sau đó thêm dấu % vào cuối chuỗi.
    }

    // Quy đổi mức độ sang class màu chung của giao diện.
    function toneClass(level) {
        if (["high", "critical"].includes(level)) return "tone-high";
        if (["watch", "moderate"].includes(level)) return "tone-watch";
        if (["low", "normal"].includes(level)) return "tone-normal";
        return "tone-neutral";
    }

    // Chọn màu cảnh báo theo xác suất tổng.
    function riskTone(probability) {
        if (probability >= 0.75) return "tone-high";
        if (probability >= 0.4) return "tone-watch";
        return "tone-normal";
    }

    // Cập nhật đồng hồ nguy cơ, band và các chỉ số xác suất đi kèm.
    function updateRiskMeter(prediction, refs) {
        refs.riskMeter.style.setProperty("--progress", `${Math.round(prediction.probability * 360)}deg`);
        animateMetricNumber(refs.riskPercent, prediction.probability * 100, {
            decimals: 1,
            suffix: "%"
        });
        refs.riskBand.textContent = `${prediction.risk_band} - ${prediction.has_diabetes}`;
        refs.certaintyValue.textContent = prediction.certainty;
        animateMetricNumber(refs.modelProbability, prediction.model_probability * 100, {
            decimals: 1,
            suffix: "%"
        });
        animateMetricNumber(refs.clinicalProbability, prediction.clinical_probability * 100, {
            decimals: 1,
            suffix: "%"
        });
    }

    return {
        numericValue,
        animateMetricNumber,
        primeCountUp,
        createCountObserver,
        observeCountUps,
        activateTab,
        formatPercent,
        toneClass,
        riskTone,
        updateRiskMeter
    };
})();
