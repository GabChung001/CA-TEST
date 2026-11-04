import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/types';

/** Sentinela que no coincide con ningún id (devuelve 0 filas). */
const NINGUNO = '__ninguno__';

/** Filtro de bodegas visibles según el rol/ámbito del usuario. */
export function bodegaWhere(user: AuthUser): Prisma.BodegaWhereInput {
  switch (user.rol) {
    case 'SUPER_ADMIN':
      return {};
    case 'ADMIN_PARQUE':
      return { parqueId: user.parqueId ?? NINGUNO };
    case 'ADMIN_BODEGA':
      return { id: user.bodegaId ?? NINGUNO };
    default:
      return { id: NINGUNO };
  }
}

/** Filtro de personas visibles según el rol/ámbito del usuario. */
export function personaWhere(user: AuthUser): Prisma.PersonaWhereInput {
  switch (user.rol) {
    case 'SUPER_ADMIN':
      return {};
    case 'ADMIN_PARQUE':
      return { bodega: { parqueId: user.parqueId ?? NINGUNO } };
    case 'ADMIN_BODEGA':
      return { bodegaId: user.bodegaId ?? NINGUNO };
    default:
      return { id: NINGUNO };
  }
}

/** Filtro de usuarios visibles según el rol/ámbito del usuario. */
export function usuarioWhere(user: AuthUser): Prisma.UsuarioWhereInput {
  switch (user.rol) {
    case 'SUPER_ADMIN':
      return {};
    case 'ADMIN_PARQUE':
      return {
        OR: [
          { parqueId: user.parqueId ?? NINGUNO },
          { bodega: { parqueId: user.parqueId ?? NINGUNO } },
        ],
      };
    default:
      return { id: NINGUNO };
  }
}

/** Verifica que el usuario puede operar sobre una bodega concreta. */
export function bodegaEnAmbito(
  user: AuthUser,
  bodega: { id: string; parqueId: string },
): boolean {
  switch (user.rol) {
    case 'SUPER_ADMIN':
      return true;
    case 'ADMIN_PARQUE':
      return bodega.parqueId === user.parqueId;
    case 'ADMIN_BODEGA':
      return bodega.id === user.bodegaId;
    default:
      return false;
  }
}

export function assertEnAmbito(ok: boolean): void {
  if (!ok) throw new ForbiddenException('Fuera de tu ámbito');
}
