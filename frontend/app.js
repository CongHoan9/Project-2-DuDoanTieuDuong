const form = document.getElementById('predictionForm');
const resultDiv = document.getElementById('result');
let radarChart = null;

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const input = {
        Pregnancies: parseInt(document.getElementById('Pregnancies').value),
        Glucose: parseFloat(document.getElementById('Glucose').value),
        BloodPressure: parseFloat(document.getElementById('BloodPressure').value),
        SkinThickness: parseFloat(document.getElementById('SkinThickness').value),
        Insulin: parseFloat(document.getElementById('Insulin').value),
        BMI: parseFloat(document.getElementById('BMI').value),
        DiabetesPedigreeFunction: parseFloat(document.getElementById('DiabetesPedigreeFunction').value),
        Age: parseInt(document.getElementById('Age').value)
    };

    try {
        // Gọi API predict
        const predictRes = await fetch('http://127.0.0.1:8000/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });

        if (!predictRes.ok) throw new Error('Lỗi từ API predict');
        const predictData = await predictRes.json();

        // Hiển thị kết quả
        resultDiv.innerHTML = `
      <h2>Kết quả: ${predictData.has_diabetes}</h2>
      <p><strong>Xác suất nguy cơ:</strong> ${(predictData.probability * 100).toFixed(1)}%</p>
      <p><strong>Lời khuyên:</strong> ${predictData.advice}</p>
    `;

        // Lấy reference stats cho radar chart
        const refRes = await fetch('http://127.0.0.1:8000/api/reference-stats');
        const refData = await refRes.json();

        const labels = Object.keys(refData);
        const userValues = labels.map(key => input[key] || 0);

        // Vẽ radar chart
        const ctx = document.getElementById('radarChart').getContext('2d');
        if (radarChart) radarChart.destroy();
        radarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Mức chuẩn (median)',
                        data: Object.values(refData),
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
                scales: {
                    r: {
                        angleLines: { display: true },
                        suggestedMin: 0,
                        suggestedMax: Math.max(...Object.values(refData), ...userValues) * 1.2
                    }
                },
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'So sánh chỉ số sức khỏe của bạn với mức chuẩn' }
                }
            }
        });

    } catch (err) {
        resultDiv.innerHTML = `<p style="color:red;">Lỗi: ${err.message}. Hãy kiểm tra backend đang chạy chưa.</p>`;
    }
});