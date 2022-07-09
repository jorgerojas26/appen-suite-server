import Account from '../models/account.js';
import User from '../models/user.js';
import Favorite from '../models/favorite.js';

const GET_ACCOUNTS = async (req, res) => {
    try {
        const accounts = await User.findOne({ _id: req.auth.user.id }).populate({ path: 'accounts' }).select('-_id accounts');
        const favorites = await Favorite.find({ userId: req.auth.user.id });

        const acc = accounts.accounts.map(a => {
            const disabled_favorites = a.disabled_favorites;

            return {
                ...a.toObject(),
                favorites: favorites.map(favorite => {
                    if (disabled_favorites.includes(favorite._id.toString())) {
                        favorite.active = false;
                    }

                    return favorite;
                }),
            };
        });

        res.status(200).json(acc);
    } catch (error) {
        res.status(500).json({
            error: error.message,
        });
    }
};

const CREATE_ACCOUNT = async (req, res) => {
    try {
        const { email, password, validate } = req.body;
        const userId = req.auth.user.id;

        if (!email ?? !password) return res.status(400).json({ error: { message: 'Missing required fields' } });

        let account = await Account.findOne({ email });

        if (account) return res.status(400).json({ error: { message: 'Account already exists' } });

        account = new Account({ email, password, userId });

        // if (validate && !(await account.validate_active())) {
        //     return res.status(400).json({ error: { message: 'Account is not active' } });
        // }

        await account.save();

        await User.updateOne({ _id: req.auth.user.id }, { $push: { accounts: account._id } });

        if (req.app.locals.accounts_info && req.app.locals.accounts_info[userId] && req.app.locals.accounts_info[userId].accounts) {
            req.app.locals.accounts_info[userId].accounts = [...req.app.locals.accounts_info[userId].accounts, account];
        }

        res.status(200).json(account);
    } catch (error) {
        res.status(500).json({ error: { message: error.message } });
    }
};

const UPDATE_ACCOUNT = async (req, res) => {
    try {
        const { email, password, status } = req.body;
        const { id } = req.params;

        const userId = req.auth.user.id;

        if (!email || !password) {
            return res.status(400).json({ error: { message: 'Missing required fields' } });
        }

        const account = await Account.findById(id);
        if (!account) {
            return res.status(404).json({ error: { message: 'Account not found' } });
        }

        account.email = email;
        account.password = password;
        account.status = status;

        if (req.app.locals.accounts_info && req.app.locals.accounts_info[userId] && req.app.locals.accounts_info[userId].accounts) {
            req.app.locals.accounts_info[userId].accounts = req.app.locals.accounts_info[userId].accounts.map(a =>
                a._id.toString() === id ? account : a
            );
        }
        await account.save();
        res.status(200).json(account);
    } catch (error) {
        res.status(500).json({ error: { message: error.message } });
    }
};

const DELETE_ACCOUNT = async (req, res) => {
    try {
        const { id } = req.params;

        const userId = req.auth.user.id;

        const account = await Account.findById(id);
        if (!account) {
            return res.status(404).json({ error: { message: 'Account not found' } });
        }

        await account.delete();

        if (req.app.locals.accounts_info && req.app.locals.accounts_info[userId] && req.app.locals.accounts_info[userId].accounts) {
            req.app.locals.accounts_info[userId].accounts = req.app.locals.accounts_info[userId].accounts.filter(
                a => a._id.toString() !== id
            );
        }

        res.status(200).json({ success: true, message: 'Account deleted' });
    } catch (error) {
        res.status(500).json({ error: { message: error.message } });
    }
};

export default {
    GET_ACCOUNTS,
    CREATE_ACCOUNT,
    UPDATE_ACCOUNT,
    DELETE_ACCOUNT,
};
