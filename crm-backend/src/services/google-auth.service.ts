import { googleOAuthClient } from '../config/gcp.config';
import { config } from '../config';
import { Errors } from '../utils/errors';
import { logger } from '../utils/logger';

export interface GoogleUserInfo {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  emailVerified: boolean;
}

class GoogleAuthService {
  /**
   * Verifies a Google ID token issued by the Google Sign-In SDK.
   * The token is validated against Google's public keys.
   */
  async verifyIdToken(idToken: string): Promise<GoogleUserInfo> {
    try {
      const ticket = await googleOAuthClient.verifyIdToken({
        idToken,
        audience: config.gcp.google.clientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw Errors.socialAuthFailed('Google');
      }

      if (!payload.email) {
        throw Errors.validation('Google account must have a verified email address');
      }

      return {
        googleId: payload.sub,
        email: payload.email.toLowerCase(),
        firstName: payload.given_name || '',
        lastName: payload.family_name || '',
        avatarUrl: payload.picture,
        emailVerified: payload.email_verified || false,
      };
    } catch (err) {
      if (err instanceof Error && err.message.includes('Token used too late')) {
        throw Errors.invalidToken('Google token has expired');
      }
      logger.warn('Google token verification failed', { error: (err as Error).message });
      throw Errors.socialAuthFailed('Google');
    }
  }
}

export const googleAuthService = new GoogleAuthService();
