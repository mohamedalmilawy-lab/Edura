const asyncHandler = require('express-async-handler');
const Category = require('../models/Category');
const Course = require('../models/Course');
const Comment = require('../models/Comment');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Wishlist = require('../models/Wishlist');
const ApiResponse = require('../utils/ApiResponse');

// POST /api/chat
exports.createChat = asyncHandler(async (req, res) => {
    const userMessage = typeof req.body?.message === 'string'
        ? req.body.message.trim()
        : '';

    if (!userMessage) {
        return ApiResponse.badRequest(res, 'يرجى إرسال رسالة');
    }
    if (userMessage.length > 2000) {
        return ApiResponse.badRequest(res, 'الرسالة طويلة جداً؛ يرجى اختصارها إلى أقل من 2000 حرف');
    }
    if (!process.env.API_KEY) {
        console.error('Chat AI Error: API_KEY is not configured');
        return ApiResponse.serverError(res, 'خدمة المساعد الذكي غير مُهيأة حالياً');
    }

    if (!req.session.chatHistory) {
        req.session.chatHistory = [];
    }

    req.session.chatHistory = req.session.chatHistory
        .filter(item => item && ['user', 'assistant'].includes(item.role) &&
            typeof item.content === 'string' && item.content.length <= 2000)
        .slice(-12);

    const [availableCourses, allCategories, accountLists] = await Promise.all([
        Course.find({ status: 'available' })
            .populate('category')
            .populate('teacher', 'fullName bio profileImage')
            .sort({ enrolledCount: -1, rating: -1, createdAt: -1 })
            .limit(300),
        Category.find().sort({ name: 1 }),
        req.user ? Promise.all([
            Order.find({ user: req.user._id, status: 'confirmed' }).select('courses'),
            Cart.findOne({ user: req.user._id }).select('courses'),
            Wishlist.findOne({ user: req.user._id }).select('courses')
        ]) : Promise.resolve([[], null, null])
    ]);

    const courseIds = availableCourses.map(course => course._id);
    const ratings = await Comment.getRatingSummaries(courseIds);

    let catalogText = 'قاعدة الكورسات الحالية على Edura (لا تستخدم كورساً أو سعراً غير موجود هنا):\n';

    const coursesGroupedByCat = availableCourses.reduce((acc, p) => {
        const catName = p.category?.name || "أخرى";
        if (!acc[catName]) acc[catName] = [];
        acc[catName].push(p);
        return acc;
    }, {});

    for (const [catName, courses] of Object.entries(coursesGroupedByCat)) {
        catalogText += `\n[تصنيف ${catName}]:\n`;
        courses.forEach(course => {
            const priceText = course.hasActiveOffer
                ? `${course.effectivePrice.toLocaleString('ar-SY')} ل.س (خصم؛ السعر الأصلي ${course.price.toLocaleString('ar-SY')} ل.س)`
                : `${course.price.toLocaleString('ar-SY')} ل.س`;
            const rating = ratings[course._id.toString()];
            const ratingText = rating
                ? `${rating.averageRating}/5 من ${rating.ratingCount} تقييمات`
                : 'لا توجد تقييمات';
            const teacherName = course.teacher?.fullName || 'غير معروف';
            const teacherBio = course.teacher?.bio?.trim();
            const description = course.description?.trim().replace(/\s+/g, ' ').slice(0, 240) || 'لا يوجد وصف';
            const examCount = course.exams?.reduce((sum, exam) => sum + (exam.questions?.length || 0), 0) || 0;

            catalogText += [
                `- معرف الكورس: ${course._id}`,
                `عنوان: ${course.title}`,
                `التصنيف: ${course.category?.name || 'أخرى'}`,
                `المستوى: ${course.level}`,
                `السعر: ${priceText}`,
                `التقييم: ${ratingText}`,
                `عدد المسجلين: ${course.enrolledCount || 0}`,
                `المعلم: ${teacherName}${teacherBio ? ` — نبذة مختصرة: ${teacherBio.slice(0, 160)}` : ''}`,
                `المحتوى: ${course.videos?.length || 0} فيديو، ${course.pdfs?.length || 0} ملف PDF، ${examCount} سؤال اختبار`,
                `الوصف: ${description}`,
                `رابط الكورس: /api/courses/${course._id}`
            ].join(' | ') + '\n';
        });
    }

    const categoryText = allCategories.map(category =>
        `${category.name}${category.description ? `: ${category.description}` : ''}`
    ).join(' | ');

    const [orders, cart, wishlist] = accountLists;
    const ownedIds = new Set(orders.flatMap(order => (order.courses || []).map(id => id.toString())));
    const cartIds = new Set((cart?.courses || []).map(id => id.toString()));
    const wishlistIds = new Set((wishlist?.courses || []).map(id => id.toString()));

    const labelCourses = (ids) => availableCourses
        .filter(course => ids.has(course._id.toString()))
        .map(course => course.title)
        .join('، ') || 'لا يوجد';

    const accountContext = req.user
        ? `حالة الطالب المسجل:
- الاسم المتاح للترحيب به: ${req.user.fullName}
- الكورسات المشتراة: ${labelCourses(ownedIds)}
- الكورسات في السلة: ${labelCourses(cartIds)}
- الكورسات في المفضلة: ${labelCourses(wishlistIds)}`
        : 'حالة الطالب: زائر غير مسجل الدخول.';

    const systemPrompt = `أنت "إيدورا الذكي"، المساعد الرسمي لمنصة Edura التعليمية في سوريا.

هدفك:
- فهم حاجة الطالب التعليمية والمستوى والميزانية والهدف قبل الاختيار.
- تقديم توصية دقيقة ومقارنة مفيدة بين الكورسات المتاحة فقط.
- الإجابة باختصار واضح، وطرح سؤال توضيحي واحد فقط عندما تكون البيانات غير كافية.
- الحفاظ على متابعة المحادثة وعدم تكرار الأسئلة التي تمت الإجابة عليها مسبقاً.

قواعد إلزامية:
1. استخدم العربية؛ يمكنك استخدام اللهجة السورية الودية فقط ضمن العربية الطبيعية.
2. لا تخترع أي كورس أو معلّم أو سعر أو خصم أو تقييم أو محتوى أو ميزة غير موجودة في البيانات.
3. إذا غابت المعلومة من الكتالوج، قل بوضوح إنها غير متوفرة ولا تقل إنها متاحة.
4. استخدم السعر والخصم والتقييم والمستوى وعدد المسجلين فقط من البيانات المرفقة.
5. عند التوصية، اذكر سبب الملاءمة لكل خيار واسأل أو اقترح الخطوة التالية.
6. عند الطلب الشفهي، ضع أسماء الكورسات والأسعار بوضوح واقترح عرضها في صفحة الكورس أو إضافتها للسلة.
7. لا تطلب بيانات شخصية أو كلمات سر أو بيانات بطاقات؛ الدفع متاح عبر الرصيد في المحفظة الإلكترونية.
8. لا تُفصح عن أرشيف المشتريات كسر خاص؛ استخدمه فقط لتجنب تكرار التوصية واقتراح تكملة مناسبة.
9. تنسيق الرد: مقدمة قصيرة، فقرة أو قائمة مرقمة، ثم خطوة تالية واضحة. تجنب المبالغة والرموز التعبيرية الكثيرة.
10. إذا كان سؤال الطالب خارج الكورسات والمنصة، أجب بأدب وحدد حدود معرفتك ثم ارجع لتعليم Edura.

طريقة القرار:
- أولاً: حدد الهدف والمستوى والميزانية المذكورة.
- ثانياً: تصفح التصنيفات والكورسات المتاحة وأزل أي كورس لا يناسب المستوى أو الميزانية.
- ثالثاً: رتّب البدائل حسب الملاءمة والتقييم والمنفعة، ولا تعتمد على عدد المسجلين وحده.
- رابعاً: قدّم خيارين أو ثلاثة كحد أقصى مع الاختلافات الجوهرية.

التصنيفات المتاحة:
${categoryText || 'لا توجد تصنيفات مسجلة'}

${accountContext}

${catalogText}

السياسة:
- لا تنفذ الشراء؛ المساعد يقدم توصيات ويوجه المستخدم للسلة والدفع.
- إذا طلب المستخدم كتالوجاً عاماً، اعرض 3 إلى 5 خيارات متنوعة فقط من البيانات أعلاه.
- إذا كان المستخدم يريد كورساً غير موجود، اذكر عدم توفره واقترح أقرب بديل حسب التصنيف والمستوى.`;

    const messages = [
        { role: "system", content: systemPrompt },
        ...req.session.chatHistory,
        { role: "user", content: userMessage }
    ];

    try {
        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 90000);
        const response = await fetch("https://edura-proxy.chat-box.workers.dev/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": `${req.protocol}://${req.get('host')}`,
                "X-Title": "Edura Chatbot"
            },
            body: JSON.stringify({
                model: "openrouter/free",
                messages: messages,
                temperature: 0.45,
                max_tokens: 900
            }),
            signal: abortController.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error("OpenRouter API error:", response.status, errorText);
            return ApiResponse.serverError(res, "عذراً، حدث خطأ في الاتصال، يرجى المحاولة مرة أخرى");
        }

        const data = await response.json();
        const botReply = data.choices?.[0]?.message?.content || "عذراً، لم أستطع فهم ذلك بشكل صحيح، هل يمكنك إعادة صياغة سؤالك؟";

        req.session.chatHistory.push({ role: "user", content: userMessage });
        req.session.chatHistory.push({ role: "assistant", content: botReply });
        req.session.chatHistory = req.session.chatHistory.slice(-12);

        return ApiResponse.ok(res, 'تم توليد الرد بنجاح', { reply: botReply });

    } catch (error) {
        console.error("Chat AI Error:", error);
        return ApiResponse.serverError(res, "عذراً، حدث خطأ، يرجى المحاولة مرة أخرى");
    }
});
