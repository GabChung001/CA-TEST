import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/types';

const NINGUNO = '__ninguno__';

@Injectable()
export class MovimientosService {
  constructor(private readonly prisma: PrismaService) {}

  private where(actor: AuthUser): Prisma.MovimientoWhereInput {
    switch (actor.rol) {
      case 'SUPER_ADMIN':
        return {};
      case 'ADMIN_PARQUE':
      case 'VIGILANCIA':
        return { puntoAcceso: { parqueId: actor.parqueId ?? NINGUNO } };
      case 'ADMIN_BODEGA':
        return { credencial: { persona: { bodegaId: actor.bodegaId ?? NINGUNO } } };
      default:
        return { id: NINGUNO };
    }
  }

  private credencialWhere(actor: AuthUser): Prisma.CredencialWhereInput {
    const base: Prisma.CredencialWhereInput = { estadoPresencia: 'ADENTRO' };
    switch (actor.rol) {
      case 'SUPER_ADMIN':
        return base;
      case 'ADMIN_BODEGA':
        return { ...base, persona: { bodegaId: actor.bodegaId ?? NINGUNO } };
      default:
        return { ...base, persona: { bodega: { parqueId: actor.parqueId ?? NINGUNO } } };
    }
  }

  listar(actor: AuthUser, limit = 50) {
    return this.prisma.movimiento.findMany({
      where: this.where(actor),
      include: { puntoAcceso: { select: { nombre: true, tipo: true } } },
      orderBy: { creadoEn: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async resumen(actor: AuthUser) {
    const w = this.where(actor);
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    const [accesosHoy, rechazosHoy, dentro] = await Promise.all([
      this.prisma.movimiento.count({ where: { ...w, creadoEn: { gte: inicioDia } } }),
      this.prisma.movimiento.count({
        where: { ...w, resultado: 'RECHAZADO', creadoEn: { gte: inicioDia } },
      }),
      this.prisma.credencial.count({ where: this.credencialWhere(actor) }),
    ]);
    return { accesosHoy, rechazosHoy, dentro };
  }

  /** Lista de personas actualmente DENTRO (presencia = ADENTRO), con su alcance. */
  presentes(actor: AuthUser) {
    return this.prisma.credencial.findMany({
      where: this.credencialWhere(actor),
      select: {
        id: true,
        tipo: true,
        ultimaEntradaEn: true,
        persona: {
          select: {
            nombre: true,
            apellidos: true,
            tipo: true,
            bodega: { select: { nombre: true } },
          },
        },
        vehiculo: { select: { placas: true } },
      },
      orderBy: { ultimaEntradaEn: 'desc' },
    });
  }

  /** Serie diaria de entradas autorizadas para el chart de asistencia. */
  async serie(actor: AuthUser, dias = 7) {
    const n = Math.min(Math.max(dias, 1), 31);
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    desde.setDate(desde.getDate() - (n - 1));

    const movimientos = await this.prisma.movimiento.findMany({
      where: {
        ...this.where(actor),
        resultado: 'AUTORIZADO',
        sentido: 'ENTRADA',
        creadoEn: { gte: desde },
      },
      select: { creadoEn: true },
    });

    const conteo = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      const d = new Date(desde);
      d.setDate(desde.getDate() + i);
      conteo.set(d.toISOString().slice(0, 10), 0);
    }
    for (const m of movimientos) {
      const k = m.creadoEn.toISOString().slice(0, 10);
      conteo.set(k, (conteo.get(k) ?? 0) + 1);
    }
    return Array.from(conteo, ([fecha, entradas]) => ({ fecha, entradas }));
  }
}
