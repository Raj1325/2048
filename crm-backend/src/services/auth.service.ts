import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient, User, AuthProvider } from '@prisma/client';
import { tokenService, TokenPair } from './token.service';
import { cognitoService } from './cognito.service';
import { googleAuthService } from './google-auth.service';
import { appleAuthService } from './apple-auth.service';
import { pubSubService } from './pubsub.service';
import { createTenantService } from './tenant.service';
import { Errors } from '../utils/errors';
import { validate, loginSchema, registerSchema } from '../utils/validators';
import { logger } from '../utils/logger';

const BCRYPT_ROUNDS = 12;

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: User;
  tenant: { id: string; name: string; domain: string; slug: string; plan: string; status: string; settings: unknown; logoUrl: string | null };
}

export interface LoginInput {
  email: string;
  password: string;
  tenantDomain: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantDomain: string;
}

export interface GoogleAuthInput {
  idToken: string;
  tenantDomain: string;
}

export interface AppleAuthInput {
  identityToken: string;
  authorizationCode: string;
  tenantDomain: string;
  firstName?: string;
  lastName?: string;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

class AuthService {
  private readonly tenantService: ReturnType<typeof createTenantService>;

  constructor(private readonly prisma: PrismaClient) {
    this.tenantService = createTenantService(prisma);
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  async login(input: LoginInput, meta: RequestMeta = {}): Promise<AuthResult> {
    const { email, password, tenantDomain } = validate(loginSchema, input);

    const tenant = await this.tenantService.getByDomain(tenantDomain);

    if (!tenant.settings?.allowPasswordLogin) {
      throw Errors.forbidden('Password login is not enabled for this organisation');
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });

    if (!user || !user.passwordHash) {
      throw Errors.invalidCredentials();
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      await this.logAuthEvent('LOGIN_FAILED', null, tenant.id, AuthProvider.LOCAL, meta);
      throw Errors.invalidCredentials();
    }

    if (!user.isActive) throw Errors.accountDisabled();

    return this.createSession(user, tenant, AuthProvider.LOCAL, meta);
  }

  // ─── Register ────────────────────────────────────────────────────────────────

  async register(input: RegisterInput, meta: RequestMeta = {}): Promise<AuthResult> {
    const { email, password, firstName, lastName, tenantDomain } = validate(
      registerSchema,
      input
    );

    const tenant = await this.tenantService.getByDomain(tenantDomain);

    // Check email domain restrictions
    if (tenant.settings?.allowedEmailDomains?.length) {
      const emailDomain = email.split('@')[1];
      if (!tenant.settings.allowedEmailDomains.includes(emailDomain)) {
        throw Errors.forbidden('Email domain is not allowed for this organisation');
      }
    }

    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });

    if (existing) throw Errors.userAlreadyExists();

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user in DB + Cognito in parallel
    const [user] = await Promise.all([
      this.prisma.user.create({
        data: {
          tenantId: tenant.id,
          email,
          passwordHash,
          firstName,
          lastName,
          role: 'MEMBER',
          emailVerified: false,
        },
      }),
    ]);

    // Register in Cognito (non-blocking)
    cognitoService
      .createUser(email, uuidv4(), user.id)
      .then((cognitoId) =>
        this.prisma.user.update({
          where: { id: user.id },
          data: { cognitoId },
        })
      )
      .catch((err) =>
        logger.error('Failed to create Cognito user post-registration', { error: err })
      );

    logger.info('User registered', { userId: user.id, tenantId: tenant.id });
    return this.createSession(user, tenant, AuthProvider.LOCAL, meta);
  }

  // ─── Google Sign-In ──────────────────────────────────────────────────────────

  async loginWithGoogle(input: GoogleAuthInput, meta: RequestMeta = {}): Promise<AuthResult> {
    const tenant = await this.tenantService.getByDomain(input.tenantDomain);

    if (!tenant.settings?.allowGoogleLogin) {
      throw Errors.forbidden('Google login is not enabled for this organisation');
    }

    const googleUser = await googleAuthService.verifyIdToken(input.idToken);

    let user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [{ googleId: googleUser.googleId }, { email: googleUser.email }],
      },
    });

    if (!user) {
      // Auto-register on first Google login
      user = await this.prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: googleUser.email,
          googleId: googleUser.googleId,
          firstName: googleUser.firstName,
          lastName: googleUser.lastName,
          avatarUrl: googleUser.avatarUrl,
          emailVerified: googleUser.emailVerified,
          role: 'MEMBER',
        },
      });
      logger.info('User auto-registered via Google', { userId: user.id });
    } else if (!user.googleId) {
      // Link Google to existing account
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: googleUser.googleId, emailVerified: true },
      });
    }

    if (!user.isActive) throw Errors.accountDisabled();

    return this.createSession(user, tenant, AuthProvider.GOOGLE, meta);
  }

  // ─── Apple Sign-In ───────────────────────────────────────────────────────────

  async loginWithApple(input: AppleAuthInput, meta: RequestMeta = {}): Promise<AuthResult> {
    const tenant = await this.tenantService.getByDomain(input.tenantDomain);

    if (!tenant.settings?.allowAppleLogin) {
      throw Errors.forbidden('Apple login is not enabled for this organisation');
    }

    const appleUser = await appleAuthService.verifyIdentityToken(
      input.identityToken,
      input.firstName,
      input.lastName
    );

    let user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [
          { appleId: appleUser.appleId },
          ...(appleUser.email ? [{ email: appleUser.email }] : []),
        ],
      },
    });

    if (!user) {
      if (!appleUser.email) {
        throw Errors.validation(
          'Email is required for first-time Apple sign-in. Please re-authenticate with Apple.'
        );
      }
      user = await this.prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: appleUser.email,
          appleId: appleUser.appleId,
          firstName: appleUser.firstName,
          lastName: appleUser.lastName,
          emailVerified: true,
          role: 'MEMBER',
        },
      });
      logger.info('User auto-registered via Apple', { userId: user.id });
    } else if (!user.appleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { appleId: appleUser.appleId, emailVerified: true },
      });
    }

    if (!user.isActive) throw Errors.accountDisabled();

    return this.createSession(user, tenant, AuthProvider.APPLE, meta);
  }

  // ─── Refresh Token ───────────────────────────────────────────────────────────

  async refreshToken(refreshToken: string, meta: RequestMeta = {}): Promise<AuthResult> {
    const payload = tokenService.verifyRefreshToken(refreshToken);

    const isValid = await tokenService.validateRefreshToken(payload.sub, refreshToken);
    if (!isValid) throw Errors.invalidToken('Refresh token has been revoked');

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw Errors.unauthorized();

    const tenant = await this.tenantService.getById(payload.tid);

    // Rotate refresh token
    await tokenService.revokeRefreshToken(payload.sub, refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    return this.createSession(user, tenant, AuthProvider.LOCAL, meta);
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  async logout(userId: string, refreshToken: string): Promise<void> {
    await tokenService.revokeRefreshToken(userId, refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, token: refreshToken },
      data: { isRevoked: true, revokedAt: new Date() },
    });
    logger.debug('User logged out', { userId });
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await tokenService.revokeAllUserTokens(userId);
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
    logger.info('All sessions revoked', { userId });
  }

  // ─── Password ────────────────────────────────────────────────────────────────

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw Errors.forbidden('Cannot change password for social accounts');

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw Errors.invalidCredentials();

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
    await this.revokeAllSessions(userId);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async createSession(
    user: User,
    tenant: Awaited<ReturnType<ReturnType<typeof createTenantService>['getByDomain']>>,
    provider: AuthProvider,
    meta: RequestMeta
  ): Promise<AuthResult> {
    const { accessToken, refreshToken, expiresIn } = tokenService.generateTokenPair(
      user.id,
      tenant.id,
      user.email,
      user.role
    );

    // Store refresh token in Redis + DB
    await tokenService.storeRefreshToken(user.id, refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        token: refreshToken,
        expiresAt: tokenService.refreshExpiresAt,
        ipAddress: meta.ipAddress,
        deviceInfo: meta.userAgent,
      },
    });

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    });

    // Emit audit event (non-blocking)
    this.logAuthEvent('LOGIN_SUCCESS', user.id, tenant.id, provider, meta).catch(() => null);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
      user,
      tenant,
    };
  }

  private async logAuthEvent(
    eventType: string,
    userId: string | null,
    tenantId: string,
    provider: AuthProvider,
    meta: RequestMeta
  ): Promise<void> {
    try {
      await this.prisma.authEvent.create({
        data: {
          userId,
          tenantId,
          eventType,
          provider,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });

      await pubSubService.publishAuthEvent({
        eventType,
        userId: userId || undefined,
        tenantId,
        provider,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    } catch (err) {
      logger.warn('Failed to log auth event', { error: (err as Error).message });
    }
  }
}

export function createAuthService(prisma: PrismaClient): AuthService {
  return new AuthService(prisma);
}
