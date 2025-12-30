import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';
import logger from './utils/logger';

// Import routes
import authRoutes from './routes/auth.routes';
import chatRoutes from './routes/chat.routes';
import sourceRoutes from './routes/source.routes';
import sessionRoutes from './routes/session.routes';
import settingsRoutes from './routes/settings.routes';
import userRoutes from './routes/user.routes';
import uploadRoutes from './routes/upload.routes';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// ==================== Middleware ====================

// Security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
    origin: (origin, callback) => {
        // 允许的来源
        const allowedOrigins = [
            process.env.FRONTEND_URL || 'http://localhost:5173',
            'http://localhost:3000', // 本地测试
            'http://localhost:8080', // 测试服务器
            'null' // 允许直接打开 HTML 文件（file:// 协议）
        ];

        // 如果没有 origin 或在允许列表中，则允许
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Request logging
app.use(requestLogger);

// ==================== Routes ====================

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/sources', sourceRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/user/settings', settingsRoutes);  // 别名，兼容前端
app.use('/api/user', userRoutes);  // 用户资料和管理
app.use('/api/upload', uploadRoutes);  // MinIO上传

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        timestamp: new Date().toISOString()
    });
});

// ==================== Error Handler ====================
app.use(errorHandler);

// ==================== Server Start ====================
const startServer = async () => {
    try {
        // Initialize MinIO client
        logger.info('Initializing MinIO client...');
        const minioService = await import('./services/minio.service');
        await minioService.initMinioClient();
        logger.info('✅ MinIO client initialized successfully');

        app.listen(PORT, () => {
            logger.info(`🚀 Server running on port ${PORT}`);
            logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`🌐 API Base URL: http://localhost:${PORT}/api`);
            logger.info(`🏥 Health check: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    process.exit(0);
});

startServer();

export default app;