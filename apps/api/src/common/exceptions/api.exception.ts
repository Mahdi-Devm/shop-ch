import { HttpException } from '@nestjs/common';

export type ApiErrorBody = { code: string } & Record<string, unknown>;

export class ApiException extends HttpException {
  constructor(
    status: number,
    code: string,
    details: Record<string, unknown> = {},
  ) {
    const body: ApiErrorBody = { code, ...details };
    super(body, status);
  }
}
