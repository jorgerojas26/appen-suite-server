import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Favorite' }],
    status: {
        type: String,
        required: true,
        default: 'active',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export default mongoose.model('Account', accountSchema);
