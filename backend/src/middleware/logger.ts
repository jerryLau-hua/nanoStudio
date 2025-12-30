import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export const requestLogger = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const startTime = Date.now();

    // Log request
    logger.info({
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent')
    });

    // Log response
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info({
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`
        });
    });

    next();
};
