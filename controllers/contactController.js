const Contact = require('../models/Contact');
const ApiResponse = require('../utils/ApiResponse');

// POST /api/contact - Save contact message
exports.postContact = async (req, res) => {
  try {
    const name = req.user?.fullName || req.body.name;
    const email = req.user?.email || req.body.email;
    const { subject, message } = req.body;

    if (!name || !email) {
      return ApiResponse.badRequest(res, 'الاسم والبريد الإلكتروني مطلوبان');
    }

    await Contact.create({ name, email, subject, message });

    return ApiResponse.created(res, 'تم إرسال رسالتك بنجاح! سنتواصل معك قريباً');
  } catch (error) {
    console.error('Contact error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء إرسال الرسالة');
  }
};

// Admin: Get all contact messages
exports.getAdminContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.render('pages/admin/contacts', {
      title: 'رسائل التواصل',
      contacts,
      layouts: 'admin'
    });
  } catch (error) {
    console.error('Admin contacts error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحميل الرسائل';
    res.redirect('/admin/dashboard');
  }
};

// Admin: Delete contact message
exports.deleteContact = async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'تم حذف الرسالة بنجاح');
    res.redirect('/admin/contacts');
  } catch (error) {
    console.error('Delete contact error:', error);
    req.session.error_msg = 'حدث خطأ أثناء حذف الرسالة';
    res.redirect('/admin/contacts');
  }
};
