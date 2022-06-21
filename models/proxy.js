import mongoose from 'mongoose';

const proxySchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['direct', 'http', 'https', 'socks', 'socks4'],
        required: true,
    },
    host: {
        type: String,
        required: true,
    },
    port: {
        type: Number,
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export default mongoose.model('Proxy', proxySchema);
