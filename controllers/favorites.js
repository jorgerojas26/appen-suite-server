import Favorite from '../models/favorite.js';
import Account from '../models/account.js';
import Proxy from '../models/proxy.js';

export const get_favorites_with_accounts = async userId => {
    try {
        let favorites = await Favorite.find({ userId });
        const accounts = await Account.find({ userId });

        favorites = favorites.map(favorite => {
            const accs = accounts.map(account => {
                const disabled_favorites = account.disabled_favorites;

                return {
                    ...account.toObject(),
                    favorite_id: favorite._id,
                    favorite_name: favorite.name,
                    favorite_active: !disabled_favorites.includes(favorite._id.toString()),
                };
            });

            return {
                ...favorite.toObject(),
                accounts: accs,
            };
        });

        return favorites;
    } catch (error) {
        throw error;
    }
};

const GET_FAVORITES = async (req, res) => {
    const userId = req.auth.user.id;

    try {
        const favorites = await get_favorites_with_accounts(userId);

        res.status(200).json(favorites);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const CREATE_FAVORITE = async (req, res) => {
    const { name, max_accounts_per_proxy } = req.body;

    const userId = req.auth.user.id;

    if (!name || !max_accounts_per_proxy) {
        return res.status(400).json({ error: 'Please provide a name, status and max accounts per proxy' });
    }

    try {
        /* const proxies = await Proxy.find({ userId });

        const needed_proxies_quantity = accounts.length / max_accounts_per_proxy;

        if (needed_proxies_quantity > proxies.length) {
            return res.status(400).json({
                error: `You have ${proxies.length} registered proxies. You need atleast ${needed_proxies_quantity} to setup this favorite config. Please register more proxies or raise the number of accounts per proxy.`,
            });
        } */

        const newFavorite = new Favorite({ name, userId, max_accounts_per_proxy });

        await newFavorite.save();

        if (req.app.locals.accounts_info && req.app.locals.accounts_info[userId] && req.app.locals.accounts_info[userId].accounts) {
            req.app.locals.accounts_info[userId].accounts = req.app.locals.accounts_info[userId].accounts.map(account => {
                account.favorites = [
                    ...account.favorites,
                    {
                        ...newFavorite.toObject(),
                        active: true,
                    },
                ];
                return account;
            });
        }

        res.status(201).json(newFavorite);
    } catch (error) {
        console.log(error);
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

        // const proxies = await Proxy.find({ userId });
        // const accounts = await Account.find({ userId }).populate('favorites');

        /* const needed_proxies_quantity = accounts.length / max_accounts_per_proxy;

        if (needed_proxies_quantity > proxies.length) {
            return res.status(400).json({
                error: `You have ${proxies.length} registered proxies. You need atleast ${needed_proxies_quantity} to setup this favorite config. Please register more proxies or raise the number of accounts per proxy.`,
            });
        } */

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
        await Favorite.remove({ _id: id });

        if (req.app.locals.accounts_info && req.app.locals.accounts_info[userId] && req.app.locals.accounts_info[userId].accounts) {
            req.app.locals.accounts_info[userId].accounts = req.app.locals.accounts_info[userId].accounts.map(account => {
                account.favorites = account.favorites.filter(favorite => favorite.name.toString() !== id);
                return account;
            });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const TOGGLE_ACTIVE = async (req, res) => {
    const { account_id, favorite_id } = req.params;

    const { active } = req.body;

    const userId = req.auth.user.id;

    console.log('TOGGLE ACTIVE', account_id, favorite_id, active);

    try {
        let accounts = [];
        if (account_id && account_id !== 'undefined' && favorite_id) {
            accounts.push(await Account.findById(account_id));
        } else {
            accounts = await Account.find({});
        }

        for (let account of accounts) {
            if (active) {
                account.disabled_favorites = account.disabled_favorites.filter(id => id.toString() !== favorite_id);
            } else {
                account.disabled_favorites = [...account.disabled_favorites, favorite_id];
            }
            await account.save();
        }

        if (req.app.locals.accounts_info && req.app.locals.accounts_info[userId] && req.app.locals.accounts_info[userId].accounts) {
            req.app.locals.accounts_info[userId].accounts = req.app.locals.accounts_info[userId].accounts.map(account => {
                if (account_id && account_id !== 'undefined' && favorite_id) {
                    if (account._id.toString() === account_id) {
                        account.favorites = account.favorites.map(favorite => {
                            if (favorite._id.toString() === favorite_id) {
                                favorite.active = active;
                            }
                            return favorite;
                        });
                    }
                } else {
                    account.favorites = account.favorites.map(favorite => {
                        favorite.active = active;
                        return favorite;
                    });
                }
                return account;
            });
        }

        res.status(200).json({ error: 'Favorite updated' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export default {
    GET_FAVORITES,
    CREATE_FAVORITE,
    // UPDATE_FAVORITE,
    DELETE_FAVORITE,
    TOGGLE_ACTIVE,
};
