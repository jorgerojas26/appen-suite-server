import express from 'express';
const router = express.Router();

import authController from '../../controllers/auth.js';

router.route('/login').post(authController.login);

router.route('/register').post(authController.register);

export default router;
