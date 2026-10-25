import type { AuthenticatedUser } from '@common/auth/authenticated-user';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
