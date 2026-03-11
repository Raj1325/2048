import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const devFormat = combine(colorize(), timestamp(), errors({ stack: true }), simple());

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: config.isDev ? 'debug' : 'info',
  format: config.isProd ? prodFormat : devFormat,
  defaultMeta: { service: 'crm-backend' },
  transports: [new winston.transports.Console()],
});

// In production, add CloudWatch transport lazily to avoid startup errors
// when running locally or in test environments.
if (config.isProd) {
  (async () => {
    try {
      const WinstonCloudWatch = (await import('winston-cloudwatch')).default;
      logger.add(
        new WinstonCloudWatch({
          logGroupName: '/crm/backend',
          logStreamName: `${config.env}-${new Date().toISOString().split('T')[0]}`,
          awsRegion: config.aws.region,
          jsonValueFormatter: (value: unknown) => JSON.stringify(value),
        })
      );
    } catch {
      logger.warn('CloudWatch transport not available');
    }
  })();
}
