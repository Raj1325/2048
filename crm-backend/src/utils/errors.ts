import { GraphQLError } from 'graphql';

export enum ErrorCode {
  // Auth
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  SOCIAL_AUTH_FAILED = 'SOCIAL_AUTH_FAILED',

  // User
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',

  // Tenant
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  TENANT_SUSPENDED = 'TENANT_SUSPENDED',
  TENANT_DOMAIN_TAKEN = 'TENANT_DOMAIN_TAKEN',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BAD_USER_INPUT = 'BAD_USER_INPUT',

  // Generic
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
}

export class AppError extends GraphQLError {
  constructor(message: string, code: ErrorCode, statusCode = 400) {
    super(message, {
      extensions: { code, statusCode },
    });
  }
}

export const Errors = {
  unauthorized: (msg = 'Not authenticated') =>
    new AppError(msg, ErrorCode.UNAUTHORIZED, 401),

  forbidden: (msg = 'Insufficient permissions') =>
    new AppError(msg, ErrorCode.FORBIDDEN, 403),

  invalidCredentials: () =>
    new AppError('Invalid email or password', ErrorCode.INVALID_CREDENTIALS, 401),

  invalidToken: (msg = 'Invalid or expired token') =>
    new AppError(msg, ErrorCode.INVALID_TOKEN, 401),

  tokenExpired: () =>
    new AppError('Token has expired', ErrorCode.TOKEN_EXPIRED, 401),

  accountDisabled: () =>
    new AppError('Your account has been disabled', ErrorCode.ACCOUNT_DISABLED, 403),

  emailNotVerified: () =>
    new AppError('Please verify your email before logging in', ErrorCode.EMAIL_NOT_VERIFIED, 403),

  socialAuthFailed: (provider: string) =>
    new AppError(`${provider} authentication failed`, ErrorCode.SOCIAL_AUTH_FAILED, 401),

  userNotFound: () =>
    new AppError('User not found', ErrorCode.USER_NOT_FOUND, 404),

  userAlreadyExists: () =>
    new AppError('A user with this email already exists', ErrorCode.USER_ALREADY_EXISTS, 409),

  tenantNotFound: () =>
    new AppError('Organisation not found', ErrorCode.TENANT_NOT_FOUND, 404),

  tenantSuspended: () =>
    new AppError('Your organisation account is suspended', ErrorCode.TENANT_SUSPENDED, 403),

  tenantDomainTaken: () =>
    new AppError('This domain is already taken', ErrorCode.TENANT_DOMAIN_TAKEN, 409),

  validation: (msg: string) =>
    new AppError(msg, ErrorCode.VALIDATION_ERROR, 400),

  internal: (msg = 'An unexpected error occurred') =>
    new AppError(msg, ErrorCode.INTERNAL_ERROR, 500),
};
