document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); // فتح خط أونلاين
    let qrUpdateInterval = null;

    // 1. نظام التنقل
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.dash-section');
    navButtons.forEach(btn => {
        if(btn.classList.contains('logout-btn')) return;
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-target')).classList.add('active');
        });
    });

    // 2. نظام الباركود (محدث وسريع محلياً)
    const startSessionBtn = document.getElementById('startSessionBtn');
    
    if (startSessionBtn) {
        startSessionBtn.addEventListener('click', () => {
            const subjectName = document.getElementById('subjectNameInput').value.trim();
            if (!subjectName) return alert("الرجاء كتابة اسم المادة أولاً!");

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        
                        alert("✅ تم بدء الجلسة!");
                        startSessionBtn.innerText = "✅ الجلسة فعالة وتتحدث تلقائياً";
                        startSessionBtn.style.backgroundColor = "#48bb78";

                        socket.emit('startSession', { subject: subjectName, lat, lng });

                        // زيادة الوقت إلى 30 ثانية ليعطي الطالب فرصة للمسح
                        if(qrUpdateInterval) clearInterval(qrUpdateInterval);
                        qrUpdateInterval = setInterval(() => {
                            socket.emit('startSession', { subject: subjectName, lat, lng });
                        }, 30000); 
                    },
                    (error) => { alert("❌ يرجى إعطاء صلاحية الموقع (GPS) لفتح الجلسة!"); }
                );
            } else {
                alert("متصفحك لا يدعم الموقع.");
            }
        });
    }

    // توليد الباركود محلياً (سريع جداً وبدون مشاكل انترنت)
    socket.on('sessionUpdated', (data) => {
        const qrImageWrapper = document.getElementById('qrImageWrapper');
        qrImageWrapper.innerHTML = `
            <h4 style="color: #2b6cb0; margin-bottom: 10px;">المادة الحالية: ${data.subject}</h4>
            <div id="localQrCanvas" style="display: inline-block; padding: 10px; background: white; border: 2px solid #2b6cb0; border-radius: 10px;"></div>
            <p style="color: #e53e3e; font-weight: bold; font-size: 13px; margin-top: 10px;">🔒 الباركود يتغير كل 30 ثانية لمنع الغش</p>
        `;
        
        new QRCode(document.getElementById("localQrCanvas"), {
            text: data.secret,
            width: 200,
            height: 200
        });
    });

    // 3. استقبال حضور الطالب لحظياً
    socket.on('studentAttended', (studentData) => {
        const emptyRow = document.getElementById('emptyMessageRow');
        if (emptyRow) emptyRow.remove();

        const tbody = document.getElementById('liveAttendanceBody');
        const currentCount = tbody.getElementsByTagName('tr').length + 1;
        
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td>${currentCount}</td>
            <td>${studentData.studentName} / ${studentData.studentEmail}</td>
            <td style="font-weight: bold; color: #2b6cb0;">${studentData.subject}</td>
            <td style="color: #d69e2e; font-weight: bold;">${studentData.time}</td>
            <td><button onclick="this.closest('tr').remove()" style="background-color: #e53e3e; color: white; border: none; padding: 5px 10px; border-radius: 5px;">إلغاء ❌</button></td>
        `;
        tbody.appendChild(newRow);
    });

    // 4. رفع الإكسل (مستقل تماماً)
    const excelUploadInput = document.getElementById('excelUpload');
    if (excelUploadInput) {
        excelUploadInput.addEventListener('change', (e) => {
            // جلب اسم الكلاس المفتوح، وإذا لا يوجد يرسله عام
            const classCode = localStorage.getItem('currentClass') || "عام";
            const file = e.target.files[0];
            const reader = new FileReader();

            reader.onload = async (event) => {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const excelRows = XLSX.utils.sheet_to_json(worksheet);
                const studentEmails = excelRows.map(row => row.email || row['البريد الإلكتروني']).filter(Boolean);

                if (studentEmails.length === 0) return alert("❌ لم يتم العثور على إيميلات في الملف!");

                const response = await fetch('/import-excel-students', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ classCode, studentEmails })
                });
                const result = await response.json();
                alert(result.success ? '✅ ' + result.message : '❌ ' + result.message);
                excelUploadInput.value = ""; // تفريغ الحقل بعد الرفع
            };
            reader.readAsArrayBuffer(file);
        });
    }

    loadClasses();
});

// دوال الكلاسات
async function createNewClass() {
    const className = document.getElementById('className').value;
    if (!className) return alert('الرجاء كتابة اسم الكلاس!');
    
    const res = await fetch('/create-class', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ className }) });
    const data = await res.json();
    
    if (data.success) {
        localStorage.setItem('currentClass', className); // حفظ الكلاس في الذاكرة
        alert('✅ تم إنشاء الكلاس بنجاح!');
        document.getElementById('className').value = '';
        loadClasses();
    }
}

async function loadClasses() {
    const response = await fetch('/get-classes');
    const data = await response.json();
    const list = document.getElementById('classes-list');
    if (data.success && list) {
        list.innerHTML = ''; 
        data.classes.forEach(course => {
            list.innerHTML += `<div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd; margin-bottom: 10px;">📘 ${course.name}</div>`;
        });
    }
}

function addManualAttendance() {
    const nameInput = document.getElementById('manualStudentName');
    if (!nameInput.value.trim()) return alert("الرجاء كتابة اسم الطالب!");
    
    const emptyRow = document.getElementById('emptyMessageRow');
    if (emptyRow) emptyRow.remove();

    const tbody = document.getElementById('liveAttendanceBody');
    const time = new Date().getHours() + ':' + new Date().getMinutes().toString().padStart(2, '0');
    
    tbody.innerHTML += `<tr>
        <td>-</td>
        <td>${nameInput.value} (يدوي)</td>
        <td>-</td>
        <td style="color: #d69e2e; font-weight: bold;">${time}</td>
        <td><button onclick="this.closest('tr').remove()" style="background-color: #e53e3e; color: white; border: none; padding: 5px; border-radius: 5px;">إلغاء</button></td>
    </tr>`;
    nameInput.value = '';
}