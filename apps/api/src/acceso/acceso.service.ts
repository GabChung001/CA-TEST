import { Injectable, NotFoundException } from '@nestjs/common';
import type { MotivoRechazo, Prisma } from '@prisma/client';
import { QR_PREFIJO, type ResultadoValidacion } from '@acceso/shared';
import { PrismaService } from '../prisma/prisma.service';
import { QrService } from '../qr/qr.service';

interface EntradaValidacion {
  qr: string;
  puntoAccesoId: string;
  operadorId?: string;
  dispositivoId?: string;
}

/**
 * Núcleo del control de acceso: valida una lectura, aplica anti-passback,
 * actualiza la presencia y registra el movimiento (autorizado o rechazado).
 */
@Injectable()
export class AccesoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qr: QrService,
  ) {}

  async validar(p: EntradaValidacion): Promise<ResultadoValidacion> {
    const punto = await this.prisma.puntoAcceso.findUnique({
      where: { id: p.puntoAccesoId },
    });
    if (!punto) throw new NotFoundException('Punto de acceso no encontrado');

    const sentido = punto.tipo.startsWith('ENTRADA') ? 'ENTRADA' : 'SALIDA';
    const esVehicular = punto.tipo.includes('VEHICULAR');

    const rechazar = (
      motivo: MotivoRechazo,
      credencialId?: string,
      snapshot?: Prisma.InputJsonValue,
    ) => this.registrarRechazo(p, punto.id, sentido, motivo, credencialId, snapshot);

    // 1. Firma del QR
    const v = this.qr.verificar(p.qr);
    if (!v.ok || !v.codigo) {
      return rechazar(
        p.qr.startsWith(`${QR_PREFIJO}.`) ? 'FIRMA_INVALIDA' : 'QR_NO_RECONOCIDO',
      );
    }

    // 2. Credencial
    const cred = await this.prisma.credencial.findUnique({
      where: { codigo: v.codigo },
      include: { persona: { include: { bodega: true } }, vehiculo: true },
    });
    if (!cred) return rechazar('QR_NO_RECONOCIDO');

    const snapshot: Prisma.InputJsonValue = {
      nombre: `${cred.persona.nombre} ${cred.persona.apellidos ?? ''}`.trim(),
      tipoPersona: cred.persona.tipo,
      bodega: cred.persona.bodega?.nombre ?? null,
      placas: cred.vehiculo?.placas ?? null,
    };

    // 3. Estado / vigencia / tipo
    if (cred.estado === 'BLOQUEADA') return rechazar('CREDENCIAL_BLOQUEADA', cred.id, snapshot);
    if (cred.estado === 'REVOCADA' || !cred.persona.activo)
      return rechazar('CREDENCIAL_REVOCADA', cred.id, snapshot);

    const now = new Date();
    if (cred.vigenciaDesde > now || (cred.vigenciaHasta && cred.vigenciaHasta < now)) {
      return rechazar('FUERA_DE_VIGENCIA', cred.id, snapshot);
    }

    const tipoOk = esVehicular ? cred.tipo === 'VEHICULAR' : cred.tipo === 'PEATONAL';
    if (!tipoOk) return rechazar('TIPO_INCORRECTO', cred.id, snapshot);

    // 4. Anti-passback (solo en entrada)
    if (sentido === 'ENTRADA' && cred.estadoPresencia === 'ADENTRO') {
      return rechazar('REINGRESO_NO_PERMITIDO', cred.id, snapshot);
    }

    // 5. Autorizado: actualizar presencia + registrar
    await this.prisma.credencial.update({
      where: { id: cred.id },
      data:
        sentido === 'ENTRADA'
          ? { estadoPresencia: 'ADENTRO', ultimaEntradaEn: now }
          : { estadoPresencia: 'AFUERA' },
    });

    const mov = await this.prisma.movimiento.create({
      data: {
        puntoAccesoId: punto.id,
        dispositivoId: p.dispositivoId,
        credencialId: cred.id,
        sentido,
        resultado: 'AUTORIZADO',
        tipoApertura: 'AUTOMATICA',
        operadorId: p.operadorId,
        snapshot,
      },
    });

    return {
      resultado: 'AUTORIZADO',
      sentido,
      abrirBarrera: true,
      persona: {
        nombre: `${cred.persona.nombre} ${cred.persona.apellidos ?? ''}`.trim(),
        tipo: cred.persona.tipo,
        bodega: cred.persona.bodega?.nombre ?? undefined,
        placas: cred.vehiculo?.placas ?? undefined,
      },
      vigenciaHasta: cred.vigenciaHasta ? cred.vigenciaHasta.toISOString() : null,
      movimientoId: mov.id,
    };
  }

  /** Apertura manual por un operador de caseta (queda registrada). */
  async aperturaManual(
    operadorId: string,
    puntoAccesoId: string,
    motivo: string,
  ): Promise<ResultadoValidacion> {
    const punto = await this.prisma.puntoAcceso.findUnique({
      where: { id: puntoAccesoId },
    });
    if (!punto) throw new NotFoundException('Punto de acceso no encontrado');
    const sentido = punto.tipo.startsWith('ENTRADA') ? 'ENTRADA' : 'SALIDA';

    const mov = await this.prisma.movimiento.create({
      data: {
        puntoAccesoId,
        sentido,
        resultado: 'AUTORIZADO',
        tipoApertura: 'MANUAL',
        operadorId,
        motivoManual: motivo,
      },
    });
    return {
      resultado: 'AUTORIZADO',
      sentido,
      abrirBarrera: true,
      movimientoId: mov.id,
    };
  }

  private async registrarRechazo(
    p: EntradaValidacion,
    puntoAccesoId: string,
    sentido: 'ENTRADA' | 'SALIDA',
    motivo: MotivoRechazo,
    credencialId?: string,
    snapshot?: Prisma.InputJsonValue,
  ): Promise<ResultadoValidacion> {
    const mov = await this.prisma.movimiento.create({
      data: {
        puntoAccesoId,
        dispositivoId: p.dispositivoId,
        credencialId,
        sentido,
        resultado: 'RECHAZADO',
        motivoRechazo: motivo,
        operadorId: p.operadorId,
        qrLeido: p.qr.slice(0, 200),
        snapshot,
      },
    });
    return {
      resultado: 'RECHAZADO',
      sentido,
      motivo,
      abrirBarrera: false,
      movimientoId: mov.id,
    };
  }
}
