import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

interface JwtPayload {
    userId: number;
    email: string;
}

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

export const authenticateJWT = (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('No token provided', 401);
        }

        const token = authHeader.substring(7);
        const secret = process.env.JWT_SECRET;

        if (!secret) {
            throw new Error('JWT_SECRET not configured');
        }

        const decoded = jwt.verify(token, secret) as JwtPayload;
        req.user = decoded;

        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return next(new AppError('Invalid token', 401));
        }
        if (error instanceof jwt.TokenExpiredError) {
            return next(new AppError('Token expired', 401));
        }
        next(error);
    }
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const secret = process.env.JWT_SECRET;

            if (secret) {
                const decoded = jwt.verify(token, secret) as JwtPayload;
                req.user = decoded;
            }
        }

        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
};
