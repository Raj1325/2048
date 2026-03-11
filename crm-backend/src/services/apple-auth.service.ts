import appleSignin from 'apple-signin-auth';
import { config } from '../config';
import { Errors } from '../utils/errors';
import { logger } from '../utils/logger';

export interface AppleUserInfo {
  appleId: string;
  email: string | null;
  firstName?: string;
  lastName?: string;
}

class AppleAuthService {
  /**
   * Verifies an Apple identity token.
   * Note: Apple only provides name/email on the FIRST login.
   * Subsequent logins return only the appleId (sub).
   */
  async verifyIdentityToken(
    identityToken: string,
    firstName?: string,
    lastName?: string
  ): Promise<AppleUserInfo> {
    try {
      const appleUser = await appleSignin.verifyIdToken(identityToken, {
        audience: config.apple.clientId,
        ignoreExpiration: false,
      });

      if (!appleUser.sub) {
        throw Errors.socialAuthFailed('Apple');
      }

      return {
        appleId: appleUser.sub,
        email: appleUser.email?.toLowerCase() || null,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      };
    } catch (err) {
      if (err instanceof Error) {
        logger.warn('Apple token verification failed', { error: err.message });
        if (err.message.includes('expired')) {
          throw Errors.invalidToken('Apple token has expired');
        }
      }
      throw Errors.socialAuthFailed('Apple');
    }
  }
}

export const appleAuthService = new AppleAuthService();
