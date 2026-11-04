import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RegistroAuditoria {
  usuarioId?: string | null;
  accion: string;
  entidad?: string;
  entidadId?: string;
  detalle?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
}

/** Bitácora de acciones administrativas (SGSI: trazabilidad / no repudio). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(r: RegistroAuditoria): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        usuarioId: r.usuarioId ?? undefined,
        accion: r.accion,
        entidad: r.entidad,
        entidadId: r.entidadId,
        detalle: r.detalle,
        ip: r.ip,
        userAgent: r.userAgent,
      },
    });
  }
}
