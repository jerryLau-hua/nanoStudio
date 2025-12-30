import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import * as uploadController from '../controllers/upload.controller';

const router = Router();

/**
 * @route   POST /api/upload/presigned-url
 * @desc    Generate presigned upload URL for MinIO
 * @access  Private
 */
router.post(
    '/presigned-url',
    authenticateJWT,
    uploadController.generatePresignedUrl
);

/**
 * @route   DELETE /api/upload/:objectKey
 * @desc    Delete file from MinIO
 * @access  Private
 */
router.delete(
    '/:objectKey',
    authenticateJWT,
    uploadController.deleteFile
);

export default router;
