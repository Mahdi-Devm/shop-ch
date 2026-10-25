import type { LogLevelName } from '@common/config/base-environment';
import { LOG_LEVELS } from '@common/config/base-environment';
import { ConsoleLogger } from '@nestjs/common';

function isLogLevelName(value: string | undefined): value is LogLevelName {
  return LOG_LEVELS.some((level) => level === value);
}

export function createLogger(serviceName: string): ConsoleLogger {
  const configuredLevel = process.env.LOG_LEVEL;
  const minimumLevel = isLogLevelName(configuredLevel)
    ? configuredLevel
    : 'log';
  const enabledLevels = LOG_LEVELS.slice(
    0,
    LOG_LEVELS.indexOf(minimumLevel) + 1,
  );

  return new ConsoleLogger(serviceName, {
    json: true,
    colors: false,
    logLevels: [...enabledLevels],
  });
}
