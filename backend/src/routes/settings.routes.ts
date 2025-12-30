import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import * as settingsController from '../controllers/settings.controller';

const router = Router();

/**
 * @route   GET /api/settings
 * @desc    Get user settings
 * @access  Private
 */
router.get(
    '/',
    authenticateJWT,
    settingsController.getSettings
);

/**
 * @route   PATCH /api/settings
 * @desc    Update user settings (apiUrl, model)
 * @access  Private
 */
router.patch(
    '/',
    authenticateJWT,
    settingsController.updateSettings
);

/**
 * @route   POST /api/settings
 * @desc    Update user settings (兼容前端)
 * @access  Private
 */
router.post(
    '/',
    authenticateJWT,
    settingsController.updateSettings
);

/**
 * @route   POST /api/settings/api-key
 * @desc    Set DeepSeek API Key (encrypted)
 * @access  Private
 */
router.post(
    '/api-key',
    authenticateJWT,
    settingsController.setApiKey
);

/**
 * @route   DELETE /api/settings/api-key
 * @desc    Delete API Key
 * @access  Private
 */
router.delete(
    '/api-key',
    authenticateJWT,
    settingsController.deleteApiKey
);

export default router;
