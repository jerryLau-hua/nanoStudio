import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from '../middleware/errorHandler';

// 注册验证 Schema
export const registerSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Email 格式不正确',
            'any.required': 'Email 是必填项'
        }),
    username: Joi.string()
        .min(3)
        .max(30)
        .pattern(/^[a-zA-Z0-9_-]+$/)
        .required()
        .messages({
            'string.min': '用户名至少需要 3 个字符',
            'string.max': '用户名最多 30 个字符',
            'string.pattern.base': '用户名只能包含字母、数字、下划线和连字符',
            'any.required': '用户名是必填项'
        }),
    password: Joi.string()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .required()
        .messages({
            'string.min': '密码至少需要 8 个字符',
            'string.pattern.base': '密码必须包含大小写字母和数字',
            'any.required': '密码是必填项'
        })
});

// 登录验证 Schema
export const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Email 格式不正确',
            'any.required': 'Email 是必填项'
        }),
    password: Joi.string()
        .required()
        .messages({
            'any.required': '密码是必填项'
        })
});

// 验证中间件工厂
export const validate = (schema: Joi.ObjectSchema) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        const { error } = schema.validate(req.body, { abortEarly: false });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return next(new AppError(
                JSON.stringify(errors),
                400
            ));
        }

        next();
    };
};
