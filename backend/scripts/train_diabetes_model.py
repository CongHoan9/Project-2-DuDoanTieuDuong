import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, roc_auc_score
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.preprocessing import StandardScaler


ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_FILE = ROOT_DIR / "data" / "raw" / "diabetes.csv"
ASSETS_DIR = ROOT_DIR / "backend" / "assets"
ZERO_AS_MISSING = ["Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI"]


def load_dataset() -> pd.DataFrame:
    df = pd.read_csv(DATA_FILE)
    for column in ZERO_AS_MISSING:
        df[column] = df[column].replace(0, float("nan"))
    return df


def build_features(df: pd.DataFrame):
    x = df.drop(columns=["Outcome"])
    y = df["Outcome"]
    return train_test_split(x, y, test_size=0.2, stratify=y, random_state=42)


def preprocess(x_train: pd.DataFrame, x_test: pd.DataFrame):
    imputer = SimpleImputer(strategy="median")
    x_train_imputed = imputer.fit_transform(x_train)
    x_test_imputed = imputer.transform(x_test)

    scaler = StandardScaler()
    x_train_scaled = scaler.fit_transform(x_train_imputed)
    x_test_scaled = scaler.transform(x_test_imputed)
    return imputer, scaler, x_train_scaled, x_test_scaled


def evaluate_model(name, model, x_train, x_test, y_train, y_test):
    model.fit(x_train, y_train)
    probabilities = model.predict_proba(x_test)[:, 1]
    predictions = model.predict(x_test)
    return {
        "name": name,
        "model": model,
        "accuracy": float(accuracy_score(y_test, predictions)),
        "roc_auc": float(roc_auc_score(y_test, probabilities)),
        "report": classification_report(y_test, predictions, output_dict=True),
    }


def tune_random_forest(x_train, y_train):
    param_grid = {
        "n_estimators": [100, 200],
        "max_depth": [8, 10, None],
        "min_samples_split": [2, 5],
        "class_weight": ["balanced"],
    }
    search = GridSearchCV(
        estimator=RandomForestClassifier(random_state=42),
        param_grid=param_grid,
        cv=5,
        scoring="roc_auc",
        n_jobs=-1,
    )
    search.fit(x_train, y_train)
    return search


def main():
    df = load_dataset()
    x_train, x_test, y_train, y_test = build_features(df)
    imputer, scaler, x_train_scaled, x_test_scaled = preprocess(x_train, x_test)

    baseline_candidates = [
        ("logistic_regression", LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)),
        ("random_forest", RandomForestClassifier(class_weight="balanced", n_estimators=200, random_state=42)),
        ("hist_gradient_boosting", HistGradientBoostingClassifier(random_state=42)),
    ]

    results = [
        evaluate_model(name, model, x_train_scaled, x_test_scaled, y_train, y_test)
        for name, model in baseline_candidates
    ]

    rf_search = tune_random_forest(x_train_scaled, y_train)
    tuned_rf_result = evaluate_model(
        "tuned_random_forest",
        rf_search.best_estimator_,
        x_train_scaled,
        x_test_scaled,
        y_train,
        y_test,
    )
    results.append(tuned_rf_result)

    best_result = max(results, key=lambda item: item["roc_auc"])

    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_result["model"], ASSETS_DIR / "diabetes_model.pkl")
    joblib.dump(imputer, ASSETS_DIR / "imputer_median.pkl")
    joblib.dump(scaler, ASSETS_DIR / "scaler.pkl")

    with (ASSETS_DIR / "reference_stats.json").open("w", encoding="utf-8") as file:
        json.dump(x_train.median(numeric_only=True).to_dict(), file, indent=2)

    metrics_payload = {
        "selected_model": best_result["name"],
        "accuracy": round(best_result["accuracy"], 3),
        "roc_auc": round(best_result["roc_auc"], 3),
        "best_random_forest_params": rf_search.best_params_,
        "cross_validation_roc_auc": round(float(rf_search.best_score_), 3),
        "all_candidates": [
            {
                "name": result["name"],
                "accuracy": round(result["accuracy"], 3),
                "roc_auc": round(result["roc_auc"], 3),
            }
            for result in results
        ],
    }
    with (ASSETS_DIR / "model_metrics.json").open("w", encoding="utf-8") as file:
        json.dump(metrics_payload, file, indent=2)

    print(json.dumps(metrics_payload, indent=2))


if __name__ == "__main__":
    main()
