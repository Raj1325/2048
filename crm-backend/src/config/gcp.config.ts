import { OAuth2Client } from 'google-auth-library';
import { PubSub } from '@google-cloud/pubsub';
import { config } from './index';

export const googleOAuthClient = new OAuth2Client(
  config.gcp.google.clientId,
  config.gcp.google.clientSecret
);

export const pubSubClient = new PubSub({
  projectId: config.gcp.projectId,
  ...(config.isDev && process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS }
    : {}),
});
