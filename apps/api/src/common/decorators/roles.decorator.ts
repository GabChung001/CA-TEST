import { SetMetadata } from '@nestjs/common';
import type { Rol } from '@acceso/shared';

export const ROLES_KEY = 'roles';

/** Restringe una ruta a uno o más roles. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
