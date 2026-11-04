import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Rol } from '@acceso/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthUser } from '../../auth/types';

/** Verifica el rol en el servidor (el frontend sólo oculta UI). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user || !required.includes(user.rol)) {
      throw new ForbiddenException('No autorizado para esta acción');
    }
    return true;
  }
}
