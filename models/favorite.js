import mongoose from 'mongoose';

const favorite = new mongoose.Schema({
    name: { type: String, required: true },
    active: { type: Boolean, default: false },
});

export default mongoose.model('Favorite', favorite);
