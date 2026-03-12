import { Request, Response, NextFunction } from 'express';

/**
 * Extracts tenant domain from request headers or subdomain.
 * Clients should send X-Tenant-Domain header.
 * Alternatively the subdomain is parsed: mycompany.app.com → mycompany
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const headerDomain = req.headers['x-tenant-domain'] as string | undefined;

  if (headerDomain) {
    (req as Request & { tenantDomain: string }).tenantDomain = headerDomain.toLowerCase();
  } else {
    const host = req.hostname;
    const parts = host.split('.');
    // e.g. mycompany.app.com => parts[0] = mycompany
    if (parts.length >= 3) {
      (req as Request & { tenantDomain: string }).tenantDomain = parts[0].toLowerCase();
    }
  }

  next();
}
