import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { upload } from '../config/upload';
import * as sessionController from '../controllers/session.controller';

const router = Router();

/**
 * @route   GET /api/sessions
 * @desc    Get all sessions for current user
 * @access  Private
 */
router.get(
    '/',
    authenticateJWT,
    sessionController.getUserSessions
);

/**
 * @route   POST /api/sessions
 * @desc    Create a new session
 * @access  Private
 */
router.post(
    '/',
    authenticateJWT,
    sessionController.createSession
);

/**
 * @route   POST /api/sessions/from-url
 * @desc    Create session from URL (one-step: session + source)
 * @access  Private
 */
router.post(
    '/from-url',
    authenticateJWT,
    sessionController.createSessionFromUrl
);

/**
 * @route   POST /api/sessions/from-pdf
 * @desc    Create session from PDF (upload + parse + create)
 * @access  Private
 */
router.post(
    '/from-pdf',
    authenticateJWT,
    upload.single('file'),
    sessionController.createSessionFromPDF
);

/**
 * @route   POST /api/sessions/from-text
 * @desc    Create session from text input
 * @access  Private
 */
router.post(
    '/from-text',
    authenticateJWT,
    sessionController.createSessionFromText
);


/**
 * @route   GET /api/sessions/:id
 * @desc    Get session by ID (with sources and messages)
 * @access  Private
 */
router.get(
    '/:id',
    authenticateJWT,
    sessionController.getSessionById
);

/**
 * @route   PATCH /api/sessions/:id
 * @desc    Update session (rename)
 * @access  Private
 */
router.patch(
    '/:id',
    authenticateJWT,
    sessionController.updateSession
);

/**
 * @route   DELETE /api/sessions/:id
 * @desc    Delete session
 * @access  Private
 */
router.delete(
    '/:id',
    authenticateJWT,
    sessionController.deleteSession
);

/**
 * @route   POST /api/sessions/:id/notes
 * @desc    Save a note (mindmap or summary)
 * @access  Private
 */
router.post(
    '/:id/notes',
    authenticateJWT,
    sessionController.saveSessionNote
);

/**
 * @route   DELETE /api/sessions/notes/:noteId
 * @desc    Delete a note
 * @access  Private
 */
router.delete(
    '/notes/:noteId',
    authenticateJWT,
    sessionController.deleteNote
);

export default router;
