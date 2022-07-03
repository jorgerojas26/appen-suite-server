import Favorite from '../models/favorite.js';
import Account from '../models/account.js';
import Proxy from '../models/proxy.js';

const GET_FAVORITES = async (req, res) => {
    try {
        const favorites = await Favorite.find({ userId: req.auth.user.id });
        res.status(200).json(favorites);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const CREATE_FAVORITE = async (req, res) => {
    const { name, status, max_accounts_per_proxy } = req.body;

    const userId = req.auth.user.id;

    if (!name || !status || !max_accounts_per_proxy) {
        return res.status(400).json({ error: 'Please provide a name, status and max accounts per proxy' });
    }

    try {
        const proxies = await Proxy.find({ userId });
        const accounts = await Account.find({ userId }).populate('favorites');

        const needed_proxies_quantity = accounts.length / max_accounts_per_proxy;

        if (needed_proxies_quantity > proxies.length) {
            return res.status(400).json({
                error: `You have ${proxies.length} registered proxies. You need atleast ${needed_proxies_quantity} to setup this favorite config. Please register more proxies or raise the number of accounts per proxy.`,
            });
        }

        const newFavorite = new Favorite({ name, status, userId, max_accounts_per_proxy });
        await newFavorite.save();

        await Account.updateMany({}, { $push: { favorites: newFavorite._id } });

        if (req.app.locals.accounts_info && req.app.locals.accounts_info[userId] && req.app.locals.accounts_info[userId].accounts) {
            req.app.locals.accounts_info[userId].accounts = accounts.map(account => {
                account.favorites = [...account.favorites, newFavorite];
                return account;
            });
        }

        res.status(201).json(newFavorite);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const UPDATE_FAVORITE = async (req, res) => {
    const { id } = req.params;
    const { name, status, max_accounts_per_proxy } = req.body;

    const userId = req.auth.user.id;

    if (!name || !status || !max_accounts_per_proxy) {
        return res.status(400).json({ error: 'Please provide a name, status and max accounts per proxy' });
    }

    try {
        const favorite = await Favorite.findById(id);

        if (!favorite) return res.status(404).json({ error: 'Favorite not found' });

        const proxies = await Proxy.find({ userId });
        const accounts = await Account.find({ userId }).populate('favorites');

        const needed_proxies_quantity = accounts.length / max_accounts_per_proxy;

        if (needed_proxies_quantity > proxies.length) {
            return res.status(400).json({
                error: `You have ${proxies.length} registered proxies. You need atleast ${needed_proxies_quantity} to setup this favorite config. Please register more proxies or raise the number of accounts per proxy.`,
            });
        }

        favorite.name = name;
        favorite.status = status;
        favorite.max_accounts_per_proxy = max_accounts_per_proxy;

        const updatedFavorite = await favorite.save();

        if (req.app.locals.accounts_info && req.app.locals.accounts_info[userId] && req.app.locals.accounts_info[userId].accounts) {
            req.app.locals.accounts_info[userId].accounts = accounts.map(account => {
                account.favorites = account.favorites.map(favorite => {
                    if (favorite._id.toString() === updatedFavorite._id.toString()) {
                        favorite.name = updatedFavorite.name;
                        favorite.max_accounts_per_proxy = updatedFavorite.max_accounts_per_proxy;
                    }
                    return favorite;
                });

                return account;
            });
        }

        res.status(200).json(updatedFavorite);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const DELETE_FAVORITE = async (req, res) => {
    const { id } = req.params;

    const userId = req.auth.user.id;

    try {
        const favorite = await Favorite.findById(id);

        if (!favorite) return res.status(404).json({ error: 'Favorite not found' });

        await favorite.remove();

        if (req.app.locals.accounts_info && req.app.locals.accounts_info[userId] && req.app.locals.accounts_info[userId].accounts) {
            req.app.locals.accounts_info[userId].accounts = req.app.locals.accounts_info[userId].accounts.map(account => {
                account.favorites = account.favorites.filter(favorite => favorite._id.toString() !== id);
                return account;
            });
        }

        res.status(200).json({ error: 'Favorite deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export default {
    GET_FAVORITES,
    CREATE_FAVORITE,
    UPDATE_FAVORITE,
    DELETE_FAVORITE,
};
