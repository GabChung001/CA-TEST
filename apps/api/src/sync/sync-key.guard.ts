import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { loadEnv } from '../config/env';

/** Autentica a un nodo edge contra la nube mediante la llave compartida. */
@Injectable()
export class SyncKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const env = loadEnv();
    if (!env.EDGE_SYNC_KEY) {
      throw new UnauthorizedException('Sincronización no habilitada');
    }
    const key = ctx.switchToHttp().getRequest().headers['x-sync-key'];
    if (typeof key !== 'string') {
      throw new UnauthorizedException('Falta x-sync-key');
    }
    const a = Buffer.from(key);
    const b = Buffer.from(env.EDGE_SYNC_KEY);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Llave de sincronización inválida');
    }
    return true;
  }
}
