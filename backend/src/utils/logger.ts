import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Create logs directory if it doesn't exist
const logDir = process.env.LOG_DIR || 'logs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 安全序列化，处理循环引用
const safeStringify = (obj: any): string => {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
        // 跳过循环引用
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return '[Circular]';
            }
            seen.add(value);
        }
        // 跳过不可序列化的属性
        if (typeof value === 'function') {
            return '[Function]';
        }
        if (value instanceof Error) {
            return {
                name: value.name,
                message: value.message,
                stack: value.stack
            };
        }
        return value;
    });
};

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // Write all logs to console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    let msg = `${timestamp} [${level}]: ${message}`;
                    if (Object.keys(meta).length > 0) {
                        try {
                            msg += ` ${safeStringify(meta)}`;
                        } catch (e) {
                            msg += ` [Serialization Error]`;
                        }
                    }
                    return msg;
                })
            )
        }),

        // Write errors to error.log
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),

        // Write all logs to combined.log
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'exceptions.log')
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'rejections.log')
        })
    ]
});

export default logger;
