import Favorite from '../models/favorite.js';
import Account from '../models/account.js';

const GET_FAVORITES = async (req, res) => {
    try {
        const favorites = await Favorite.find({ userId: req.auth.user.id });
        res.status(200).json(favorites);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const CREATE_FAVORITE = async (req, res) => {
    try {
        const favorite = new Favorite({ name: req.body.name, status: req.body.status, userId: req.auth.user.id });
        const newFavorite = await favorite.save();

        await Account.updateMany({}, { $push: { favorites: newFavorite._id } });
        res.status(201).json(newFavorite);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const UPDATE_FAVORITE = async (req, res) => {
    const { id } = req.params;
    const { name, status } = req.body;

    if (!name || !status) return res.status(400).json({ message: 'Please provide a name and status' });

    try {
        const favorite = await Favorite.findById(id);

        if (!favorite) return res.status(404).json({ message: 'Favorite not found' });

        favorite.name = req.body.name;
        favorite.status = req.body.status;

        const updatedFavorite = await favorite.save();

        res.status(200).json(updatedFavorite);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const DELETE_FAVORITE = async (req, res) => {
    const { id } = req.params;

    try {
        const favorite = await Favorite.findById(id);

        if (!favorite) return res.status(404).json({ message: 'Favorite not found' });

        await favorite.remove();

        res.status(200).json({ message: 'Favorite deleted' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export default {
    GET_FAVORITES,
    CREATE_FAVORITE,
    UPDATE_FAVORITE,
    DELETE_FAVORITE,
};
