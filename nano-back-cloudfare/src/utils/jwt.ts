/**
 * JWT 工具函数
 */

import jwt from 'jsonwebtoken';

export interface TokenPayload {
    userId: number;
    email: string;
}

/**
 * 生成 JWT Access Token
 */
export function generateAccessToken(payload: TokenPayload, secret: string): string {
    return jwt.sign(payload, secret, {
        expiresIn: '7d',
    });
}

/**
 * 生成 JWT Refresh Token
 */
export function generateRefreshToken(payload: TokenPayload, secret: string): string {
    return jwt.sign(payload, secret, {
        expiresIn: '30d',
    });
}

/**
 * 验证 JWT Token
 */
export function verifyToken(token: string, secret: string): TokenPayload {
    try {
        const decoded = jwt.verify(token, secret) as TokenPayload;
        return decoded;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new Error('Token expired');
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw new Error('Invalid token');
        }
        throw error;
    }
}

/**
 * 刷新 Access Token
 */
export function refreshAccessToken(refreshToken: string, secret: string): string {
    try {
        const decoded = verifyToken(refreshToken, secret);
        return generateAccessToken(
            {
                userId: decoded.userId,
                email: decoded.email,
            },
            secret
        );
    } catch (error) {
        throw new Error('Invalid or expired refresh token');
    }
}
