import type { ClassConstructor } from 'class-transformer';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

export function createEnvironmentValidator<T extends object>(
  environmentClass: ClassConstructor<T>,
): (rawEnvironment: Record<string, unknown>) => T {
  return (rawEnvironment) => {
    const environment = plainToInstance(environmentClass, rawEnvironment, {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    });
    const errors = validateSync(environment, { skipMissingProperties: false });

    if (errors.length > 0) {
      const invalidVariables = errors.map((error) => error.property).join(', ');
      throw new Error(`Invalid environment variables: ${invalidVariables}`);
    }

    return environment;
  };
}
