import express from 'express';
const router = express.Router();

import favoritesController from '../../controllers/favorites.js';

router.route('/').get(favoritesController.GET_FAVORITES).post(favoritesController.CREATE_FAVORITE);

router
    .route('/:id')
    // .put(favoritesController.UPDATE_FAVORITE)
    .delete(favoritesController.DELETE_FAVORITE);

router.route('/:account_id/:favorite_id').post(favoritesController.TOGGLE_ACTIVE);

export default router;
