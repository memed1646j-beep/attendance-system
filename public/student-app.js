const socket = io(); // فتح خط الاتصال بالسيرفر
const startScanBtn = document.getElementById('startScanBtn');
const stopScanBtn = document.getElementById('stopScanBtn');
const scanResultDiv = document.getElementById('scanResult');
let html5QrcodeScanner = null;

// عرض بيانات الطالب في قسم الحساب عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    const loggedInUser = localStorage.getItem('currentUser');
    if (loggedInUser) {
        const studentData = JSON.parse(loggedInUser);
        const profileSection = document.getElementById('profileSection');
        
        // إضافة اسم الطالب وإيميله فوق زر تسجيل الخروج
        const infoDiv = document.createElement('div');
        infoDiv.style.marginBottom = '20px';
        infoDiv.style.padding = '15px';
        infoDiv.style.backgroundColor = '#edf2f7';
        infoDiv.style.borderRadius = '8px';
        infoDiv.style.textAlign = 'center';
        infoDiv.innerHTML = `<strong style="color: #2b6cb0;">الاسم:</strong> ${studentData.name || 'غير متوفر'}<br><strong style="color: #2b6cb0;">الإيميل:</strong> ${studentData.email}`;
        
        // إدخال البيانات قبل زر تسجيل الخروج
        profileSection.insertBefore(infoDiv, document.getElementById('logoutBtn'));
    }
    displayStudentHistory();
});

startScanBtn.addEventListener('click', () => {
    startScanBtn.style.display = 'none';
    stopScanBtn.style.display = 'inline-block';
    scanResultDiv.innerHTML = '<span style="color: blue;">جاري تشغيل الكاميرا...</span>';

    html5QrcodeScanner = new Html5Qrcode("reader");
    
    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } }, 
        onScanSuccess, 
        onScanFailure
    )
    scanResultDiv.innerHTML = ''; // تصفير رسالة التحميل

        try {
            // جلب بث الكاميرا الشغالة حالياً بشكل مباشر وآمن
            const localStream = html5QrcodeScanner.localMediaStream;
            if (localStream) {
                const videoTrack = localStream.getVideoTracks()[0];
                
                if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
                    const capabilities = videoTrack.getCapabilities();
                    
                    // التأكد إذا كانت الكاميرا تدعم الزووم
                    if (capabilities.zoom) {
                        const oldSlider = document.getElementById('zoom-slider-wrapper');
                        if (oldSlider) oldSlider.remove();

                        // إنشاء واجهة شريط الزووم
                        const sliderWrapper = document.createElement('div');
                        sliderWrapper.id = 'zoom-slider-wrapper';
                        sliderWrapper.style.cssText = 'margin-top: 15px; text-align: center; background: #edf2f7; padding: 10px; border-radius: 8px;';
                        sliderWrapper.innerHTML = `
                            <label style="font-weight: bold; color: #2b6cb0; display: block; margin-bottom: 5px;">🔍 تكبير الصورة (Zoom)</label>
                            <input type="range" id="zoom-range" min="${capabilities.zoom.min}" max="${capabilities.zoom.max}" step="${capabilities.zoom.step || 0.1}" value="${capabilities.zoom.current || capabilities.zoom.min}" style="width: 80%; accent-color: #2b6cb0;">
                        `;
                        
                        document.getElementById('reader').after(sliderWrapper);

                        // ربط شريط السحب للتحكم بالزووم
                        document.getElementById('zoom-range').addEventListener('input', (e) => {
                            videoTrack.applyConstraints({
                                advanced: [{ zoom: parseFloat(e.target.value) }]
                            }).catch(err => console.log("خطأ في تطبيق الزووم:", err));
                        });
                    } else {
                        console.log("هذه الكاميرا لا تدعم الزووم برمجياً.");
                    }
                }
            }
        } catch (zoomError) {
            console.log("فشل تهيئة الزووم:", zoomError);
        }
        
        // ------------------------------
    })
    .catch(err => { 
        scanResultDiv.innerHTML = `<span style="color: red;">تعذر فتح الكاميرا! تأكد من إعطاء الصلاحيات.</span>`; 
        resetButtons(); 
    });
  


stopScanBtn.addEventListener('click', () => {
    stopScanner();
    scanResultDiv.innerHTML = '<span style="color: #718096;">تم إيقاف الكاميرا.</span>';
});

// عند مسح الباركود بنجاح
function onScanSuccess(decodedText, decodedResult) {
    stopScanner();
    scanResultDiv.innerHTML = `<span style="color: blue;">⏳ جاري إرسال البيانات والتحقق من الموقع وقائمة الإكسل...</span>`;

    const loggedInUser = localStorage.getItem('currentUser');
    if (!loggedInUser) return scanResultDiv.innerHTML = `<span style="color: red;">❌ خطأ: لم يتم العثور على بيانات الطالب.</span>`;
    
    const studentData = JSON.parse(loggedInUser);
    
    // جلب الوقت الحالي بالدقيقة والدقة
    const now = new Date();
    const exactTime = now.getHours() + ':' + now.getMinutes().toString().padStart(2, '0');

    // طلب الموقع (GPS) لمنع الغش
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // نرسل الإيميل فقط، السيرفر سيقوم بمطابقته مع الإكسل وجلب الاسم الحقيقي
                socket.emit('scanQR', {
                    qrCode: decodedText,              
                    studentEmail: studentData.email,  
                    time: exactTime,
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            },
            (error) => {
                scanResultDiv.innerHTML = `<span style="color: red;">❌ يرجى تفعيل الـ GPS (الموقع) لتسجيل حضورك بالقاعة!</span>`;
            }
        );
    } else {
        scanResultDiv.innerHTML = `<span style="color: red;">متصفحك لا يدعم تحديد الموقع.</span>`;
    }
}

function onScanFailure(error) {} // تجاهل الأخطاء المستمرة للكاميرا

function stopScanner() { 
    if (html5QrcodeScanner) { 
        html5QrcodeScanner.stop().then(() => {
            // حذف شريط الزووم عند إيقاف الكاميرا
            const sliderWrapper = document.getElementById('zoom-slider-wrapper');
            if (sliderWrapper) sliderWrapper.remove();
            resetButtons();
        }).catch(err => console.log(err)); 
    } 
}
function resetButtons() { 
    startScanBtn.style.display = 'inline-block'; 
    stopScanBtn.style.display = 'none'; 
}

// الرد من السيرفر بنجاح أو فشل المسح (مثل عدم وجود الطالب بالإكسل)
socket.on('scanResult', (data) => {
    if(data.success) {
        scanResultDiv.innerHTML = `<span style="color: green; font-weight: bold;">${data.message} <br> مادة: ${data.subject} | الساعة: ${data.time}</span>`;
        
        let myHistory = JSON.parse(localStorage.getItem('studentHistory')) || [];
        myHistory.push({
            subject: data.subject,
            time: data.time,
            date: new Date().toLocaleDateString('ar-IQ'),
            status: 'حاضر ✅'
        });
        localStorage.setItem('studentHistory', JSON.stringify(myHistory));

        if (typeof displayStudentHistory === "function") displayStudentHistory();
    } else {
        scanResultDiv.innerHTML = `<span style="color: red; font-weight: bold;">${data.message}</span>`;
    }
});

// نظام التنقل
const navScan = document.getElementById('nav-scan');
const navHistory = document.getElementById('nav-history');
const navProfile = document.getElementById('nav-profile');
const scannerCard = document.getElementById('scannerCard');
const historySection = document.getElementById('historySection');
const profileSection = document.getElementById('profileSection');

function switchTab(activeBtn, activeSection) {
    [scannerCard, historySection, profileSection].forEach(sec => sec.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    activeSection.style.display = 'block';
    activeBtn.classList.add('active');
}

navScan.addEventListener('click', () => switchTab(navScan, scannerCard));
navHistory.addEventListener('click', () => switchTab(navHistory, historySection));
navProfile.addEventListener('click', () => switchTab(navProfile, profileSection));

document.getElementById('logoutBtn').addEventListener('click', () => {
    if(confirm('هل أنت متأكد من تسجيل الخروج؟')) { 
        localStorage.removeItem('currentUser'); 
        window.location.href = 'index.html'; 
    }
});

function displayStudentHistory() {
    const myHistory = JSON.parse(localStorage.getItem('studentHistory')) || [];
    if (myHistory.length === 0) {
        historySection.innerHTML = `<h3 style="text-align: center; color: #718096; margin-top: 20px;">سجل الحضور فارغ 📅</h3>`;
        return;
    }

    let tableHtml = `<h3 style="color: #2d3748; margin-bottom: 15px;">📊 سجل الحضور الخاص بك:</h3>
        <table style="width: 100%; border-collapse: collapse; text-align: center; background-color: white; border-radius: 8px;">
            <thead style="background-color: #4299e1; color: white;">
                <tr><th>المادة</th><th>التاريخ</th><th>الوقت</th><th>الحالة</th></tr>
            </thead><tbody>`;

    myHistory.reverse().forEach(item => { 
        tableHtml += `<tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 12px; font-weight: bold; color: #2b6cb0;">${item.subject}</td>
            <td style="padding: 12px; color: #4a5568;">${item.date}</td>
            <td style="padding: 12px; color: #d69e2e; font-weight: bold;">${item.time}</td>
            <td style="padding: 12px; color: green; font-weight: bold;">${item.status}</td>
        </tr>`;
    });
    tableHtml += `</tbody></table>`;
    historySection.innerHTML = tableHtml;
}