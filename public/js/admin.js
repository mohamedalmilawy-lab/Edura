function convertToYouTubeEmbed(url) {
    if (!url) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return `https://www.youtube.com/embed/${match[1]}`;
        }
    }
    return url;
}

// setupVideoPreview removed because we now support multiple videos without inline iframes

$(document).ready(function() {
    // ==========================
    // Sidebar Toggle (Mobile)
    // ==========================
    $('#openSidebar').click(function() {
        $('#adminSidebar, #teacherSidebar').addClass('translate-x-0');
    });

    $('#closeSidebar').click(function() {
        $('#adminSidebar, #teacherSidebar').removeClass('translate-x-0');
    });

    // Close sidebar when clicking outside on mobile
    $(document).click(function(e) {
        if (window.innerWidth < 1024) {
            const sidebar = $('#adminSidebar, #teacherSidebar');
            const openBtn = $('#openSidebar');
            if (!sidebar.is(e.target) && !sidebar.has(e.target).length && !openBtn.is(e.target) && !openBtn.has(e.target).length) {
                sidebar.removeClass('translate-x-0');
            }
        }
    });

    // ==========================
    // Modal System
    // ==========================

    // Open modal
    $('[data-modal]').click(function(e) {
        e.preventDefault();
        const modalId = $(this).data('modal');
        openModal(modalId);
    });

    // Close modal
    $('.modal-overlay').click(function(e) {
        if ($(e.target).hasClass('modal-overlay')) {
            closeModal($(this).attr('id'));
        }
    });

    $('.modal-close').click(function() {
        const modal = $(this).closest('.modal-overlay');
        closeModal(modal.attr('id'));
    });

    function openModal(modalId) {
        $(`#${modalId}`).addClass('active');
        $('body').css('overflow', 'hidden');
    }

    function closeModal(modalId) {
        $(`#${modalId}`).removeClass('active');
        $('body').css('overflow', '');
    }

    // Escape key to close modals
    $(document).keydown(function(e) {
        if (e.key === 'Escape') {
            $('.modal-overlay.active').each(function() {
                closeModal($(this).attr('id'));
            });
        }
    });

    // ==========================
    // Edit Modal Auto-fill
    // ==========================
    $('[data-edit]').click(function() {
        const data = $(this).data('edit');
        const modalId = $(this).data('modal');

        // Fill form fields
        for (const [key, value] of Object.entries(data)) {
            if (key === 'videos') continue;
            if (key === 'imageUrl') {
                const $wrap = $(`#${modalId} .current-image`);
                if (value) {
                    $wrap.find('img').attr('src', value);
                    $wrap.removeClass('hidden');
                } else {
                    $wrap.addClass('hidden');
                }
                continue;
            }
            const $field = $(`#${modalId} [name="${key}"]`);
            const $checkbox = $field.filter('input[type="checkbox"]');
            if ($checkbox.length) {
                $checkbox.prop('checked', !!value);
            } else {
                $field.val(value);
                $field.filter('select').trigger('change');
            }
        }

        // Handle videos separately
        if (data.videos) {
            const container = $(`#${modalId} .video-inputs-wrapper`);
            if (container.length) {
                container.empty();
                if (data.videos.length > 0) {
                    data.videos.forEach((video, index) => {
                        const inputGroup = $(`
                            <div class="video-input-group flex gap-2 mb-2">
                                <input type="text" name="videos[]" value="${video}" class="form-input flex-1" placeholder="https://www.youtube.com/watch?v=...">
                                ${index === 0 ? 
                                    `<button type="button" class="btn-success add-video-btn px-4 rounded"><i class="fas fa-plus"></i></button>` : 
                                    `<button type="button" class="btn-danger remove-video-btn px-4 rounded"><i class="fas fa-trash"></i></button>`
                                }
                            </div>
                        `);
                        container.append(inputGroup);
                    });
                } else {
                    container.append(`
                        <div class="video-input-group flex gap-2 mb-2">
                            <input type="text" name="videos[]" class="form-input flex-1" placeholder="https://www.youtube.com/watch?v=...">
                            <button type="button" class="btn-success add-video-btn px-4 rounded"><i class="fas fa-plus"></i></button>
                        </div>
                    `);
                }
            }
        }

        // Update form action
        const actionUrl = $(this).data('action');
        if (actionUrl) {
            $(`#${modalId} form`).attr('action', actionUrl);
        }
    });

    // ==========================
    // Dynamic Video Inputs
    // ==========================
    $(document).on('click', '.add-video-btn', function(e) {
        e.preventDefault();
        const container = $(this).closest('.video-inputs-wrapper');
        const inputGroup = $(`
            <div class="video-input-group flex gap-2 mb-2">
                <input type="text" name="videos[]" class="form-input flex-1" placeholder="https://www.youtube.com/watch?v=...">
                <button type="button" class="btn-danger remove-video-btn px-4 rounded"><i class="fas fa-trash"></i></button>
            </div>
        `);
        container.append(inputGroup);
    });

    $(document).on('click', '.remove-video-btn', function(e) {
        e.preventDefault();
        $(this).closest('.video-input-group').remove();
    });

    // ==========================
    // Charts (Admin Dashboard)
    // ==========================
    const salesChartCanvas = document.getElementById('salesChart');
    if (salesChartCanvas && typeof Chart !== 'undefined') {
        const categoryData = window.categoryChartData || [];
        const labels = categoryData.map(d => d.name);
        const data = categoryData.map(d => d.totalSold);

        new Chart(salesChartCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'عدد المشتركين',
                    data: data,
                    backgroundColor: 'rgba(30, 58, 95, 0.8)',
                    borderColor: '#1e3a5f',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    // ==========================
    // Order Detail Modal
    // ==========================
    $('[data-order-id]').click(function() {
        const orderId = $(this).data('order-id');
        const modalBody = $('#orderDetailBody');

        modalBody.html('<div class="flex justify-center py-8"><div class="spinner"></div></div>');
        openModal('orderDetailModal');

        $.ajax({
            url: `/admin/orders/${orderId}`,
            method: 'GET',
            success: function(response) {
                if (response.success && response.order) {
                    const order = response.order;
                    const coursesHtml = order.courses.map(c => `
                        <div class="flex items-center gap-3 p-2 bg-gray-50 rounded">
                            <img src="${c.image || '/uploads/default-course.jpg'}" alt="${c.title}" class="w-12 h-12 rounded object-cover">
                            <div>
                                <p class="font-semibold text-sm">${c.title}</p>
                                <p class="text-xs text-gray-500">${c.category ? c.category.name : ''}</p>
                            </div>
                        </div>
                    `).join('');

                    modalBody.html(`
                        <div class="space-y-4">
                            <div class="grid grid-cols-2 gap-4">
                                <div class="bg-gray-50 p-3 rounded">
                                    <p class="text-xs text-gray-500">رقم الطلب</p>
                                    <p class="font-bold">${order.orderNumber}</p>
                                </div>
                                <div class="bg-gray-50 p-3 rounded">
                                    <p class="text-xs text-gray-500">العميل</p>
                                    <p class="font-bold">${order.user ? order.user.fullName : ''}</p>
                                </div>
                                <div class="bg-gray-50 p-3 rounded">
                                    <p class="text-xs text-gray-500">السعر الإجمالي</p>
                                    <p class="font-bold text-accent">${order.totalPrice} ل.س</p>
                                </div>
                                <div class="bg-gray-50 p-3 rounded">
                                    <p class="text-xs text-gray-500">الحالة</p>
                                    <span class="badge ${order.status === 'confirmed' ? 'badge-available' : 'badge-unavailable'}">
                                        ${order.status === 'confirmed' ? 'مؤكد' : 'معلق'}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <h4 class="font-bold mb-2">الكورسات المشتراة:</h4>
                                <div class="space-y-2">${coursesHtml}</div>
                            </div>
                        </div>
                    `);
                } else {
                    modalBody.html('<p class="text-center text-red-500">لم يتم العثور على الطلب</p>');
                }
            },
            error: function() {
                modalBody.html('<p class="text-center text-red-500">حدث خطأ أثناء تحميل بيانات الطلب</p>');
            }
        });
    });

    // ==========================
    // Recharge Wallet (Admin)
    // ==========================
    let rechargeUserId = null;

    $('.recharge-btn').click(function() {
        rechargeUserId = $(this).data('user-id');
        $('#rechargeUserName').text($(this).data('user-name') || '');
        $('#rechargeAmount').val('');
        openModal('rechargeModal');
    });

    $('#rechargeForm').submit(function(e) {
        e.preventDefault();
        const amount = parseFloat($('#rechargeAmount').val());
        if (!amount || amount <= 0) {
            showToast('أدخل مبلغاً صحيحاً', 'error');
            return;
        }

        $.ajax({
            url: `/admin/users/${rechargeUserId}/recharge`,
            method: 'POST',
            data: { amount },
            success: function(response) {
                if (response.success) {
                    showToast(response.message, 'success');
                    closeModal('rechargeModal');
                    if (response.newBalance !== undefined) {
                        $(`.recharge-btn[data-user-id="${rechargeUserId}"]`)
                            .closest('tr')
                            .find('td')
                            .eq(3)
                            .text(`${response.newBalance} ل.س`);
                    }
                } else {
                    showToast(response.message || 'حدث خطأ', 'error');
                }
            },
            error: function(xhr) {
                const msg = xhr.responseJSON && xhr.responseJSON.message
                    ? xhr.responseJSON.message
                    : 'حدث خطأ أثناء الشحن';
                showToast(msg, 'error');
            }
        });
    });

    // ==========================
    // Role Change (Admin)
    // ==========================
    $('.role-select').change(function() {
        const userId = $(this).data('user-id');
        const role = $(this).val();

        $.ajax({
            url: `/admin/users/${userId}/role`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ role }),
            success: function(response) {
                if (response.success) {
                    showToast('تم تحديث الدور بنجاح', 'success');
                } else {
                    showToast(response.message, 'error');
                }
            },
            error: function() {
                showToast('حدث خطأ', 'error');
            }
        });
    });

    // ==========================
    // Toast for Admin Pages
    // ==========================
    function showToast(message, type = 'success') {
        const toastClass = type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : 'toast-info';
        const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';

        const toast = $(`
            <div class="toast ${toastClass}" data-auto-hide="5000">
                <i class="fas ${icon}"></i>
                <span>${message}</span>
                <button class="toast-close"><i class="fas fa-times"></i></button>
            </div>
        `);

        $('#toastContainer').append(toast);

        setTimeout(() => {
            toast.fadeOut(300, function() {
                $(this).remove();
            });
        }, 5000);
    }

    $(document).on('click', '.toast-close', function() {
        $(this).closest('.toast').fadeOut(300, function() {
            $(this).remove();
        });
    });

    // Auto-hide toasts
    $('.toast[data-auto-hide]').each(function() {
        const delay = $(this).data('auto-hide');
        const toast = $(this);
        setTimeout(() => {
            toast.fadeOut(300, function() {
                $(this).remove();
            });
        }, delay);
    });
});
