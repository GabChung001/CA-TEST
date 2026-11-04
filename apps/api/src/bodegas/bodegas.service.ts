import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertEnAmbito, bodegaEnAmbito, bodegaWhere } from '../common/scope';
import type { AuthUser } from '../auth/types';
import { CreateBodegaDto, UpdateBodegaDto } from './dto/bodega.dto';

@Injectable()
export class BodegasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async crear(actor: AuthUser, dto: CreateBodegaDto) {
    // El parque se fija por el ámbito del actor.
    const parqueId =
      actor.rol === 'SUPER_ADMIN' ? dto.parqueId : actor.parqueId;
    if (!parqueId) {
      throw new BadRequestException('parqueId es requerido');
    }
    const parque = await this.prisma.parque.findUnique({ where: { id: parqueId } });
    if (!parque) throw new NotFoundException('Parque no encontrado');

    const bodega = await this.prisma.bodega.create({
      data: { nombre: dto.nombre, nave: dto.nave, parqueId },
    });
    await this.audit.registrar({
      usuarioId: actor.sub,
      accion: 'BODEGA_CREADA',
      entidad: 'Bodega',
      entidadId: bodega.id,
      detalle: { parqueId },
    });
    return bodega;
  }

  listar(actor: AuthUser, parqueId?: string) {
    return this.prisma.bodega.findMany({
      where: { ...bodegaWhere(actor), ...(parqueId ? { parqueId } : {}) },
      orderBy: { creadoEn: 'desc' },
    });
  }

  async obtener(actor: AuthUser, id: string) {
    const bodega = await this.prisma.bodega.findUnique({ where: { id } });
    if (!bodega) throw new NotFoundException('Bodega no encontrada');
    assertEnAmbito(bodegaEnAmbito(actor, bodega));
    return bodega;
  }

  async actualizar(actor: AuthUser, id: string, dto: UpdateBodegaDto) {
    await this.obtener(actor, id);
    const bodega = await this.prisma.bodega.update({ where: { id }, data: dto });
    await this.audit.registrar({
      usuarioId: actor.sub,
      accion: 'BODEGA_ACTUALIZADA',
      entidad: 'Bodega',
      entidadId: id,
    });
    return bodega;
  }
}
