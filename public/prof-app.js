document.addEventListener('DOMContentLoaded', () => {
    
    let currentClassCode = ""; // لحفظ كود الكلاس

    // ==========================================
    // 1. نظام التنقل بين الصفحات
    // ==========================================
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.dash-section');

    navButtons.forEach(btn => {
        if(btn.classList.contains('logout-btn')) return;

        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // ==========================================
    // 2. نظام الباركود الديناميكي والموقع (GPS)
    // ==========================================
    const startSessionBtn = document.getElementById('startSessionBtn');
    const qrContainer = document.getElementById('qrContainer');
    let qrCodeObj = null;

    if (startSessionBtn) {
        startSessionBtn.addEventListener('click', () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        
                        alert("تم تحديد موقع القاعة بنجاح! سيبدأ عرض الباركود.");
                        
                        startSessionBtn.innerText = "✅ الجلسة فعالة الآن";
                        startSessionBtn.style.backgroundColor = "#48bb78";
                        startSessionBtn.disabled = true;
generateDynamicQR(lat, lng);
                        
                        // تشغيل المراقبة الحية وربطها بالكلاس الحالي
                        if(currentClassCode) {
                            startLiveMonitoring(currentClassCode);
                        } else {
                            // إذا الأستاذ ما أنشأ كلاس، نمرر اسم افتراضي مؤقت للتجربة
                            startLiveMonitoring("Test-Session");
                        }

                        setInterval(() => {
                            generateDynamicQR(lat, lng);
                        }, 10000);
                        
                    },
                    (error) => {
                        alert("❌ يرجى الموافقة على إعطاء صلاحية الموقع (GPS) لفتح الجلسة!");
                    }
                );
            } else {
                alert("متصفحك لا يدعم ميزة تحديد الموقع!");
            }
        });
    }

    function generateDynamicQR(lat, lng) {
        const timestamp = new Date().getTime();
        const qrData = JSON.stringify({ profLat: lat, profLng: lng, time: timestamp });
        qrContainer.innerHTML = ''; 
        qrCodeObj = new QRCode(qrContainer, {
            text: qrData, width: 200, height: 200, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H
        });
    }

    // ==========================================
    // 3. نظام إنشاء الكلاسات ورفع ملفات الإكسل
    // ==========================================
    const createClassBtn = document.querySelector('#classes-section .main-btn');
    const classNameInput = document.getElementById('className');

    if (createClassBtn) {
        createClassBtn.addEventListener('click', async () => {
            const className = classNameInput.value;

            if(!className) {
                alert("يرجى كتابة اسم المادة أولاً!");
                return;
            }

            const response = await fetch('/create-class', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ className })
            });
            const result = await response.json();

            if (result.success) {
                currentClassCode = className;
                localStorage.setItem('currentClass', className);
                alert('✅ تم إنشاء الكلاس بنجاح!');
                classNameInput.value = "";
                loadClasses();
            } else {
                alert(result.message);
            }
        });
    }

    const excelUploadInput = document.getElementById('excelUpload');
    if (excelUploadInput) {
        excelUploadInput.addEventListener('change', (e) => {
            if (!localStorage.getItem('currentClass')) {
                alert("❌ يرجى إنشاء كلاس أولاً قبل رفع ملف الإكسل الخاص به!");
                excelUploadInput.value = ""; 
                return;
            }

            const file = e.target.files[0];
            const reader = new FileReader();

            reader.onload = async (event) => {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                const excelRows = XLSX.utils.sheet_to_json(worksheet);
                
                // استخراج الإيميلات
                const studentEmails = excelRows.map(row => row.email || row['البريد الإلكتروني'] || row['الإيميل']).filter(Boolean);

                if (studentEmails.length === 0) {
                    alert("❌ لم يتم العثور على عمود باسم (email) داخل ملف الإكسل!");
                    return;
                }

                // إرسال للسيرفر
                const response = await fetch('/import-excel-students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ classCode: localStorage.getItem('currentClass'), studentEmails: studentEmails })
        });
        
        const result = await response.json();
        if (result.success) {
            alert('✅ ' + result.message);
        } else {
            alert('❌ ' + result.message);
        }
    };

            reader.readAsArrayBuffer(file);
        });
    }
});
/* ======================================================
   نظام المراقبة الحية (Live Monitoring)
====================================================== */

// متغير لتخزين المؤقت حتى نكدر نوقفه إذا طلعنا من الجلسة
let liveInterval = null;

// دالة لجلب الحضور من السيرفر وتحديث الجدول
async function fetchLiveAttendance(sessionId) {
    try {
        // تنبيه: تأكد إن هذا الرابط يطابق الرابط اللي بملف server.js مالتك
        const response = await fetch(`/api/attendance/live/${sessionId}`);
        
        // إذا السيرفر رجع استجابة ناجحة
        if (response.ok) {
            const students = await response.json();
            const tbody = document.getElementById('liveAttendanceBody');

            // إذا اكو طلاب مسجلين (المصفوفة مو فارغة)
            if (students && students.length > 0) {
                tbody.innerHTML = ''; // نمسح رسالة "بانتظار تسجيل حضور الطلاب..."

                // نضيف كل طالب كسطر جديد بالجدول
                students.forEach((student, index) => {
                    // ترتيب الوقت بشكل مفهوم
                    const time = new Date(student.timestamp).toLocaleTimeString('ar-IQ');
                    
                    const row = `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${student.name || student.email}</td>
                            <td>${time}</td>
                            <td><span class="status-badge">حاضر</span></td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
            }
        }
    } catch (error) {
        console.error("خطأ في جلب بيانات المراقبة الحية:", error);
    }
}

// دالة تشغيل المراقبة (تستدعيها من تبدأ جلسة الباركود)
function startLiveMonitoring(sessionId) {
    // 1. إذا اكو مؤقت قديم شغال، نوقفه حتى لا يصير تداخل
    if (liveInterval) {
        clearInterval(liveInterval);
    }
    
    // 2. نجلب البيانات فوراً أول مرة
    fetchLiveAttendance(sessionId);

    // 3. نشغل المؤقت حتى يعيد جلب البيانات كل 3 ثواني (3000 ملي ثانية)
    liveInterval = setInterval(() => {
        fetchLiveAttendance(sessionId);
    }, 3000);
}

// دالة إيقاف المراقبة (تستدعيها من تنهي الجلسة)
function stopLiveMonitoring() {
    if (liveInterval) {
        clearInterval(liveInterval);
        liveInterval = null;
    }
}
async function createNewClass() {
    const className = document.getElementById('className').value;
    
    if (!className) {
        alert('الرجاء كتابة اسم الكلاس (المادة) أولاً!');
        return;
    }

    try {
        const res = await fetch('/create-class', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ className: className })
        });
        const data = await res.json();
        
        if (data.success) {
            alert('✅ تم إنشاء الكلاس بنجاح!');
            document.getElementById('className').value = ''; // تفريغ الحقل بعد الإنشاء
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('خطأ في الاتصال بالسيرفر');
    }
}
// دالة جلب وعرض الكلاسات
async function loadClasses() {
    try {
        const response = await fetch('/get-classes');
        const data = await response.json();
        
        if (data.success) {
            const list = document.getElementById('classes-list');
            if(list) {
                list.innerHTML = ''; // تصفير القائمة 
              data.classes.forEach(course => {
    list.innerHTML += `
        <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; color: #2c3e50; font-size: 18px;">📘 ${course.name}</h3>
            <button class="secondary-btn" onclick="window.location.href='session.html?classCode=${course.name}'" style="margin: 0; background: #27ae60; color: white; border: none; padding: 8px 12px; border-radius: 5px;">فتح الجلسة</button>
        </div>
    `;
});
            }
        }
    } catch (error) {
        console.log('حدث خطأ أثناء تحميل الكلاسات:', error);
    }
}

// استدعاء الدالة فور تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    loadClasses();
});