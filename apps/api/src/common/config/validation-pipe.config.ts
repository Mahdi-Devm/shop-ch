import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';

function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const messages = Object.values(error.constraints ?? {});

    if (messages.length > 0) {
      result[field] = messages;
    }

    if (error.children && error.children.length > 0) {
      Object.assign(result, flattenValidationErrors(error.children, field));
    }
  }

  return result;
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (validationErrors: ValidationError[]) =>
      new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        errors: flattenValidationErrors(validationErrors),
      }),
  });
}
