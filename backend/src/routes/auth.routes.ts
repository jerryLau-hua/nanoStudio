import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimiter';
import { authenticateJWT } from '../middleware/auth';
import { validate, registerSchema, loginSchema } from '../middleware/validator';
import * as authController from '../controllers/auth.controller';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
    '/register',
    authLimiter,
    validate(registerSchema),
    authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
    '/login',
    authLimiter,
    validate(loginSchema),
    authController.login
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
    '/logout',
    authenticateJWT,
    authController.logout
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
    '/refresh',
    authController.refresh
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get(
    '/me',
    authenticateJWT,
    authController.getCurrentUser
);

export default router;

