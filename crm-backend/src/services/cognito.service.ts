import {
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';
import { cognitoClient } from '../config/aws.config';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * CognitoService manages users in AWS Cognito User Pool.
 * Used for centralised user lifecycle management, MFA, and compliance.
 * Our service issues its own JWTs; Cognito is used as the authoritative
 * user store / identity broker.
 */
class CognitoService {
  private readonly userPoolId = config.aws.cognito.userPoolId;

  async createUser(email: string, temporaryPassword: string, userId: string): Promise<string> {
    try {
      const cmd = new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
        TemporaryPassword: temporaryPassword,
        MessageAction: MessageActionType.SUPPRESS, // suppress Cognito welcome email, we send ours
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:crm_user_id', Value: userId },
        ],
      });
      const response = await cognitoClient.send(cmd);
      const cognitoSub = response.User?.Attributes?.find((a) => a.Name === 'sub')?.Value || '';
      logger.debug('Cognito user created', { email, cognitoSub });
      return cognitoSub;
    } catch (err) {
      logger.error('Failed to create Cognito user', { email, error: err });
      throw err;
    }
  }

  async setPermanentPassword(email: string, password: string): Promise<void> {
    const cmd = new AdminSetUserPasswordCommand({
      UserPoolId: this.userPoolId,
      Username: email,
      Password: password,
      Permanent: true,
    });
    await cognitoClient.send(cmd);
  }

  async disableUser(email: string): Promise<void> {
    const cmd = new AdminDisableUserCommand({
      UserPoolId: this.userPoolId,
      Username: email,
    });
    await cognitoClient.send(cmd);
  }

  async enableUser(email: string): Promise<void> {
    const cmd = new AdminEnableUserCommand({
      UserPoolId: this.userPoolId,
      Username: email,
    });
    await cognitoClient.send(cmd);
  }

  async deleteUser(email: string): Promise<void> {
    const cmd = new AdminDeleteUserCommand({
      UserPoolId: this.userPoolId,
      Username: email,
    });
    await cognitoClient.send(cmd);
  }

  async getUser(email: string): Promise<Record<string, string> | null> {
    try {
      const cmd = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
      });
      const response = await cognitoClient.send(cmd);
      const attrs: Record<string, string> = {};
      for (const attr of response.UserAttributes || []) {
        if (attr.Name && attr.Value) attrs[attr.Name] = attr.Value;
      }
      return attrs;
    } catch {
      return null;
    }
  }

  async updateAttributes(email: string, attributes: Record<string, string>): Promise<void> {
    const cmd = new AdminUpdateUserAttributesCommand({
      UserPoolId: this.userPoolId,
      Username: email,
      UserAttributes: Object.entries(attributes).map(([Name, Value]) => ({ Name, Value })),
    });
    await cognitoClient.send(cmd);
  }

  async linkSocialIdentity(
    email: string,
    provider: 'Google' | 'SignInWithApple',
    providerUserId: string
  ): Promise<void> {
    await this.updateAttributes(email, {
      [`custom:${provider.toLowerCase()}_id`]: providerUserId,
    });
    logger.debug('Linked social identity', { email, provider, providerUserId });
  }
}

export const cognitoService = new CognitoService();
