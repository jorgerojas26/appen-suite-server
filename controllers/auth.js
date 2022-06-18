import User from '../models/user.js';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';

const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) return res.status(400).json({ msg: 'User not found' });

        const isMatch = await user.matchPassword(password);

        console.log(user, isMatch);

        if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

        const payload = { user: { id: user.id } };

        jwt.sign(payload, process.env.JWT_SECRET, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

const register = async (req, res) => {
    const { email, password } = req.body;

    console.log(req.body);

    try {
        const user = await User.findOne({ email });

        if (user) return res.status(400).json({ msg: 'User already exists' });

        const hashedPassword = await bcryptjs.hash(password, 10);

        const newUser = new User({ email, password: hashedPassword });

        await newUser.save();

        const payload = { user: { id: newUser.id } };

        jwt.sign(payload, process.env.JWT_SECRET, (err, token) => {
            if (err) throw err;

            res.json({ token });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

export default {
    login,
    register,
};
