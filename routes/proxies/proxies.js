import express from 'express';
const router = express.Router();

import proxiesController from '../../controllers/proxies.js';

router.route('/').get(proxiesController.GET_PROXIES).post(proxiesController.CREATE_PROXY);
router.route('/bulk').post(proxiesController.CREATE_PROXY_BULK);

router.route('/:id').put(proxiesController.UPDATE_PROXY).delete(proxiesController.DELETE_PROXY);

export default router;
