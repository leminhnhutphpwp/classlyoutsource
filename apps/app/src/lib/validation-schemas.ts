import { z } from 'zod';

// Common validation schemas
export const emailSchema = z.string()
    .min(1, 'Email không được để trống')
    .email('Email không đúng định dạng');

export const passwordSchema = z.string()
    .min(1, 'Mật khẩu không được để trống')
    .min(6, 'Mật khẩu phải có ít nhất 6 ký tự');

export const loginSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    remember: z.boolean().optional(),
});

export const depositAmountSchema = z.number()
    .min(10000, 'Số tiền nạp tối thiểu là 10.000đ')
    .max(1000000000, 'Số tiền nạp tối đa là 1 tỷ đồng'); // Giới hạn hợp lý để tránh overflow/spam

export const depositSchema = z.object({
    amount: depositAmountSchema,
});

export const cancelReasonSchema = z.string()
    .max(500, 'Lý do hủy không được vượt quá 500 ký tự')
    .optional();
