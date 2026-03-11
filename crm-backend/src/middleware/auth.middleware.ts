import { Request, Response, NextFunction } from 'express';
import { tokenService } from '../services/token.service';
import { logger } from '../utils/logger';

/**
 * REST-layer auth middleware (used for non-GraphQL health / webhook endpoints).
 * GraphQL auth is handled in context.ts.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = tokenService.verifyAccessToken(token);
    (req as Request & { user: typeof payload }).user = payload;
    next();
  } catch (err) {
    logger.debug('Auth middleware rejected token', { error: (err as Error).message });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
