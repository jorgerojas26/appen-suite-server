import express from 'express';
const router = express.Router();

import accountsController from '../../controllers/accounts.js';

router.route('/').get(accountsController.GET_ACCOUNTS).post(accountsController.CREATE_ACCOUNT);

router.route('/:id').put(accountsController.UPDATE_ACCOUNT).delete(accountsController.DELETE_ACCOUNT);

export default router;
