import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
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

  async snapshot() {
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
      this.prisma.parque.findMany(),
      this.prisma.bodega.findMany(),
      this.prisma.usuario.findMany(),
      this.prisma.persona.findMany(),
      this.prisma.vehiculo.findMany(),
      this.prisma.puntoAcceso.findMany(),
      this.prisma.dispositivo.findMany(),
      this.prisma.credencial.findMany(),
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
        dispositivoId: m.dispositivoId ?? null,
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
