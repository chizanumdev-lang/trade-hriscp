import rateLimit from 'express-rate-limit';

/**
 * Global rate limiter — applied to all routes.
 * 100 requests per 15 minutes per IP.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please try again later.',
  },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Auth-endpoint limiter — applied to login/register mutations.
 * 10 attempts per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
  },
  skip: () => process.env.NODE_ENV === 'test',
});
