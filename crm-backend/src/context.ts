import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { tokenService, AccessTokenPayload } from './services/token.service';
import { createAuthService } from './services/auth.service';
import { createTenantService } from './services/tenant.service';
import { logger } from './utils/logger';

export interface AppContext {
  prisma: PrismaClient;
  authService: ReturnType<typeof createAuthService>;
  tenantService: ReturnType<typeof createTenantService>;
  req: Request;
  res: Response;
  currentUser: AccessTokenPayload | null;
  requestMeta: { ipAddress?: string; userAgent?: string };
}

export function createContext(prisma: PrismaClient) {
  const authService = createAuthService(prisma);
  const tenantService = createTenantService(prisma);

  return async ({ req, res }: { req: Request; res: Response }): Promise<AppContext> => {
    let currentUser: AccessTokenPayload | null = null;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = tokenService.verifyAccessToken(token);

        // Check blacklist (revoked tokens)
        const isBlacklisted = await tokenService.isAccessTokenBlacklisted(payload.jti);
        if (!isBlacklisted) {
          currentUser = payload;
        }
      } catch {
        // Invalid token — continue as unauthenticated
        logger.debug('Invalid access token in request');
      }
    }

    return {
      prisma,
      authService,
      tenantService,
      req,
      res,
      currentUser,
      requestMeta: {
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
          || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      },
    };
  };
}
