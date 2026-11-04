import { Injectable, UnauthorizedException } from '@nestjs/common';
import { verify as argonVerify } from '@node-rs/argon2';
import { authenticator } from 'otplib';
import type { Usuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TokensService, type ParTokens } from './tokens.service';
import type { LoginDto } from './dto/login.dto';

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

export interface Meta {
  ip?: string;
  userAgent?: string;
}

export interface ResultadoLogin extends ParTokens {
  usuario: {
    id: string;
    nombre: string;
    email: string;
    rol: string;
    parqueId: string | null;
    bodegaId: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, meta: Meta): Promise<ResultadoLogin> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Respuesta uniforme para no revelar si el correo existe.
    const credencialesInvalidas = () =>
      new UnauthorizedException('Credenciales inválidas');

    if (!usuario || !usuario.activo) throw credencialesInvalidas();

    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      throw new UnauthorizedException(
        'Cuenta bloqueada temporalmente por intentos fallidos',
      );
    }

    const passwordOk = await argonVerify(usuario.passwordHash, dto.password);
    if (!passwordOk) {
      await this.registrarIntentoFallido(usuario, meta);
      throw credencialesInvalidas();
    }

    // MFA obligatorio si está habilitado.
    if (usuario.mfaHabilitado) {
      if (!dto.totpCode || !usuario.mfaSecret) {
        throw new UnauthorizedException('Se requiere código MFA');
      }
      const mfaOk = authenticator.verify({
        token: dto.totpCode,
        secret: usuario.mfaSecret,
      });
      if (!mfaOk) throw new UnauthorizedException('Código MFA inválido');
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() },
    });

    const par = await this.tokens.emitirPar(
      {
        sub: usuario.id,
        rol: usuario.rol,
        parqueId: usuario.parqueId,
        bodegaId: usuario.bodegaId,
      },
      meta,
    );

    await this.audit.registrar({
      usuarioId: usuario.id,
      accion: 'LOGIN_EXITOSO',
      entidad: 'Usuario',
      entidadId: usuario.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      ...par,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        parqueId: usuario.parqueId,
        bodegaId: usuario.bodegaId,
      },
    };
  }

  async refresh(refreshToken: string, meta: Meta): Promise<ParTokens> {
    return this.tokens.rotar(refreshToken, meta);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await this.tokens.revocar(refreshToken);
  }

  async perfil(usuarioId: string) {
    const u = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        parqueId: true,
        bodegaId: true,
        mfaHabilitado: true,
      },
    });
    if (!u) throw new UnauthorizedException();
    return u;
  }

  private async registrarIntentoFallido(usuario: Usuario, meta: Meta): Promise<void> {
    const intentos = usuario.intentosFallidos + 1;
    const bloquear = intentos >= MAX_INTENTOS;
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        intentosFallidos: bloquear ? 0 : intentos,
        bloqueadoHasta: bloquear
          ? new Date(Date.now() + BLOQUEO_MINUTOS * 60_000)
          : usuario.bloqueadoHasta,
      },
    });
    await this.audit.registrar({
      usuarioId: usuario.id,
      accion: bloquear ? 'CUENTA_BLOQUEADA' : 'LOGIN_FALLIDO',
      entidad: 'Usuario',
      entidadId: usuario.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
}
