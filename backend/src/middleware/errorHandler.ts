import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface CustomError extends Error {
    statusCode?: number;
    isOperational?: boolean;
}

export const errorHandler = (
    err: CustomError,
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Log error
    logger.error({
        message: err.message,
        stack: err.stack,
        statusCode,
        method: req.method,
        path: req.path,
        ip: req.ip
    });

    // Don't leak error details in production
    const response = {
        error: message,
        statusCode,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    };

    res.status(statusCode).json(response);
};

export class AppError extends Error {
    statusCode: number;
    isOperational: boolean;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
