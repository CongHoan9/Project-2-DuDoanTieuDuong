window.DiabetesUI = (() => {
    function numericValue(value, fallback = 0) {
        return Number.isFinite(Number(value)) ? Number(value) : fallback;
    }

    function setMetricNumber(element, target, options = {}) {
        if (!element || !Number.isFinite(target)) return;

        const decimals = options.decimals ?? 0;
        const prefix = options.prefix ?? "";
        const suffix = options.suffix ?? "";
        element.textContent = `${prefix}${target.toFixed(decimals)}${suffix}`;
    }

    function primeCountUp(element, value, decimals = 0) {
        setMetricNumber(element, numericValue(value), { decimals });
        if (!element) return;
        element.dataset.countTarget = `${value}`;
        element.dataset.countDecimals = `${decimals}`;
        element.dataset.countAnimated = "true";
    }

    function createCountObserver() {
        return {
            observe() {},
            unobserve() {},
            disconnect() {}
        };
    }

    function observeCountUps(root = document) {
        const targets = root instanceof Element && root.matches(".count-up")
            ? [root, ...root.querySelectorAll(".count-up")]
            : Array.from(root.querySelectorAll(".count-up"));

        targets.forEach((element) => {
            setMetricNumber(element, numericValue(element.dataset.countTarget), {
                decimals: numericValue(element.dataset.countDecimals)
            });
        });
    }

    function activateTab(tabName, tabButtons, tabPanels, charts = []) {
        tabButtons.forEach((button) => {
            const isActive = button.dataset.tabTarget === tabName;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-selected", String(isActive));
        });

        tabPanels.forEach((panel) => {
            panel.classList.toggle("is-active", panel.dataset.tabPanel === tabName);
        });

        charts.forEach((chart) => chart?.resize?.());
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

    function updateRiskMeter(prediction, refs) {
        refs.riskMeter.style.setProperty("--progress", `${Math.round(prediction.probability * 360)}deg`);
        setMetricNumber(refs.riskPercent, prediction.probability * 100, {
            decimals: 1,
            suffix: "%"
        });
        refs.riskBand.textContent = `${prediction.risk_band} - ${prediction.has_diabetes}`;
        refs.certaintyValue.textContent = prediction.certainty;
        setMetricNumber(refs.modelProbability, prediction.model_probability * 100, {
            decimals: 1,
            suffix: "%"
        });
        setMetricNumber(refs.clinicalProbability, prediction.clinical_probability * 100, {
            decimals: 1,
            suffix: "%"
        });
    }

    return {
        numericValue,
        animateMetricNumber: setMetricNumber,
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
