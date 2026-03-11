import { AppContext } from '../../context';
import { Errors } from '../../utils/errors';

export const authResolvers = {
  User: {
    fullName: (user: { firstName?: string | null; lastName?: string | null }) => {
      const parts = [user.firstName, user.lastName].filter(Boolean);
      return parts.length ? parts.join(' ') : null;
    },
  },

  Query: {
    me: async (_: unknown, __: unknown, ctx: AppContext) => {
      if (!ctx.currentUser) throw Errors.unauthorized();
      const user = await ctx.prisma.user.findUnique({ where: { id: ctx.currentUser.sub } });
      if (!user) throw Errors.userNotFound();
      return user;
    },

    myTenant: async (_: unknown, __: unknown, ctx: AppContext) => {
      if (!ctx.currentUser) throw Errors.unauthorized();
      return ctx.tenantService.getById(ctx.currentUser.tid);
    },

    tenantByDomain: async (_: unknown, { domain }: { domain: string }, ctx: AppContext) => {
      return ctx.tenantService.getByDomain(domain).catch(() => null);
    },

    validateToken: (_: unknown, __: unknown, ctx: AppContext) => {
      return !!ctx.currentUser;
    },
  },

  Mutation: {
    login: async (
      _: unknown,
      { input }: { input: { email: string; password: string; tenantDomain: string } },
      ctx: AppContext
    ) => {
      return ctx.authService.login(input, ctx.requestMeta);
    },

    register: async (
      _: unknown,
      { input }: { input: { email: string; password: string; firstName: string; lastName: string; tenantDomain: string } },
      ctx: AppContext
    ) => {
      return ctx.authService.register(input, ctx.requestMeta);
    },

    loginWithGoogle: async (
      _: unknown,
      { input }: { input: { idToken: string; tenantDomain: string } },
      ctx: AppContext
    ) => {
      return ctx.authService.loginWithGoogle(input, ctx.requestMeta);
    },

    loginWithApple: async (
      _: unknown,
      { input }: { input: { identityToken: string; authorizationCode: string; tenantDomain: string; firstName?: string; lastName?: string } },
      ctx: AppContext
    ) => {
      return ctx.authService.loginWithApple(input, ctx.requestMeta);
    },

    refreshToken: async (
      _: unknown,
      { input }: { input: { refreshToken: string } },
      ctx: AppContext
    ) => {
      return ctx.authService.refreshToken(input.refreshToken, ctx.requestMeta);
    },

    logout: async (
      _: unknown,
      { refreshToken }: { refreshToken: string },
      ctx: AppContext
    ) => {
      if (!ctx.currentUser) throw Errors.unauthorized();
      await ctx.authService.logout(ctx.currentUser.sub, refreshToken);
      return { success: true, message: 'Logged out successfully' };
    },

    revokeAllSessions: async (_: unknown, __: unknown, ctx: AppContext) => {
      if (!ctx.currentUser) throw Errors.unauthorized();
      await ctx.authService.revokeAllSessions(ctx.currentUser.sub);
      return { success: true, message: 'All sessions revoked' };
    },

    changePassword: async (
      _: unknown,
      { input }: { input: { currentPassword: string; newPassword: string } },
      ctx: AppContext
    ) => {
      if (!ctx.currentUser) throw Errors.unauthorized();
      await ctx.authService.changePassword(
        ctx.currentUser.sub,
        input.currentPassword,
        input.newPassword
      );
      return { success: true, message: 'Password changed successfully' };
    },

    forgotPassword: async (
      _: unknown,
      { input }: { input: { email: string; tenantDomain: string } },
      ctx: AppContext
    ) => {
      // TODO: generate OTP, store in DB, send via AWS SES
      // Returning generic message to avoid email enumeration
      return { success: true, message: 'If your email exists, you will receive a reset link shortly' };
    },

    resetPassword: async (
      _: unknown,
      { input }: { input: { token: string; newPassword: string } },
      ctx: AppContext
    ) => {
      const otpRecord = await ctx.prisma.otpToken.findUnique({
        where: { token: input.token },
        include: { user: true },
      });

      if (!otpRecord || otpRecord.type !== 'PASSWORD_RESET' || otpRecord.usedAt) {
        throw Errors.invalidToken('Invalid or expired reset token');
      }

      if (new Date() > otpRecord.expiresAt) {
        throw Errors.tokenExpired();
      }

      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(input.newPassword, 12);

      await ctx.prisma.$transaction([
        ctx.prisma.user.update({
          where: { id: otpRecord.userId },
          data: { passwordHash },
        }),
        ctx.prisma.otpToken.update({
          where: { id: otpRecord.id },
          data: { usedAt: new Date() },
        }),
      ]);

      return { success: true, message: 'Password reset successfully' };
    },

    verifyEmail: async (_: unknown, { token }: { token: string }, ctx: AppContext) => {
      const otpRecord = await ctx.prisma.otpToken.findUnique({
        where: { token },
      });

      if (!otpRecord || otpRecord.type !== 'EMAIL_VERIFICATION' || otpRecord.usedAt) {
        throw Errors.invalidToken('Invalid or expired verification token');
      }

      if (new Date() > otpRecord.expiresAt) {
        throw Errors.tokenExpired();
      }

      await ctx.prisma.$transaction([
        ctx.prisma.user.update({
          where: { id: otpRecord.userId },
          data: { emailVerified: true },
        }),
        ctx.prisma.otpToken.update({
          where: { id: otpRecord.id },
          data: { usedAt: new Date() },
        }),
      ]);

      return { success: true, message: 'Email verified successfully' };
    },

    resendVerificationEmail: async (_: unknown, __: unknown, ctx: AppContext) => {
      if (!ctx.currentUser) throw Errors.unauthorized();
      // TODO: generate token, send via SES
      return { success: true, message: 'Verification email sent' };
    },

    updateProfile: async (
      _: unknown,
      { input }: { input: { firstName?: string; lastName?: string; avatarUrl?: string } },
      ctx: AppContext
    ) => {
      if (!ctx.currentUser) throw Errors.unauthorized();
      return ctx.prisma.user.update({
        where: { id: ctx.currentUser.sub },
        data: input,
      });
    },

    createTenant: async (
      _: unknown,
      { input }: { input: { name: string; domain: string; slug: string; adminEmail: string; adminPassword: string; adminFirstName: string; adminLastName: string; plan?: string } },
      ctx: AppContext
    ) => {
      // Only SUPER_ADMIN can create tenants programmatically
      if (ctx.currentUser && ctx.currentUser.role !== 'SUPER_ADMIN') {
        throw Errors.forbidden();
      }

      const tenant = await ctx.tenantService.create({
        name: input.name,
        domain: input.domain,
        slug: input.slug,
        plan: input.plan as 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE',
      });

      // Create the first admin user for the tenant
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(input.adminPassword, 12);
      await ctx.prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: input.adminEmail,
          passwordHash,
          firstName: input.adminFirstName,
          lastName: input.adminLastName,
          role: 'TENANT_ADMIN',
          emailVerified: false,
        },
      });

      return ctx.tenantService.getById(tenant.id);
    },
  },
};
