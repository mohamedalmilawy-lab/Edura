const mongoose = require('mongoose');
const { Schema } = mongoose;

const bannerSchema = new Schema(
    {
        imageUrl: {
            type: String,
            trim: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            default: '',
            trim: true,
            maxlength: 500
        },
        linkType: {
            type: String,
            enum: ['Course', 'Category', 'Non'], // تحديد النوع
            default: 'Non'
        },        
        link: [{
            type: Schema.Types.ObjectId,
            refPath: 'linkType'
        }],
        isActive: {
            type: Boolean,
            default: true
        },
        expiresAt: {
            type: Date,
            default: null
        },
    },
    { timestamps: true }
);

bannerSchema.index({ isActive: 1, createdAt: -1 });
bannerSchema.index({ expiresAt: 1, isActive: 1 });

bannerSchema.pre('validate', function(next) {
    if (this.expiresAt && this.expiresAt.getTime() <= Date.now()) {
        this.isActive = false;
    }
    next();
});

const Banner = mongoose.model('Banner', bannerSchema);

module.exports = Banner;