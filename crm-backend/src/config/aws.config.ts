import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { SESClient } from '@aws-sdk/client-ses';
import { SNSClient } from '@aws-sdk/client-sns';
import { KMSClient } from '@aws-sdk/client-kms';
import { config } from './index';

const clientConfig = {
  region: config.aws.region,
  ...(config.isDev && {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  }),
};

export const cognitoClient = new CognitoIdentityProviderClient(clientConfig);

export const secretsManagerClient = new SecretsManagerClient({
  ...clientConfig,
  region: config.aws.secretsManager.region,
});

export const sesClient = new SESClient({
  ...clientConfig,
  region: config.aws.ses.region,
});

export const snsClient = new SNSClient(clientConfig);

export const kmsClient = new KMSClient(clientConfig);
