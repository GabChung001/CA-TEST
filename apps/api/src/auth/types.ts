import type { Rol } from '@acceso/shared';

/** Contenido del JWT de acceso. */
export interface JwtPayload {
  sub: string; // usuarioId
  rol: Rol;
  parqueId: string | null;
  bodegaId: string | null;
}

/** Usuario autenticado disponible en el request. */
export type AuthUser = JwtPayload;
