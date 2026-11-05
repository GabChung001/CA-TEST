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

    // El edge puede referenciar entidades que NO existen en la nube (credenciales
    // creadas localmente, usuarios/puntos de otra controladora, etc.). Para que un
    // movimiento "huérfano" no tumbe todo el lote (FK violation → HTTP 500), se
    // validan las llaves foráneas y las que falten se dejan en null. El dato legible
    // (nombre, bodega, placas) ya viaja en el `snapshot`, así que no se pierde.
    const credIds = [
      ...new Set(movs.map((m) => m.credencialId).filter(Boolean) as string[]),
    ];
    const opIds = [
      ...new Set(movs.map((m) => m.operadorId).filter(Boolean) as string[]),
    ];
    const puntoIds = [
      ...new Set(movs.map((m) => m.puntoAccesoId).filter(Boolean) as string[]),
    ];
    const [credsOk, opsOk, puntosOk] = await Promise.all([
      credIds.length
        ? this.prisma.credencial.findMany({
            where: { id: { in: credIds } },
            select: { id: true },
          })
        : Promise.resolve([]),
      opIds.length
        ? this.prisma.usuario.findMany({
            where: { id: { in: opIds } },
            select: { id: true },
          })
        : Promise.resolve([]),
      puntoIds.length
        ? this.prisma.puntoAcceso.findMany({
            where: { id: { in: puntoIds } },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);
    const credSet = new Set(credsOk.map((c) => c.id));
    const opSet = new Set(opsOk.map((o) => o.id));
    const puntoSet = new Set(puntosOk.map((p) => p.id));

    const data: Prisma.MovimientoCreateManyInput[] = movs
      // puntoAccesoId es obligatorio: si no existe en la nube, se omite esa fila.
      .filter((m) => puntoSet.has(m.puntoAccesoId))
      .map((m) => {
      const base: Prisma.MovimientoCreateManyInput = {
        id: m.id,
        puntoAccesoId: m.puntoAccesoId,
        // Los dispositivos son locales de cada caseta; no se referencian en la nube.
        dispositivoId: null,
        credencialId:
          m.credencialId && credSet.has(m.credencialId) ? m.credencialId : null,
        sentido: m.sentido as Prisma.MovimientoCreateManyInput['sentido'],
        resultado: m.resultado as Prisma.MovimientoCreateManyInput['resultado'],
        motivoRechazo:
          (m.motivoRechazo ??
            null) as Prisma.MovimientoCreateManyInput['motivoRechazo'],
        tipoApertura:
          m.tipoApertura as Prisma.MovimientoCreateManyInput['tipoApertura'],
        operadorId:
          m.operadorId && opSet.has(m.operadorId) ? m.operadorId : null,
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
