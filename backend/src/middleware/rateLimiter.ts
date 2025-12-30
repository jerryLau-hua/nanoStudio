import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict limiter for authentication routes
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: {
        error: 'Too many authentication attempts, please try again after 15 minutes.'
    },
    skipSuccessfulRequests: true,
});

// AI API limiter (per user)
export const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: {
        error: 'AI API rate limit exceeded. Please wait a moment.'
    },
    keyGenerator: (req: Request) => {
        // Use user ID if authenticated, otherwise IP
        return req.user?.userId.toString() || req.ip || 'unknown';
    }
});
