import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/types';
import {
  CreateDispositivoDto,
  CreatePuntoDto,
  UpdatePuntoDto,
} from './dto/punto.dto';

@Injectable()
export class PuntosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private where(actor: AuthUser): Prisma.PuntoAccesoWhereInput {
    if (actor.rol === 'SUPER_ADMIN') return {};
    return { parqueId: actor.parqueId ?? '__ninguno__' };
  }

  async crear(actor: AuthUser, dto: CreatePuntoDto) {
    const parqueId =
      actor.rol === 'SUPER_ADMIN' ? dto.parqueId : actor.parqueId;
    if (!parqueId) throw new BadRequestException('parqueId requerido');
    const parque = await this.prisma.parque.findUnique({ where: { id: parqueId } });
    if (!parque) throw new NotFoundException('Parque no encontrado');

    const punto = await this.prisma.puntoAcceso.create({
      data: { parqueId, tipo: dto.tipo, nombre: dto.nombre },
    });
    await this.audit.registrar({
      usuarioId: actor.sub,
      accion: 'PUNTO_CREADO',
      entidad: 'PuntoAcceso',
      entidadId: punto.id,
    });
    return punto;
  }

  listar(actor: AuthUser) {
    return this.prisma.puntoAcceso.findMany({
      where: this.where(actor),
      include: { dispositivos: { select: { id: true, nombre: true, estado: true, ultimoLatido: true } } },
      orderBy: { creadoEn: 'asc' },
    });
  }

  async actualizar(actor: AuthUser, id: string, dto: UpdatePuntoDto) {
    await this.getEnAmbito(actor, id);
    return this.prisma.puntoAcceso.update({ where: { id }, data: dto });
  }

  async crearDispositivo(actor: AuthUser, puntoId: string, dto: CreateDispositivoDto) {
    await this.getEnAmbito(actor, puntoId);
    const secreto = randomBytes(24).toString('base64url');
    const disp = await this.prisma.dispositivo.create({
      data: {
        puntoAccesoId: puntoId,
        nombre: dto.nombre,
        apiKeyHash: await argonHash(secreto),
      },
    });
    await this.audit.registrar({
      usuarioId: actor.sub,
      accion: 'DISPOSITIVO_CREADO',
      entidad: 'Dispositivo',
      entidadId: disp.id,
    });
    // La apiKey se muestra UNA sola vez.
    return { id: disp.id, nombre: disp.nombre, apiKey: `${disp.id}.${secreto}` };
  }

  async verificarDispositivo(
    apiKey: string,
  ): Promise<{ id: string; puntoAccesoId: string } | null> {
    const i = apiKey.indexOf('.');
    if (i <= 0) return null;
    const id = apiKey.slice(0, i);
    const secreto = apiKey.slice(i + 1);
    const disp = await this.prisma.dispositivo.findUnique({ where: { id } });
    if (!disp || disp.estado === 'FUERA_DE_SERVICIO') return null;
    if (!(await argonVerify(disp.apiKeyHash, secreto))) return null;
    await this.prisma.dispositivo.update({
      where: { id },
      data: { ultimoLatido: new Date(), estado: 'OPERATIVO' },
    });
    return { id: disp.id, puntoAccesoId: disp.puntoAccesoId };
  }

  private async getEnAmbito(actor: AuthUser, id: string) {
    const punto = await this.prisma.puntoAcceso.findUnique({ where: { id } });
    if (!punto) throw new NotFoundException('Punto de acceso no encontrado');
    if (actor.rol !== 'SUPER_ADMIN' && punto.parqueId !== actor.parqueId) {
      throw new ForbiddenException('Fuera de tu ámbito');
    }
    return punto;
  }
}
