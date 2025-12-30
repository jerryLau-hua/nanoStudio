import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { upload } from '../config/upload';
import * as sourceController from '../controllers/source.controller';

const router = Router();

/**
 * @route   POST /api/sources/fetch-web
 * @desc    Fetch web content (preview only, not saved)
 * @access  Private
 */
router.post(
    '/fetch-web',
    authenticateJWT,
    sourceController.fetchWebContent
);

/**
 * @route   POST /api/sources/upload-pdf
 * @desc    Upload and preview PDF content
 * @access  Private
 */
router.post(
    '/upload-pdf',
    authenticateJWT,
    upload.single('file'),
    sourceController.uploadAndPreviewPDF
);

/**
 * @route   GET /api/sources/session/:sessionId
 * @desc    Get all sources for a session
 * @access  Private
 */
router.get(
    '/session/:sessionId',
    authenticateJWT,
    sourceController.getSessionSources
);


/**
 * @route   POST /api/sources
 * @desc    Add a source to session (text/website/pdf)
 * @access  Private
 */
router.post(
    '/',
    authenticateJWT,
    sourceController.addSource
);

/**
 * @route   DELETE /api/sources/:id
 * @desc    Delete a source (including vector data and physical files)
 * @access  Private
 */
router.delete(
    '/:id',
    authenticateJWT,
    sourceController.deleteSource
);

/**
 * @route   GET /api/sources/:id/rag-status
 * @desc    Get RAG processing status for a source
 * @access  Private
 */
router.get(
    '/:id/rag-status',
    authenticateJWT,
    sourceController.getRagStatus
);

export default router;
