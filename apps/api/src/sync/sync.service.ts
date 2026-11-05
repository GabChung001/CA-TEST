import { Injectable } from '@nestjs/common';
import { Prisma, Rol } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MovimientoWire } from './sync.types';

/**
 * Lado NUBE de la sincronización:
 * - `snapshot`: entrega el catálogo que el edge necesita para validar.
 * - `ingestarMovimientos`: recibe los movimientos del edge (idempotente por id).
 */
@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot(parqueId?: string) {
    // Si la controladora envía su PARQUE_ID, solo se le entrega el catálogo de
    // ese parque (los accesos son por parque/bodega). Sin él, entrega todo.
    const pq = parqueId;
    const [
      parques,
      bodegas,
      usuarios,
      personas,
      vehiculos,
      puntosAcceso,
      dispositivos,
      credenciales,
    ] = await this.prisma.$transaction([
      this.prisma.parque.findMany(pq ? { where: { id: pq } } : undefined),
      this.prisma.bodega.findMany(pq ? { where: { parqueId: pq } } : undefined),
      this.prisma.usuario.findMany(
        pq
          ? {
              where: {
                OR: [
                  { parqueId: pq },
                  { bodega: { parqueId: pq } },
                  { rol: Rol.SUPER_ADMIN },
                ],
              },
            }
          : undefined,
      ),
      this.prisma.persona.findMany(
        pq ? { where: { bodega: { parqueId: pq } } } : undefined,
      ),
      this.prisma.vehiculo.findMany(
        pq ? { where: { persona: { bodega: { parqueId: pq } } } } : undefined,
      ),
      this.prisma.puntoAcceso.findMany(pq ? { where: { parqueId: pq } } : undefined),
      this.prisma.dispositivo.findMany(
        pq ? { where: { puntoAcceso: { parqueId: pq } } } : undefined,
      ),
      this.prisma.credencial.findMany(
        pq ? { where: { persona: { bodega: { parqueId: pq } } } } : undefined,
      ),
    ]);

    return {
      generadoEn: new Date().toISOString(),
      parques,
      bodegas,
      usuarios,
      personas,
      vehiculos,
      puntosAcceso,
      dispositivos,
      credenciales,
    };
  }

  async ingestarMovimientos(movs: MovimientoWire[]) {
    if (!movs?.length) return { recibidos: 0, insertados: 0 };

    const data: Prisma.MovimientoCreateManyInput[] = movs.map((m) => {
      const base: Prisma.MovimientoCreateManyInput = {
        id: m.id,
        puntoAccesoId: m.puntoAccesoId,
        // Los dispositivos son locales de cada caseta; no se referencian en la nube.
        dispositivoId: null,
        credencialId: m.credencialId ?? null,
        sentido: m.sentido as Prisma.MovimientoCreateManyInput['sentido'],
        resultado: m.resultado as Prisma.MovimientoCreateManyInput['resultado'],
        motivoRechazo:
          (m.motivoRechazo ??
            null) as Prisma.MovimientoCreateManyInput['motivoRechazo'],
        tipoApertura:
          m.tipoApertura as Prisma.MovimientoCreateManyInput['tipoApertura'],
        operadorId: m.operadorId ?? null,
        motivoManual: m.motivoManual ?? null,
        qrLeido: m.qrLeido ?? null,
        creadoEn: new Date(m.creadoEn),
        sincronizado: true,
      };
      if (m.snapshot != null) {
        base.snapshot = m.snapshot as Prisma.InputJsonValue;
      }
      return base;
    });

    const res = await this.prisma.movimiento.createMany({
      data,
      skipDuplicates: true,
    });
    return { recibidos: movs.length, insertados: res.count };
  }
}
