import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { cacheService } from './cache.service';
import { Errors } from '../utils/errors';

export interface AccessTokenPayload {
  sub: string;       // userId
  tid: string;       // tenantId
  email: string;
  role: string;
  jti: string;       // JWT ID for blacklisting
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;       // userId
  tid: string;       // tenantId
  jti: string;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Parse duration strings like "15m", "7d" into seconds
function parseDuration(duration: string): number {
  const unit = duration.slice(-1);
  const value = parseInt(duration.slice(0, -1), 10);
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return parseInt(duration, 10);
  }
}

class TokenService {
  private readonly accessExpiresInSeconds: number;
  private readonly refreshExpiresInSeconds: number;

  constructor() {
    this.accessExpiresInSeconds = parseDuration(config.jwt.accessExpiresIn);
    this.refreshExpiresInSeconds = parseDuration(config.jwt.refreshExpiresIn);
  }

  generateTokenPair(
    userId: string,
    tenantId: string,
    email: string,
    role: string
  ): TokenPair {
    const accessJti = uuidv4();
    const refreshJti = uuidv4();

    const accessToken = jwt.sign(
      { sub: userId, tid: tenantId, email, role, jti: accessJti },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'] }
    );

    const refreshToken = jwt.sign(
      { sub: userId, tid: tenantId, jti: refreshJti },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'] }
    );

    return { accessToken, refreshToken, expiresIn: this.accessExpiresInSeconds };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw Errors.tokenExpired();
      }
      throw Errors.invalidToken();
    }
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw Errors.tokenExpired();
      }
      throw Errors.invalidToken();
    }
  }

  async storeRefreshToken(userId: string, token: string): Promise<void> {
    await cacheService.storeRefreshToken(userId, token, this.refreshExpiresInSeconds);
  }

  async validateRefreshToken(userId: string, token: string): Promise<boolean> {
    return cacheService.isRefreshTokenValid(userId, token);
  }

  async revokeRefreshToken(userId: string, token: string): Promise<void> {
    await cacheService.revokeRefreshToken(userId, token);
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await cacheService.revokeAllUserTokens(userId);
  }

  async blacklistAccessToken(jti: string, remainingTtl: number): Promise<void> {
    await cacheService.blacklistAccessToken(jti, remainingTtl);
  }

  async isAccessTokenBlacklisted(jti: string): Promise<boolean> {
    return cacheService.isAccessTokenBlacklisted(jti);
  }

  get refreshExpiresAt(): Date {
    return new Date(Date.now() + this.refreshExpiresInSeconds * 1000);
  }
}

export const tokenService = new TokenService();
