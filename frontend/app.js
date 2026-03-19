const API_BASE = 'http://127.0.0.1:8000/api';
const form = document.getElementById('predictionForm');
const resultDiv = document.getElementById('result');
const historyBody = document.getElementById('historyBody');
let radarChart = null;

const featureOrder = [
    'Pregnancies',                // Số lần mang thai
    'Glucose',                    // Nồng độ glucose trong máu                
    'BloodPressure',              // Huyết áp
    'SkinThickness',              // Độ dày da
    'Insulin',                    // Nồng độ insulin trong máu 
    'BMI',                        // Chỉ số khối cơ thể
    'DiabetesPedigreeFunction',   // yếu tố di truyền
    'Age'                         // Tuổi
];


// Hàm lấy dữ liệu từ form và chuẩn bị payload cho API
function getInputPayload() {
    return {
        Pregnancies: parseInt(document.getElementById('Pregnancies').value, 10),
        Glucose: parseFloat(document.getElementById('Glucose').value),
        BloodPressure: parseFloat(document.getElementById('BloodPressure').value),
        SkinThickness: parseFloat(document.getElementById('SkinThickness').value),
        Insulin: parseFloat(document.getElementById('Insulin').value),
        BMI: parseFloat(document.getElementById('BMI').value),
        DiabetesPedigreeFunction: parseFloat(document.getElementById('DiabetesPedigreeFunction').value),
        Age: parseInt(document.getElementById('Age').value, 10)
    };
}
// Hàm hiển thị kết quả dự đoán và lời khuyên sức khỏe
function renderResult(data) {
    const riskClass = data.has_diabetes === 'Có nguy cơ cao' ? 'risk-high' : 'risk-low';
    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = `
    <h2>Kết quả: <span class="${riskClass}">${data.has_diabetes}</span></h2>
    <p><strong>Xác suất nguy cơ:</strong> ${(data.probability * 100).toFixed(1)}%</p>
    <p><strong>Lời khuyên sức khỏe:</strong> ${data.advice}</p>
  `;
}
// Hàm vẽ biểu đồ radar so sánh chỉ số của người dùng với mức chuẩn tham chiếu
function renderRadarChart(referenceStats, userInput) {
    const labels = featureOrder;
    const referenceValues = labels.map((key) => referenceStats[key] ?? 0);
    const userValues = labels.map((key) => userInput[key] ?? 0);

    const ctx = document.getElementById('radarChart').getContext('2d');
    if (radarChart) radarChart.destroy();

    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Mức chuẩn (median)',
                    data: referenceValues,
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2
                },
                {
                    label: 'Chỉ số của bạn',
                    data: userValues,
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'So sánh chỉ số sức khỏe với mức chuẩn' }
            }
        }
    });
}
// Hàm hiển thị lịch sử các lần kiểm tra trước đó
function renderHistory(rows) {
    if (!rows.length) {
        historyBody.innerHTML = '<tr><td colspan="6">Chưa có dữ liệu.</td></tr>';
        return;
    }

    historyBody.innerHTML = rows
        .map(
            (item) => `
      <tr>
        <td>${new Date(item.created_at).toLocaleString('vi-VN')}</td>
        <td>${item.has_diabetes}</td>
        <td>${(item.probability * 100).toFixed(1)}%</td>
        <td>${item.glucose}</td>
        <td>${item.bmi}</td>
        <td>${item.age}</td>
      </tr>
    `
        )
        .join('');
}
// Hàm tải lịch sử kiểm tra từ API và hiển thị lên bảng
async function loadHistory() {
    const response = await fetch(`${API_BASE}/history?limit=10`);
    if (!response.ok) {
        throw new Error('Không tải được lịch sử kiểm tra');
    }
    const history = await response.json();
    renderHistory(history);
}
// Xử lý sự kiện submit form để gọi API dự đoán và hiển thị kết quả
form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = getInputPayload();

    try {
        const predictRes = await fetch(`${API_BASE}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });

        if (!predictRes.ok) throw new Error('Lỗi từ API dự đoán');
        const predictData = await predictRes.json();
        renderResult(predictData);

        const referenceRes = await fetch(`${API_BASE}/reference-stats`);
        if (!referenceRes.ok) throw new Error('Không tải được mức chuẩn tham chiếu');
        const referenceData = await referenceRes.json();
        renderRadarChart(referenceData, input);

        await loadHistory();
    } catch (error) {
        resultDiv.classList.remove('hidden');
        resultDiv.innerHTML = `<p class="error">Lỗi: ${error.message}. Hãy kiểm tra backend đã chạy chưa.</p>`;
    }
});
// Tải lịch sử kiểm tra khi trang được tải lên
loadHistory().catch(() => {
    historyBody.innerHTML = '<tr><td colspan="6">Không tải được lịch sử từ API.</td></tr>';
});