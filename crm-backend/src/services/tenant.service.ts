import { PrismaClient, Tenant, TenantSettings } from '@prisma/client';
import { cacheService } from './cache.service';
import { Errors } from '../utils/errors';
import { logger } from '../utils/logger';

const TENANT_CACHE_TTL = 300; // 5 minutes

class TenantService {
  constructor(private readonly prisma: PrismaClient) {}

  async getByDomain(domain: string): Promise<Tenant & { settings: TenantSettings | null }> {
    const cacheKey = `crm:tenant:domain:${domain}`;
    const cached = await cacheService.get<Tenant & { settings: TenantSettings | null }>(cacheKey);
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findUnique({
      where: { domain },
      include: { settings: true },
    });

    if (!tenant) throw Errors.tenantNotFound();
    if (tenant.status === 'SUSPENDED') throw Errors.tenantSuspended();

    await cacheService.set(cacheKey, tenant, TENANT_CACHE_TTL);
    return tenant;
  }

  async getById(id: string): Promise<Tenant & { settings: TenantSettings | null }> {
    const cacheKey = `crm:tenant:id:${id}`;
    const cached = await cacheService.get<Tenant & { settings: TenantSettings | null }>(cacheKey);
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { settings: true },
    });

    if (!tenant) throw Errors.tenantNotFound();

    await cacheService.set(cacheKey, tenant, TENANT_CACHE_TTL);
    return tenant;
  }

  async create(data: {
    name: string;
    domain: string;
    slug: string;
    plan?: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  }): Promise<Tenant> {
    const existing = await this.prisma.tenant.findFirst({
      where: { OR: [{ domain: data.domain }, { slug: data.slug }] },
    });

    if (existing) throw Errors.tenantDomainTaken();

    const tenant = await this.prisma.tenant.create({
      data: {
        name: data.name,
        domain: data.domain,
        slug: data.slug,
        plan: data.plan || 'FREE',
        status: 'TRIAL',
        settings: {
          create: {
            allowGoogleLogin: true,
            allowAppleLogin: true,
            allowPasswordLogin: true,
          },
        },
      },
    });

    logger.info('Tenant created', { tenantId: tenant.id, domain: tenant.domain });
    return tenant;
  }

  async invalidateCache(tenantId: string, domain?: string): Promise<void> {
    await cacheService.del(`crm:tenant:id:${tenantId}`);
    if (domain) await cacheService.del(`crm:tenant:domain:${domain}`);
  }
}

export function createTenantService(prisma: PrismaClient): TenantService {
  return new TenantService(prisma);
}
