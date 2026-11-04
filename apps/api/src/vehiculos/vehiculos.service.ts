import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PersonasService } from '../personas/personas.service';
import { assertEnAmbito, bodegaEnAmbito } from '../common/scope';
import type { AuthUser } from '../auth/types';
import { CreateVehiculoDto, UpdateVehiculoDto } from './dto/vehiculo.dto';

@Injectable()
export class VehiculosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly personas: PersonasService,
  ) {}

  async crear(actor: AuthUser, dto: CreateVehiculoDto) {
    await this.personas.getEnAmbito(actor, dto.personaId);
    const vehiculo = await this.prisma.vehiculo.create({
      data: {
        personaId: dto.personaId,
        placas: dto.placas.toUpperCase().trim(),
        marca: dto.marca,
        modelo: dto.modelo,
        color: dto.color,
      },
    });
    await this.audit.registrar({
      usuarioId: actor.sub,
      accion: 'VEHICULO_CREADO',
      entidad: 'Vehiculo',
      entidadId: vehiculo.id,
    });
    return vehiculo;
  }

  async listar(actor: AuthUser, personaId: string) {
    await this.personas.getEnAmbito(actor, personaId);
    return this.prisma.vehiculo.findMany({
      where: { personaId },
      orderBy: { creadoEn: 'desc' },
    });
  }

  async actualizar(actor: AuthUser, id: string, dto: UpdateVehiculoDto) {
    await this.getEnAmbito(actor, id);
    const data = {
      ...dto,
      ...(dto.placas ? { placas: dto.placas.toUpperCase().trim() } : {}),
    };
    const vehiculo = await this.prisma.vehiculo.update({ where: { id }, data });
    await this.audit.registrar({
      usuarioId: actor.sub,
      accion: 'VEHICULO_ACTUALIZADO',
      entidad: 'Vehiculo',
      entidadId: id,
    });
    return vehiculo;
  }

  async baja(actor: AuthUser, id: string) {
    await this.getEnAmbito(actor, id);
    await this.prisma.vehiculo.update({
      where: { id },
      data: { activo: false },
    });
    await this.audit.registrar({
      usuarioId: actor.sub,
      accion: 'VEHICULO_BAJA',
      entidad: 'Vehiculo',
      entidadId: id,
    });
    return { ok: true };
  }

  private async getEnAmbito(actor: AuthUser, id: string) {
    const vehiculo = await this.prisma.vehiculo.findUnique({
      where: { id },
      include: { persona: { include: { bodega: true } } },
    });
    if (!vehiculo || !vehiculo.persona) {
      throw new NotFoundException('Vehículo no encontrado');
    }
    assertEnAmbito(bodegaEnAmbito(actor, vehiculo.persona.bodega));
    return vehiculo;
  }
}
