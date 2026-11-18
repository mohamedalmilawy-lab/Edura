require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');

// Models
const User = require('../models/User');
const Category = require('../models/Category');
const Course = require('../models/Course');

// Connect to database
connectDB();

const seedData = async () => {
  try {
    console.log('Starting seed process...');

    // Clear existing data
    await User.deleteMany({});
    await Category.deleteMany({});
    await Course.deleteMany({});
    console.log('Cleared existing data');

    // Create users
    const salt = await bcrypt.genSalt(12);

    // Admin user
    const admin = await User.create({
      fullName: 'مدير المنصة',
      email: 'admin@edura.com',
      password: await bcrypt.hash('admin123', salt),
      role: 'admin',
      walletBalance: 1000
    });
    console.log('Created admin user');

    // Teacher user
    const teacher = await User.create({
      fullName: 'أحمد المحمدي',
      email: 'teacher@edura.com',
      password: await bcrypt.hash('teacher123', salt),
      role: 'teacher',
      walletBalance: 500
    });
    console.log('Created teacher user');

    // Student users
    const students = await User.create([
      {
        fullName: 'محمد العلي',
        email: 'student1@edura.com',
        password: await bcrypt.hash('student123', salt),
        role: 'student',
        walletBalance: 300
      },
      {
        fullName: 'فاطمة الزهراء',
        email: 'student2@edura.com',
        password: await bcrypt.hash('student123', salt),
        role: 'student',
        walletBalance: 200
      },
      {
        fullName: 'خالد عبدالله',
        email: 'student3@edura.com',
        password: await bcrypt.hash('student123', salt),
        role: 'student',
        walletBalance: 150
      },
      {
        fullName: 'سارة أحمد',
        email: 'student4@edura.com',
        password: await bcrypt.hash('student123', salt),
        role: 'student',
        walletBalance: 400
      },
      {
        fullName: 'عمر حسن',
        email: 'student5@edura.com',
        password: await bcrypt.hash('student123', salt),
        role: 'student',
        walletBalance: 250
      }
    ]);
    console.log('Created 5 student users');

    // Create categories
    const categories = await Category.create([
      {
        name: 'برمجة وتطوير',
        description: 'كورسات في البرمجة وتطوير الويب والتطبيقات',
        icon: 'fa-code'
      },
      {
        name: 'تصميم',
        description: 'كورسات في التصميم الجرافيكي وUI/UX',
        icon: 'fa-palette'
      },
      {
        name: 'تسويق رقمي',
        description: 'كورسات في التسويق الإلكتروني ووسائل التواصل',
        icon: 'fa-bullhorn'
      },
      {
        name: 'ذكاء اصطناعي',
        description: 'كورسات في الذكاء الاصطناعي وتعلم الآلة',
        icon: 'fa-robot'
      }
    ]);
    console.log('Created 4 categories');

    // Create courses
    const courses = await Course.create([
      {
        title: 'تطوير الويب باستخدام Node.js',
        description: 'تعلم تطوير تطبيقات الويب باستخدام Node.js وExpress.js وMongoDB. هذا الكورس شامل ويغطي جميع الأساسيات والمفاهيم المتقدمة.',
        price: 199,
        image: '/uploads/default-course.jpg',
        category: categories[0]._id,
        teacher: teacher._id,
        status: 'available',
        enrolledCount: 45
      },
      {
        title: 'تصميم واجهات المستخدم UI/UX',
        description: 'تعلم تصميم واجهات المستخدم وتجربة المستخدم باستخدام Figma وأدوات التصميم الحديثة.',
        price: 149,
        image: '/uploads/default-course.jpg',
        category: categories[1]._id,
        teacher: teacher._id,
        status: 'available',
        enrolledCount: 32
      },
      {
        title: 'التسويق عبر وسائل التواصل',
        description: 'استراتيجيات فعالة للتسويق عبر فيسبوك، إنستغرام، تويتر ولينكدإن.',
        price: 99,
        image: '/uploads/default-course.jpg',
        category: categories[2]._id,
        teacher: teacher._id,
        status: 'available',
        enrolledCount: 28
      },
      {
        title: 'أساسيات الذكاء الاصطناعي',
        description: 'مقدمة شاملة في الذكاء الاصطناعي، تعلم الآلة، والشبكات العصبية.',
        price: 249,
        image: '/uploads/default-course.jpg',
        category: categories[3]._id,
        teacher: admin._id,
        status: 'available',
        enrolledCount: 56
      },
      {
        title: 'React.js للمبتدئين',
        description: 'تعلم بناء تطبيقات الويب التفاعلية باستخدام مكتبة React.js الشهيرة.',
        price: 179,
        image: '/uploads/default-course.jpg',
        category: categories[0]._id,
        teacher: teacher._id,
        status: 'available',
        enrolledCount: 38
      },
      {
        title: 'التصميم الجرافيكي الاحترافي',
        description: 'تعلم التصميم الجرافيكي باستخدام Adobe Photoshop وIllustrator.',
        price: 129,
        image: '/uploads/default-course.jpg',
        category: categories[1]._id,
        teacher: admin._id,
        status: 'available',
        enrolledCount: 22
      },
      {
        title: 'تحسين محركات البحث SEO',
        description: 'تعلم استراتيجيات SEO لتحسين ظهور موقعك في نتائج البحث.',
        price: 89,
        image: '/uploads/default-course.jpg',
        category: categories[2]._id,
        teacher: teacher._id,
        status: 'available',
        enrolledCount: 19
      },
      {
        title: 'تعلم الآلة المتقدم',
        description: 'كورس متقدم في تعلم الآلة يشمل التطبيقات العملية والمشاريع.',
        price: 299,
        image: '/uploads/default-course.jpg',
        category: categories[3]._id,
        teacher: admin._id,
        status: 'available',
        enrolledCount: 41
      },
      {
        title: 'قواعد البيانات SQL وNoSQL',
        description: 'تعلم تصميم وإدارة قواعد البيانات العلائقية وغير العلائقية.',
        price: 159,
        image: '/uploads/default-course.jpg',
        category: categories[0]._id,
        teacher: teacher._id,
        status: 'available',
        enrolledCount: 33
      },
      {
        title: 'التصوير الفوتوغرافي',
        description: 'تعلم أساسيات التصوير الفوتوغرافي وتحرير الصور.',
        price: 119,
        image: '/uploads/default-course.jpg',
        category: categories[1]._id,
        teacher: teacher._id,
        status: 'available',
        enrolledCount: 27
      },
      {
        title: 'إعلانات Google وFacebook',
        description: 'تعلم إنشاء وإدارة حملات إعلانية فعالة على Google وFacebook.',
        price: 139,
        image: '/uploads/default-course.jpg',
        category: categories[2]._id,
        teacher: admin._id,
        status: 'available',
        enrolledCount: 24
      },
      {
        title: 'معالجة اللغات الطبيعية NLP',
        description: 'تعلم معالجة اللغات الطبيعية وتطبيقاتها في ChatGPT والمساعدين الذكيين.',
        price: 269,
        image: '/uploads/default-course.jpg',
        category: categories[3]._id,
        teacher: admin._id,
        status: 'available',
        enrolledCount: 48
      }
    ]);
    console.log('Created 12 courses');

    console.log('\n========================================');
    console.log('Seed completed successfully!');
    console.log('========================================');
  
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

// Run seed
seedData();
