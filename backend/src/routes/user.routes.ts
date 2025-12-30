import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import * as userController from '../controllers/user.controller';

const router = Router();

// 所有用户路由都需要认证
router.use(authenticateJWT);

// 用户资料
router.get('/profile', userController.getUserProfile);
router.patch('/profile', userController.updateUserProfile);

// 签到
router.post('/check-in', userController.checkIn);
router.get('/check-in/stats', userController.getCheckInStats);

export default router;
