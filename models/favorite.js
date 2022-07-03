import mongoose from 'mongoose';

const favorite = new mongoose.Schema({
    name: { type: String, required: true },
    active: { type: Boolean, default: false },
    max_accounts_per_proxy: { type: Number },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

export default mongoose.model('Favorite', favorite);
