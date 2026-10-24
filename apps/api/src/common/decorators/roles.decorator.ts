import { ROLES_KEY } from '@common/constants/role.contants';
import type { Roles as RolesEnum } from '@common/enums/role-app.enum';
import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: RolesEnum[]) => SetMetadata(ROLES_KEY, roles);
