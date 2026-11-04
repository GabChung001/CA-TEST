import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Bodega, Persona } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertEnAmbito, bodegaEnAmbito, personaWhere } from '../common/scope';
import type { AuthUser } from '../auth/types';
import { CreatePersonaDto, UpdatePersonaDto } from './dto/persona.dto';

@Injectable()
export class PersonasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async crear(actor: AuthUser, dto: CreatePersonaDto) {
    const bodegaId =
      actor.rol === 'ADMIN_BODEGA' ? actor.bodegaId : dto.bodegaId;
    if (!bodegaId) throw new BadRequestException('bodegaId requerido');

    await this.assertBodega(actor, bodegaId);

    const persona = await this.prisma.persona.create({
      data: {
        bodegaId,
        tipo: dto.tipo,
        nombre: dto.nombre,
        apellidos: dto.apellidos,
        documento: dto.documento,
        telefono: dto.telefono,
        email: dto.email,
      },
    });
    await this.audit.registrar({
      usuarioId: actor.sub,
      accion: 'PERSONA_CREADA',
      entidad: 'Persona',
      entidadId: persona.id,
      detalle: { bodegaId, tipo: dto.tipo },
    });
    return persona;
  }

  listar(actor: AuthUser, bodegaId?: string) {
    return this.prisma.persona.findMany({
      where: {
        ...personaWhere(actor),
        ...(bodegaId ? { bodegaId } : {}),
      },
      include: { vehiculos: true, credenciales: true },
      orderBy: { creadoEn: 'desc' },
    });
  }

  async obtener(actor: AuthUser, id: string) {
    const persona = await this.prisma.persona.findFirst({
      where: { id, ...personaWhere(actor) },
      include: { vehiculos: true, credenciales: true, bodega: true },
    });
    if (!persona) throw new NotFoundException('Persona no encontrada');
    return persona;
  }

  async actualizar(actor: AuthUser, id: string, dto: UpdatePersonaDto) {
    await this.obtener(actor, id);
    const persona = await this.prisma.persona.update({
      where: { id },
      data: dto,
    });
    await this.audit.registrar({
      usuarioId: actor.sub,
      accion: 'PERSONA_ACTUALIZADA',
      entidad: 'Persona',
      entidadId: id,
    });
    return persona;
  }

  /** Baja: desactiva la persona y revoca sus credenciales. */
  async baja(actor: AuthUser, id: string) {
    await this.obtener(actor, id);
    await this.prisma.$transaction([
      this.prisma.persona.update({ where: { id }, data: { activo: false } }),
      this.prisma.credencial.updateMany({
        where: { personaId: id, estado: { not: 'REVOCADA' } },
        data: { estado: 'REVOCADA' },
      }),
    ]);
    await this.audit.registrar({
      usuarioId: actor.sub,
      accion: 'PERSONA_BAJA',
      entidad: 'Persona',
      entidadId: id,
    });
    return { ok: true };
  }

  /** Carga una persona validando ámbito; uso interno de otros módulos. */
  async getEnAmbito(
    actor: AuthUser,
    personaId: string,
  ): Promise<Persona & { bodega: Bodega }> {
    const persona = await this.prisma.persona.findUnique({
      where: { id: personaId },
      include: { bodega: true },
    });
    if (!persona) throw new NotFoundException('Persona no encontrada');
    assertEnAmbito(bodegaEnAmbito(actor, persona.bodega));
    return persona;
  }

  private async assertBodega(actor: AuthUser, bodegaId: string): Promise<void> {
    const bodega = await this.prisma.bodega.findUnique({
      where: { id: bodegaId },
    });
    if (!bodega) throw new NotFoundException('Bodega no encontrada');
    assertEnAmbito(bodegaEnAmbito(actor, bodega));
  }
}
