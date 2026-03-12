import { pubSubClient } from '../config/gcp.config';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface AuthEventMessage {
  eventType: string;
  userId?: string;
  tenantId?: string;
  provider?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

class PubSubService {
  async publishAuthEvent(event: Omit<AuthEventMessage, 'timestamp'>): Promise<void> {
    const topic = config.gcp.pubsub.topics.authEvents;
    await this.publish(topic, { ...event, timestamp: new Date().toISOString() });
  }

  async publishUserEvent(event: Record<string, unknown>): Promise<void> {
    const topic = config.gcp.pubsub.topics.userEvents;
    await this.publish(topic, { ...event, timestamp: new Date().toISOString() });
  }

  private async publish(topicName: string, data: Record<string, unknown>): Promise<void> {
    if (config.isDev) {
      logger.debug('PubSub event (skipped in dev)', { topicName, data });
      return;
    }

    try {
      const dataBuffer = Buffer.from(JSON.stringify(data));
      const messageId = await pubSubClient.topic(topicName).publishMessage({ data: dataBuffer });
      logger.debug('PubSub message published', { topicName, messageId });
    } catch (err) {
      // Non-fatal: log and continue. Events can be replayed via CloudWatch / BigQuery.
      logger.error('Failed to publish PubSub message', {
        topicName,
        error: (err as Error).message,
      });
    }
  }
}

export const pubSubService = new PubSubService();
