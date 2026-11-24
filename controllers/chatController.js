const asyncHandler = require('express-async-handler');
const Category = require('../models/Category');
const Course = require('../models/Course');
const ApiResponse = require('../utils/ApiResponse');

// POST /api/chat
exports.createChat = asyncHandler(async (req, res) => {
    const userMessage = req.body.message;

    if (!userMessage) {
        return ApiResponse.badRequest(res, 'يرجى إرسال رسالة');
    }

    if (!req.session.chatHistory) {
        req.session.chatHistory = [];
    }

    if (req.session.chatHistory.length > 10) {
        req.session.chatHistory.shift();
    }

    const [availableCourse, allCategories] = await Promise.all([
        Course.find({ status: 'available' })
            .populate('category')
            .populate('teacher', 'fullName bio profileImage')
            .limit(150),
        Category.find()
    ]);

    let catalogText = "قائمة الكورسات المتوفرة في Edura:\n";

    const coursesGroupedByCat = availableCourse.reduce((acc, p) => {
        const catName = p.category?.name || "أخرى";
        if (!acc[catName]) acc[catName] = [];
        acc[catName].push(p);
        return acc;
    }, {});

    for (const [catName, products] of Object.entries(coursesGroupedByCat)) {
        catalogText += `\n[تصنيف ${catName}]:\n`;
        products.forEach(p => {
            const priceText = p.hasActiveOffer ? `${p.effectivePrice.toLocaleString('ar-SY')} ل.س (بدلاً من ${p.price.toLocaleString('ar-SY')})` : `${p.price.toLocaleString('ar-SY')} ل.س`;
            const teacher = p.teacher ? `المعلم: ${p.teacher.fullName}` : "المعلم غير معروف";
            catalogText += `- ${p.title}: ${p.description.substring(0, 100)}... | السعر: ${priceText} | ${teacher}\n`;
        });
    }

    const info = `
بيانات إضافية:
- طريقة الدفع: الرصيد في "المحفظة الإلكترونية".
`;

    const systemPrompt = `أنت "ايدورا مساعد الذكي"، المساعد الرسمي لمنصة Edura التعليمية. 
مهمتك هي مساعدة الطلاب في اختيار الكورسات والإجابة على استفساراتهم بلباقة، مودة، واحترافية عالية.

قواعد المحادثة:
1. استخدم اللهجة السورية المحببة أو اللغة العربية الفصحى البسيطة والودودة.
2. استخدم الرموز التعبيرية (Emojis) لجعل المحادثة ممتعة.
3. التزم بالأسعار والكورسات المذكورة في الكتالوج أدناه فقط.
4. إذا طلب الطالب الشراء، شجعه وأخبره أنه يمكنه الطلب الشراء من خلال سلة المشتريات في الموقع.
5. إذا سألك عن شيء غير متوفر، اقترح عليه بدائل من الأقسام المتاحة لدينا بذكاء.
6. إذا كان اسم المعلم متوفرًا في الكتالوج، اذكر اسم المعلم بوضوح في الرد.

الكتالوج المتاح:
${catalogText}

${info}

ملاحظة: تاريخ المحادثة الحالية متوفر لديك في الرسائل القادمة لتستطيع متابعة سياق الكلام.`;

    const messages = [
        { role: "system", content: systemPrompt },
        ...req.session.chatHistory,
        { role: "user", content: userMessage }
    ];

    try {
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
                temperature: 0.8,
                max_tokens: 800
            })
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error("OpenRouter API error:", response.status, errorText);
            return ApiResponse.serverError(res, "عذراً، حدث خطأ في الاتصال، يرجى المحاولة مرة أخرى");
        }

        const data = await response.json();
        const botReply = data.choices?.[0]?.message?.content || "عذراً، لم أستطع فهم ذلك بشكل صحيح، هل يمكنك إعادة صياغة سؤالك؟";

        req.session.chatHistory.push({ role: "user", content: userMessage });
        req.session.chatHistory.push({ role: "assistant", content: botReply });

        return ApiResponse.ok(res, 'تم توليد الرد بنجاح', { reply: botReply });

    } catch (error) {
        console.error("Chat AI Error:", error);
        return ApiResponse.serverError(res, "عذراً، حدث خطأ، يرجى المحاولة مرة أخرى");
    }
});
