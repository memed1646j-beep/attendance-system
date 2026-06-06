// 1. فحص الدخول التلقائي عند فتح الصفحة
window.onload = function() {
    const loggedInUser = localStorage.getItem('currentUser');
    if (loggedInUser) {
        const user = JSON.parse(loggedInUser);
        // التوجيه التلقائي حسب نوع الحساب
        if (user.role === 'student') {
            window.location.href = 'student.html';
        } else if (user.role === 'professor') {
            window.location.href = 'professor-dashboard.html';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // 2. منطق التبويبات (التبديل بين الطالب والأستاذ)
    const studentTab = document.getElementById('studentTab');
    const profTab = document.getElementById('profTab');
    const studentForm = document.getElementById('studentForm');
    const profForm = document.getElementById('profForm');

    // التأكد من وجود العناصر حتى ما يطلع خطأ
    if(studentTab && profTab) {
        studentTab.addEventListener('click', () => {
            studentForm.classList.add('active');
            profForm.classList.remove('active');
            studentTab.classList.add('active');
            profTab.classList.remove('active');
        });

        profTab.addEventListener('click', () => {
            profForm.classList.add('active');
            studentForm.classList.remove('active');
            profTab.classList.add('active');
            studentTab.classList.remove('active');
        });
    }
});

// 3. دالة التعامل مع الطالب (إنشاء حساب أو تسجيل دخول)
async function handleStudent() {
    const name = document.getElementById('studentName').value;
    const email = document.getElementById('studentEmail').value;
    const password = document.getElementById('studentPassword').value;
    const college = document.getElementById('collegeSelect').value;
    const department = document.getElementById('deptSelect').value;

    if (!email || !password) {
        alert("الرجاء إدخال الإيميل وكلمة المرور!");
        return;
    }

    // أ- إذا الاسم "فارغ"، يعني الطالب يريد "دخول"
    if (!name) {
        try {
            const res = await fetch('http://localhost:3000/login-student', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            
            if (data.success) { 
                // السحر: حفظ الجلسة في المتصفح
                localStorage.setItem('currentUser', JSON.stringify({ role: 'student', email: email }));
                alert('أهلاً بك، تم تسجيل الدخول!');
                window.location.href = 'student.html'; 
            } else {
                alert(data.message);
            }
        } catch (err) { alert('خطأ في الاتصال بالسيرفر'); }
    } 
    // ب- إذا الاسم "مكتوب"، يعني الطالب يريد "إنشاء حساب"
    else {
        try {
            const res = await fetch('http://localhost:3000/register-student', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ name, email, password, college, department })
            });
            const data = await res.json();
            
            if (data.success) {
                // السحر: حفظ الجلسة والدخول مباشرة بعد إنشاء الحساب
                localStorage.setItem('currentUser', JSON.stringify({ role: 'student', email: email }));
                alert('تم إنشاء الحساب بنجاح! جاري الدخول...');
                window.location.href = 'student.html';
            } else {
                alert(data.message); // يطبع مثلاً: هذا الإيميل مسجل مسبقاً
            }
        } catch (err) { alert('خطأ في الاتصال بالسيرفر'); }
    }
}

// دالة التعامل مع الأستاذ (تسجيل دخول أو إنشاء حساب)
async function handleProf() {
    const name = document.getElementById('profName').value;
    const email = document.getElementById('profEmail').value;
    const password = document.getElementById('profPassword').value;

    if (!email || !password) {
        alert("الرجاء إدخال الإيميل وكلمة المرور!");
        return;
    }

    // أ- إذا الاسم "فارغ" = تسجيل دخول
    if (!name) {
        try {
            const res = await fetch('http://localhost:3000/login-professor', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            
            if (data.success) { 
                localStorage.setItem('currentUser', JSON.stringify({ role: 'professor', email: email }));
                alert('أهلاً بك يا أستاذ!');
                window.location.href = 'professor-dashboard.html'; 
            } else { alert(data.message); }
        } catch (err) { alert('خطأ في الاتصال بالسيرفر'); }
    } 
    // ب- إذا الاسم "مكتوب" = إنشاء حساب جديد
    else {
        try {
            const res = await fetch('http://localhost:3000/register-professor', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ email, password }) // نرسل الإيميل والباسورد للسيرفر
            });
            const data = await res.json();
            
            if (data.success) {
                localStorage.setItem('currentUser', JSON.stringify({ role: 'professor', email: email }));
                alert('تم إنشاء حساب الأستاذ بنجاح! جاري الدخول...');
                window.location.href = 'professor-dashboard.html';
            } else { alert(data.message); } // مثلاً: الإيميل مسجل مسبقاً
        } catch (err) { alert('خطأ في الاتصال بالسيرفر'); }
    }
}
// دالة تصدير الجدول إلى ملف إكسل
function exportToExcel(tableID, filename) {
    // 1. نجيب الجدول من الواجهة عن طريق الـ ID مالته
    let table = document.getElementById(tableID);
    
    // 2. إذا الجدول ما موجود، نطلع تنبيه للأستاذ
    if (!table) {
        alert("لا يوجد جدول لتصديره!");
        return;
    }

    // 3. الأداة (XLSX) تاخذ الجدول وتحوله إلى ملف إكسل
    let workbook = XLSX.utils.table_to_book(table, {sheet: "قائمة الحضور"});
    
    // 4. نجهز اسم الملف (نضيفله امتداد .xlsx)
    let fullFileName = filename + '.xlsx';
    
    // 5. نعطي أمر التحميل، وينزل الملف مباشرة بالحاسبة
    XLSX.writeFile(workbook, fullFileName);
}
// نربط الزر الأصلي مالتك بالسيرفر
const startSessionBtn = document.getElementById('startSessionBtn');
const qrContainer = document.getElementById('qrContainer');

if (startSessionBtn && qrContainer) {
    startSessionBtn.addEventListener('click', function() {
        // نغير النص حتى الأستاذ يعرف إن النظام دا يحمل
        this.innerHTML = "⏳ جاري توليد الباركود...";

        // نطلب الشفرة السرية من السيرفر
        fetch('/api/generate-qr')
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                // نحول الشفرة لصورة
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${data.secret}`;
                
                // نعرض الصورة بداخل المربع الأصلي مالتك
                qrContainer.innerHTML = `
                    <img src="${qrUrl}" alt="باركود المحاضرة" style="width: 200px; height: 200px; border-radius: 10px; margin-bottom: 10px;">
                    <p style="color: #e53e3e; font-weight: bold;">تنبيه: هذا الباركود صالح لهذه المحاضرة فقط 🔒</p>
                `;

                // نرجع نص الزر لحالته الطبيعية
                this.innerHTML = "📍 بدء الجلسة وتوليد الباركود";
            }
        })
        .catch(err => {
            alert("حدث خطأ في الاتصال بالسيرفر!");
            this.innerHTML = "📍 بدء الجلسة وتوليد الباركود";
        });
    });
}