import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { loadEnv } from '../config/env';
import type { JwtPayload } from './types';

export interface ParTokens {
  accessToken: string;
  refreshToken: string;
}

interface Meta {
  ip?: string;
  userAgent?: string;
}

/**
 * Emite y rota tokens. El refresh token devuelto es "<sesionId>.<secreto>";
 * en BD sólo se guarda el hash Argon2 del secreto (nunca el token en claro).
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async emitirPar(payload: JwtPayload, meta: Meta): Promise<ParTokens> {
    const env = loadEnv();
    const accessToken = await this.jwt.signAsync(payload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: env.JWT_ACCESS_TTL as JwtSignOptions['expiresIn'],
    });

    const secreto = randomBytes(48).toString('base64url');
    const sesion = await this.prisma.sesion.create({
      data: {
        usuarioId: payload.sub,
        refreshHash: await argonHash(secreto),
        ip: meta.ip,
        userAgent: meta.userAgent,
        expiraEn: new Date(Date.now() + ttlToMs(env.JWT_REFRESH_TTL)),
      },
    });

    return { accessToken, refreshToken: `${sesion.id}.${secreto}` };
  }

  /** Valida el refresh token, revoca la sesión usada y emite un par nuevo (rotación). */
  async rotar(refreshToken: string, meta: Meta): Promise<ParTokens> {
    const { sesionId, secreto } = partir(refreshToken);
    const sesion = await this.prisma.sesion.findUnique({
      where: { id: sesionId },
      include: { usuario: true },
    });

    if (
      !sesion ||
      sesion.revocadaEn ||
      sesion.expiraEn < new Date() ||
      !sesion.usuario.activo
    ) {
      throw new UnauthorizedException('Sesión inválida');
    }

    const ok = await argonVerify(sesion.refreshHash, secreto);
    if (!ok) throw new UnauthorizedException('Sesión inválida');

    await this.prisma.sesion.update({
      where: { id: sesion.id },
      data: { revocadaEn: new Date() },
    });

    return this.emitirPar(
      {
        sub: sesion.usuario.id,
        rol: sesion.usuario.rol,
        parqueId: sesion.usuario.parqueId,
        bodegaId: sesion.usuario.bodegaId,
      },
      meta,
    );
  }

  async revocar(refreshToken: string): Promise<void> {
    const { sesionId } = partir(refreshToken);
    await this.prisma.sesion.updateMany({
      where: { id: sesionId, revocadaEn: null },
      data: { revocadaEn: new Date() },
    });
  }
}

function partir(token: string): { sesionId: string; secreto: string } {
  const i = token.indexOf('.');
  if (i <= 0) throw new UnauthorizedException('Sesión inválida');
  return { sesionId: token.slice(0, i), secreto: token.slice(i + 1) };
}

/** Convierte "15m" / "7d" / "3600s" a milisegundos. */
function ttlToMs(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]]!;
  return n * unit;
}
