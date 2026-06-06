// ==========================================
// ملف برمجة بوابة الطالب (فتح الكاميرا والمسح)
// ==========================================

const startScanBtn = document.getElementById('startScanBtn');
const stopScanBtn = document.getElementById('stopScanBtn');
const scanResultDiv = document.getElementById('scanResult');
let html5QrcodeScanner = null;

// دالة تشغيل الكاميرا
startScanBtn.addEventListener('click', () => {
    // إخفاء زر التشغيل وإظهار زر الإيقاف
    startScanBtn.style.display = 'none';
    stopScanBtn.style.display = 'inline-block';
    scanResultDiv.innerHTML = '<span style="color: blue;">جاري تشغيل الكاميرا...</span>';

    // تهيئة قارئ الباركود (نستهدف div اللي اسمه reader)
    html5QrcodeScanner = new Html5Qrcode("reader");

    // إعدادات الكاميرا (استخدام الكاميرا الخلفية إن وجدت)
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
        .catch(err => {
            console.error("خطأ في تشغيل الكاميرا:", err);
            scanResultDiv.innerHTML = `<span style="color: red;">تعذر فتح الكاميرا، يرجى التأكد من إعطاء الصلاحيات.</span>`;
            resetButtons();
        });
});

// دالة إيقاف الكاميرا يدوياً
stopScanBtn.addEventListener('click', () => {
    stopScanner();
    scanResultDiv.innerHTML = '<span style="color: #718096;">تم إيقاف الكاميرا.</span>';
});

// إذا تم قراءة الباركود بنجاح (هنا ضفنا كود الإرسال للسيرفر)
function onScanSuccess(decodedText, decodedResult) {
    // 1. نوقف الكاميرا فوراً
    stopScanner();
    
    scanResultDiv.innerHTML = `<span style="color: blue;">⏳ جاري إرسال البيانات والتحقق...</span>`;

    // 2. نجيب بيانات الطالب من الذاكرة
    const loggedInUser = localStorage.getItem('currentUser');
    if (!loggedInUser) {
        scanResultDiv.innerHTML = `<span style="color: red;">❌ خطأ: لم يتم العثور على بيانات الطالب.</span>`;
        return;
    }
    const studentData = JSON.parse(loggedInUser);

    // 3. نرسل البيانات للسيرفر
    fetch('/api/scan', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            qrCode: decodedText,              
            studentName: studentData.name || "طالب",    
            studentEmail: studentData.email,  
            time: new Date().toLocaleTimeString('ar-IQ') 
        })
    })
    .then(response => response.json())
    .then(data => {
        if(data.success) {
            // نطبع للطالب اسم المادة اللي حضرها
            scanResultDiv.innerHTML = `<span style="color: green; font-weight: bold;">✅ تم تسجيل حضورك بنجاح في مادة: ${data.subject}</span>`;
            
            // 🔥 [تحديث السجل]: نحفظ المحاضرة بذاكرة الطالب الداخلية
            let myHistory = JSON.parse(localStorage.getItem('studentHistory')) || [];
            myHistory.push({
                subject: data.subject,
                time: new Date().toLocaleTimeString('ar-IQ'),
                date: new Date().toLocaleDateString('ar-IQ'),
                status: 'حاضر ✅'
            });
            localStorage.setItem('studentHistory', JSON.stringify(myHistory));

            // تشغيل دالة تحديث واجهة السجل فوراً حتى يشوفها الطالب
            if (typeof displayStudentHistory === "function") {
                displayStudentHistory();
            }

        } else {
            scanResultDiv.innerHTML = `<span style="color: red;">❌ خطأ: ${data.message}</span>`;
        }
    })
    .catch(error => {
        console.error("خطأ:", error);
        scanResultDiv.innerHTML = `<span style="color: red;">❌ لم نتمكن من الوصول للسيرفر.</span>`;
    });
}


// إذا الكاميرا دتشتغل بس بعد مجايبة الباركود (نتجاهلها حتى ما تملي الكونسول)
function onScanFailure(error) {
    // لا تفعل شيئاً هنا، الكاميرا تحاول باستمرار
}

// دالة مساعدة لإيقاف الكاميرا وترتيب الأزرار
function stopScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            resetButtons();
        }).catch(err => console.error("خطأ في إيقاف الكاميرا", err));
    }
}

function resetButtons() {
    startScanBtn.style.display = 'inline-block';
    stopScanBtn.style.display = 'none';
}

// --- كود التنقل بين الشاشات ---
const navScan = document.getElementById('nav-scan');
const navHistory = document.getElementById('nav-history');
const navProfile = document.getElementById('nav-profile');

const scannerCard = document.querySelector('.scanner-card');
const historySection = document.getElementById('historySection');
const profileSection = document.getElementById('profileSection');

function switchTab(activeBtn, activeSection) {
    // 1. إخفاء الكل
    scannerCard.style.display = 'none';
    historySection.style.display = 'none';
    profileSection.style.display = 'none';
    
    // 2. إزالة التفعيل من الأزرار
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    // 3. إظهار المطلوب
    activeSection.style.display = 'block';
    activeBtn.classList.add('active');
}

navScan.addEventListener('click', () => switchTab(navScan, scannerCard));
navHistory.addEventListener('click', () => switchTab(navHistory, historySection));
navProfile.addEventListener('click', () => switchTab(navProfile, profileSection));

// --- كود تسجيل الخروج ---
document.getElementById('logoutBtn').addEventListener('click', () => {
    if(confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        window.location.href = 'index.html'; // يرجعك لصفحة تسجيل الدخول
    }
});
// دالة تقرأ السجل المخزون وتعرضه للطالب بـ "سجلي"
function displayStudentHistory() {
    const historySection = document.getElementById('historySection'); 
    if (!historySection) return;

    const myHistory = JSON.parse(localStorage.getItem('studentHistory')) || [];

    if (myHistory.length === 0) {
        historySection.innerHTML = `
            <h3 style="text-align: center; color: #718096; margin-top: 20px;">سجل الحضور فارغ 📅</h3>
            <p style="text-align: center; color: #a0aec0;">لم تقم بتسجيل الحضور في أي محاضرة بعد.</p>
        `;
        return;
    }

    // نبني جدول أنيق لعرض المواد
    let tableHtml = `
        <h3 style="color: #2d3748; margin-bottom: 15px;">📊 سجل الحضور الخاص بك:</h3>
        <table style="width: 100%; border-collapse: collapse; text-align: center; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <thead style="background-color: #4299e1; color: white;">
                <tr>
                    <th style="padding: 10px; border: 1px solid #e2e8f0;">المادة</th>
                    <th style="padding: 10px; border: 1px solid #e2e8f0;">التاريخ</th>
                    <th style="padding: 10px; border: 1px solid #e2e8f0;">الوقت</th>
                    <th style="padding: 10px; border: 1px solid #e2e8f0;">الحالة</th>
                </tr>
            </thead>
            <tbody>
    `;

    // نفتر على المصفوفة وننزل مادة مادة
    myHistory.reverse().forEach(item => { 
        tableHtml += `
            <tr style="border-bottom: 1px solid #edf2f7;">
                <td style="padding: 12px; font-weight: bold; color: #2b6cb0; border: 1px solid #e2e8f0;">${item.subject}</td>
                <td style="padding: 12px; color: #4a5568; border: 1px solid #e2e8f0;">${item.date}</td>
                <td style="padding: 12px; color: #4a5568; border: 1px solid #e2e8f0;">${item.time}</td>
                <td style="padding: 12px; color: green; font-weight: bold; border: 1px solid #e2e8f0;">${item.status}</td>
            </tr>
        `;
    });

    tableHtml += `</tbody></table>`;
    historySection.innerHTML = tableHtml;
}

// نخلي السجل يشتغل تلقائياً أول ما الطالب يفتح الصفحة مالتة
document.addEventListener('DOMContentLoaded', displayStudentHistory);