import { Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { TEST_ENVIRONMENT_FILE } from './test-environment-file';

const environment = JSON.parse(
  readFileSync(TEST_ENVIRONMENT_FILE, 'utf8'),
) as Record<string, string>;

Object.assign(process.env, environment);

Logger.overrideLogger(['error']);
