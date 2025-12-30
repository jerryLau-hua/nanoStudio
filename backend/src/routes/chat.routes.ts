import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';
import * as chatController from '../controllers/chat.controller';

const router = Router();

/**
 * @route   POST /api/chat/completions
 * @desc    Stream chat completions (SSE)
 * @access  Private
 */
router.post(
    '/completions',
    authenticateJWT,
    aiLimiter,
    chatController.streamCompletions
);

/**
 * @route   POST /api/chat/stop
 * @desc    Stop generation
 * @access  Private
 */
router.post(
    '/stop',
    authenticateJWT,
    chatController.stopGeneration
);

/**
 * @route   POST /api/chat/test
 * @desc    Test chat completion (non-streaming)
 * @access  Private
 */
router.post(
    '/test',
    authenticateJWT,
    aiLimiter,
    chatController.testCompletion
);

export default router;
