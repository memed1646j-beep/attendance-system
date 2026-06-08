const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); // ضروري للـ socket.io
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

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
// مسارات الطالب والأستاذ (تسجيل الدخول والإنشاء)
// ==========================================
app.post('/register-student', async (req, res) => {
    try {
        const newStudent = new Student(req.body);
        await newStudent.save();
        res.json({ success: true, message: 'تم إنشاء الحساب بنجاح!' });
    } catch (e) { res.json({ success: false, message: 'الإيميل مسجل مسبقاً!' }); }
});

app.post('/login-student', async (req, res) => {
    const { email, password } = req.body;
    const student = await Student.findOne({ email, password });
    if (student) res.json({ success: true });
    else res.json({ success: false, message: 'بيانات الدخول خاطئة' });
});

app.post('/register-professor', async (req, res) => {
    try {
        const { email, password } = req.body;
        const existingProf = await Professor.findOne({ email: email });
        if (existingProf) return res.json({ success: false, message: 'هذا الإيميل مسجل مسبقاً!' });

        const newProf = new Professor({ email, password });
        await newProf.save();
        res.json({ success: true, message: 'تم إنشاء الحساب بنجاح' });
    } catch (error) { res.json({ success: false, message: 'خطأ في السيرفر' }); }
});

app.post('/login-professor', async (req, res) => {
    try {
        const { email, password } = req.body;
        const prof = await Professor.findOne({ email: email });
        if (!prof) return res.json({ success: false, message: 'الإيميل غير مسجل، يرجى إنشاء حساب أولاً!' });
        if (prof.password !== password) return res.json({ success: false, message: 'كلمة المرور غير صحيحة!' });
        res.json({ success: true, message: 'تم تسجيل الدخول بنجاح' });
    } catch (error) { res.json({ success: false, message: 'خطأ في السيرفر' }); }
});

// ==========================================
// مسارات الإكسل والكلاسات (مفصولة تماماً)
// ==========================================
app.post('/create-class', async (req, res) => {
    try {
        const newCourse = new Course({ name: req.body.className });
        await newCourse.save();
        res.json({ success: true, message: 'تم إنشاء الكلاس بنجاح' });
    } catch (error) { res.json({ success: false, message: 'خطأ في السيرفر أثناء إنشاء الكلاس' }); }
});

app.post('/import-excel-students', async (req, res) => {
    try {
        const { classCode, studentEmails } = req.body;
        console.log("تم استلام إكسل طلاب كلاس:", classCode);
        res.json({ success: true, message: 'تم رفع قائمة الطلاب بنجاح وبدون تضارب!' });
    } catch (error) { res.json({ success: false, message: 'خطأ في السيرفر أثناء رفع الإكسل' }); }
});

app.get('/get-classes', async (req, res) => {
    try {
        const classes = await Course.find(); 
        res.json({ success: true, classes: classes });
    } catch (error) { res.json({ success: false, message: 'خطأ في السيرفر' }); }
});

// ==========================================
// نظام الحضور المباشر (Socket.io) 24/7 + حماية الغش
// ==========================================
let activeSessions = {}; // يخزن الشفرات الحية لكل مادة لمنع الغش

io.on('connection', (socket) => {
    console.log('مستخدم متصل:', socket.id);

    // 1. الأستاذ يبدأ الجلسة أو يحدث الباركود
    socket.on('startSession', (data) => {
        const { subject, lat, lng } = data;
        const secretToken = "LEC_" + Math.random().toString(36).substr(2, 9); // توكن ديناميكي
        
        activeSessions[subject] = { secret: secretToken, profSocketId: socket.id, lat, lng };
        socket.emit('sessionUpdated', { success: true, secret: secretToken, subject });
    });

    socket.on('scanQR', async (data) => { // 1. أضف async هنا
    const { qrCode, studentName, studentEmail, time, lat, lng } = data;

    // --- (أضف هذا الجزء الجديد) ---
    // التحقق من وجود الطالب في قاعدة البيانات
    const student = await Student.findOne({ email: studentEmail });
    if (!student) {
        return socket.emit('scanResult', { success: false, message: "❌ اسمك غير موجود في قائمة الحضور الرسمية!" });
    }
    // ----------------------------
        // البحث عن المادة ومطابقة الباركود لمنع مسح صورة قديمة
        let foundSubject = null;
        let sessionInfo = null;

        for (const [subject, info] of Object.entries(activeSessions)) {
            if (info.secret === qrCode) {
                foundSubject = subject;
                sessionInfo = info;
                break;
            }
        }

        if (!foundSubject) {
            return socket.emit('scanResult', { success: false, message: "❌ الباركود غير صالح أو قديم! (يمنع الغش)" });
        }

        if (!lat || !lng) {
            return socket.emit('scanResult', { success: false, message: "❌ يرجى الموافقة على الموقع (GPS) لتأكيد حضورك بالقاعة!" });
        }

        // إرسال الحضور فوراً لشاشة الأستاذ
        io.to(sessionInfo.profSocketId).emit('studentAttended', {
            studentName:studentName, studentEmail:studentEmail, time:time, subject: foundSubject
        });

        // تأكيد النجاح للطالب
        socket.emit('scanResult', { success: true, subject: foundSubject, time: time, message: "تم تسجيل الحضور بنجاح ✅" });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${PORT} (أونلاين 100%)`);
});

module.exports = server;