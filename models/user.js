import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    active: Boolean,
    accounts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: [] }],
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

userSchema.methods.matchPassword = async function (password) {
    return await bcryptjs.compare(password, this.password);
};

export default mongoose.model('User', userSchema);
