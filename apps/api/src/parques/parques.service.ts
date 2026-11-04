import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateParqueDto, UpdateParqueDto } from './dto/parque.dto';

@Injectable()
export class ParquesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async crear(actorId: string, dto: CreateParqueDto) {
    const parque = await this.prisma.parque.create({
      data: {
        nombre: dto.nombre,
        direccion: dto.direccion,
        timezone: dto.timezone ?? 'America/Mexico_City',
      },
    });
    await this.audit.registrar({
      usuarioId: actorId,
      accion: 'PARQUE_CREADO',
      entidad: 'Parque',
      entidadId: parque.id,
    });
    return parque;
  }

  listar() {
    return this.prisma.parque.findMany({ orderBy: { creadoEn: 'desc' } });
  }

  async obtener(id: string) {
    const parque = await this.prisma.parque.findUnique({ where: { id } });
    if (!parque) throw new NotFoundException('Parque no encontrado');
    return parque;
  }

  async actualizar(actorId: string, id: string, dto: UpdateParqueDto) {
    await this.obtener(id);
    const parque = await this.prisma.parque.update({ where: { id }, data: dto });
    await this.audit.registrar({
      usuarioId: actorId,
      accion: 'PARQUE_ACTUALIZADO',
      entidad: 'Parque',
      entidadId: id,
    });
    return parque;
  }
}
