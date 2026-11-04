import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Rol } from '@prisma/client';
import { hash as argonHash } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertEnAmbito, bodegaEnAmbito, usuarioWhere } from '../common/scope';
import type { AuthUser } from '../auth/types';
import {
  CreateUsuarioDto,
  ResetPasswordDto,
  UpdateUsuarioDto,
} from './dto/usuario.dto';

const SELECT = {
  id: true,
  email: true,
  nombre: true,
  rol: true,
  activo: true,
  parqueId: true,
  bodegaId: true,
  mfaHabilitado: true,
  ultimoAcceso: true,
  creadoEn: true,
} as const;

/** Qué roles puede CREAR cada rol. */
const PUEDE_CREAR: Record<Rol, Rol[]> = {
  SUPER_ADMIN: [Rol.SUPER_ADMIN, Rol.ADMIN_PARQUE, Rol.ADMIN_BODEGA, Rol.VIGILANCIA],
  ADMIN_PARQUE: [Rol.ADMIN_BODEGA, Rol.VIGILANCIA],
  ADMIN_BODEGA: [],
  VIGILANCIA: [],
};

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async crear(actor: AuthUser, dto: CreateUsuarioDto) {
    if (!PUEDE_CREAR[actor.rol].includes(dto.rol)) {
      throw new ForbiddenException('No puedes crear usuarios con ese rol');
    }

    const email = dto.email.toLowerCase();
    if (await this.prisma.usuario.findUnique({ where: { email } })) {
      throw new ConflictException('El correo ya está registrado');
    }

    const { parqueId, bodegaId } = await this.resolverAmbito(actor, dto);

    const usuario = await this.prisma.usuario.create({
      data: {
        email,
        passwordHash: await argonHash(dto.password),
        nombre: dto.nombre,
        rol: dto.rol,
        parqueId,
        bodegaId,
      },
      select: SELECT,
    });

    await this.audit.registrar({
      usuarioId: actor.sub,
      accion: 'USUARIO_CREADO',
      entidad: 'Usuario',
      entidadId: usuario.id,
      detalle: { rol: dto.rol },
    });
    return usuario;
  }

  listar(actor: AuthUser) {
    return this.prisma.usuario.findMany({
      where: usuarioWhere(actor),
      select: SELECT,
      orderBy: { creadoEn: 'desc' },
    });
  }

  async obtener(actor: AuthUser, id: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id, ...usuarioWhere(actor) },
      select: SELECT,
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  async actualizar(actor: AuthUser, id: string, dto: UpdateUsuarioDto) {
    await this.obtener(actor, id);
    const usuario = await this.prisma.usuario.update({
      where: { id },
      data: dto,
      select: SELECT,
    });
    await this.audit.registrar({
      usuarioId: actor.sub,
      accion: 'USUARIO_ACTUALIZADO',
      entidad: 'Usuario',
      entidadId: id,
    });
    return usuario;
  }

  /** Bloquea/desbloquea (activo) y revoca sesiones al bloquear. */
  async bloquear(actor: AuthUser, id: string, bloquear: boolean) {
    const objetivo = await this.obtener(actor, id);
    if (objetivo.id === actor.sub) {
      throw new BadRequestException('No puedes bloquearte a ti mismo');
    }
    await this.prisma.usuario.update({
      where: { id },
      data: { activo: !bloquear },
    });
    if (bloquear) {
      await this.prisma.sesion.updateMany({
        where: { usuarioId: id, revocadaEn: null },
        data: { revocadaEn: new Date() },
      });
    }
    await this.audit.registrar({
      usuarioId: actor.sub,
      accion: bloquear ? 'USUARIO_BLOQUEADO' : 'USUARIO_DESBLOQUEADO',
      entidad: 'Usuario',
      entidadId: id,
    });
    return this.obtener(actor, id);
  }

  async resetPassword(actor: AuthUser, id: string, dto: ResetPasswordDto) {
    await this.obtener(actor, id);
    await this.prisma.usuario.update({
      where: { id },
      data: {
        passwordHash: await argonHash(dto.password),
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
    });
    // Invalida sesiones activas tras cambio de contraseña.
    await this.prisma.sesion.updateMany({
      where: { usuarioId: id, revocadaEn: null },
      data: { revocadaEn: new Date() },
    });
    await this.audit.registrar({
      usuarioId: actor.sub,
      accion: 'USUARIO_PASSWORD_RESET',
      entidad: 'Usuario',
      entidadId: id,
    });
    return { ok: true };
  }

  /** Resuelve y valida parqueId/bodegaId según el rol objetivo y el actor. */
  private async resolverAmbito(
    actor: AuthUser,
    dto: CreateUsuarioDto,
  ): Promise<{ parqueId: string | null; bodegaId: string | null }> {
    switch (dto.rol) {
      case Rol.SUPER_ADMIN:
        return { parqueId: null, bodegaId: null };

      case Rol.ADMIN_PARQUE: {
        if (!dto.parqueId) throw new BadRequestException('parqueId requerido');
        await this.assertParque(dto.parqueId);
        return { parqueId: dto.parqueId, bodegaId: null };
      }

      case Rol.VIGILANCIA: {
        const parqueId =
          actor.rol === 'SUPER_ADMIN' ? dto.parqueId : actor.parqueId;
        if (!parqueId) throw new BadRequestException('parqueId requerido');
        await this.assertParque(parqueId);
        return { parqueId, bodegaId: null };
      }

      case Rol.ADMIN_BODEGA: {
        if (!dto.bodegaId) throw new BadRequestException('bodegaId requerido');
        const bodega = await this.prisma.bodega.findUnique({
          where: { id: dto.bodegaId },
        });
        if (!bodega) throw new NotFoundException('Bodega no encontrada');
        assertEnAmbito(bodegaEnAmbito(actor, bodega));
        return { parqueId: bodega.parqueId, bodegaId: bodega.id };
      }

      default:
        throw new BadRequestException('Rol inválido');
    }
  }

  private async assertParque(parqueId: string): Promise<void> {
    const parque = await this.prisma.parque.findUnique({ where: { id: parqueId } });
    if (!parque) throw new NotFoundException('Parque no encontrado');
  }
}
