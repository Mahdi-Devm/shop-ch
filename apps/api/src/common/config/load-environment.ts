import { ENV_FILE_PATHS } from '@common/config/env-file-paths';
import { createEnvironmentValidator } from '@common/config/validate-environment';
import type { ClassConstructor } from 'class-transformer';
import { config } from 'dotenv';

export function loadEnvironment<T extends object>(
  environmentClass: ClassConstructor<T>,
): T {
  config({ path: ENV_FILE_PATHS, quiet: true });
  return createEnvironmentValidator(environmentClass)(process.env);
}
