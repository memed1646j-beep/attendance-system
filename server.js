const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// الاتصال بقاعدة البيانات
const dbURI = 'mongodb+srv://memed1646j_db_user:memed2026@cluster0.5aw6zfp.mongodb.net/attendance?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(dbURI).then(() => console.log('✅ متصل بقاعدة البيانات')).catch(err => console.log(err));

// الجداول (Models)
const Student = mongoose.model('Student', new mongoose.Schema({ name: String, email: { type: String, unique: true }, password: String, college: String, department: String }));
const Professor = mongoose.model('Professor', new mongoose.Schema({ email: { type: String, unique: true }, password: String }));
const Course = mongoose.model('Course', new mongoose.Schema({ name: String }));

// ==========================================
// مسارات الطالب
// ==========================================
// تسجيل جديد
app.post('/register-student', async (req, res) => {
    try {
        const newStudent = new Student(req.body);
        await newStudent.save();
        res.json({ success: true, message: 'تم إنشاء الحساب بنجاح!' });
    } catch (e) { res.json({ success: false, message: 'الإيميل مسجل مسبقاً!' }); }
});

// تسجيل دخول
app.post('/login-student', async (req, res) => {
    const { email, password } = req.body;
    const student = await Student.findOne({ email, password });
    if (student) res.json({ success: true });
    else res.json({ success: false, message: 'بيانات الدخول خاطئة' });
});

// ==========================================
// مسارات الأستاذ
// ==========================================
// 1. مسار إنشاء حساب أستاذ جديد (Register)
app.post('/register-professor', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // نشيك إذا الإيميل مسجل قبل
        const existingProf = await Professor.findOne({ email: email });
        if (existingProf) {
            return res.json({ success: false, message: 'هذا الإيميل مسجل مسبقاً!' });
        }

        // إنشاء أستاذ جديد
        const newProf = new Professor({ email, password });
        await newProf.save();
        res.json({ success: true, message: 'تم إنشاء الحساب بنجاح' });
    } catch (error) {
        res.json({ success: false, message: 'خطأ في السيرفر' });
    }
});

// 2. مسار تسجيل دخول الأستاذ (Login)
app.post('/login-professor', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const prof = await Professor.findOne({ email: email });
        
        // إذا الحساب ما موجود
        if (!prof) {
            return res.json({ success: false, message: 'الإيميل غير مسجل، يرجى إنشاء حساب أولاً!' });
        }

        // إذا الباسورد غلط
        if (prof.password !== password) {
            return res.json({ success: false, message: 'كلمة المرور غير صحيحة!' });
        }

        res.json({ success: true, message: 'تم تسجيل الدخول بنجاح' });
    } catch (error) {
        res.json({ success: false, message: 'خطأ في السيرفر' });
    }
});
app.post('/create-class', async (req, res) => {
    try {
        const newCourse = new Course({ name: req.body.className });
        await newCourse.save();
        res.json({ success: true, message: 'تم إنشاء الكلاس بنجاح' });
    } catch (error) {
        res.json({ success: false, message: 'خطأ في السيرفر أثناء إنشاء الكلاس' });
    }
});
// ==========================================
// مسارات الإكسل وجلب الكلاسات
// ==========================================

// 1. مسار رفع إيميلات الطلاب من الإكسل
app.post('/import-excel-students', async (req, res) => {
    try {
        const { classCode, studentEmails } = req.body;
        console.log("تم استلام طلاب كلاس:", classCode);
        res.json({ success: true, message: 'تم رفع قائمة الطلاب بنجاح!' });
    } catch (error) {
        res.json({ success: false, message: 'خطأ في السيرفر أثناء رفع الإكسل' });
    }
});

// 2. مسار جلب الكلاسات لعرضها في لوحة الأستاذ
app.get('/get-classes', async (req, res) => {
    try {
        const classes = await Course.find(); 
        res.json({ success: true, classes: classes });
    } catch (error) {
        res.json({ success: false, message: 'خطأ في السيرفر أثناء جلب الكلاسات' });
    }
});
// ==========================================
// مسارات الباركود والحضور
// ==========================================
let professorClients = [];
let currentLectureSecret = null; 
let currentSubjectName = ""; 

app.get('/api/generate-qr', (req, res) => {
    currentSubjectName = req.query.subject || "محاضرة عامة"; 
    currentLectureSecret = "LEC_" + Math.random().toString(36).substr(2, 9); 
    
    console.log(`تم فتح جلسة جديدة لمادة: ${currentSubjectName} بشفرة: ${currentLectureSecret}`);
    res.json({ success: true, secret: currentLectureSecret });
});

app.post('/api/scan', (req, res) => {
    const studentData = req.body;

    if (!currentLectureSecret || studentData.qrCode !== currentLectureSecret) {
        return res.status(400).json({ success: false, message: "عفواً، هذا الباركود غير صالح أو انتهت صلاحيته!" });
    }

    professorClients.forEach(client => {
        client.write(`data: ${JSON.stringify(studentData)}\n\n`);
    });

    res.json({ 
        success: true, 
        message: "تم تسجيل الحضور بنجاح", 
        subject: currentSubjectName 
    });
});

app.get('/api/live-updates', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    professorClients.push(res);
    req.on('close', () => {
        professorClients = professorClients.filter(client => client !== res);
    });
});

// ==========================================
// التشغيل والتصدير
// ==========================================
const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
    });
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// التصدير الصحيح لتعمل الاستضافة (Vercel)
module.exports = app;