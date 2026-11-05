import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { loadEnv } from '../config/env';

/**
 * Lado EDGE (caseta). Solo se activa con SYNC_ROLE=edge.
 * Cada ciclo: baja el catálogo de la nube (preservando la presencia local)
 * y sube los movimientos pendientes. Tolerante a cortes de internet.
 */
@Injectable()
export class EdgeSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('EdgeSync');
  private timer?: ReturnType<typeof setInterval>;
  private corriendo = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const env = loadEnv();
    if (env.SYNC_ROLE !== 'edge') return;
    if (!env.CLOUD_URL || !env.EDGE_SYNC_KEY) {
      this.logger.warn('SYNC_ROLE=edge pero falta CLOUD_URL o EDGE_SYNC_KEY; sync inactiva');
      return;
    }
    const ms = env.SYNC_INTERVAL_SEG * 1000;
    this.logger.log(
      `Sincronización edge activa cada ${env.SYNC_INTERVAL_SEG}s contra ${env.CLOUD_URL}`,
    );
    void this.ciclo();
    this.timer = setInterval(() => void this.ciclo(), ms);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async ciclo() {
    if (this.corriendo) return;
    this.corriendo = true;
    try {
      await this.pull();
      await this.push();
    } catch (e) {
      this.logger.warn(`Sync falló (se reintentará): ${(e as Error).message}`);
    } finally {
      this.corriendo = false;
    }
  }

  private headers() {
    return { 'x-sync-key': loadEnv().EDGE_SYNC_KEY as string };
  }

  /** Baja el catálogo de la nube y lo refleja localmente. */
  private async pull() {
    const env = loadEnv();
    const filtro = env.PARQUE_ID ? `?parqueId=${encodeURIComponent(env.PARQUE_ID)}` : '';
    const r = await fetch(`${env.CLOUD_URL}/sync/catalogo${filtro}`, {
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(`pull HTTP ${r.status}`);
    await this.aplicarSnapshot(await r.json());
  }

  /** Sube los movimientos locales aún no sincronizados. */
  private async push() {
    const env = loadEnv();
    const pendientes = await this.prisma.movimiento.findMany({
      where: { sincronizado: false },
      orderBy: { creadoEn: 'asc' },
      take: 500,
    });
    if (!pendientes.length) return;

    const r = await fetch(`${env.CLOUD_URL}/sync/movimientos`, {
      method: 'POST',
      headers: { ...this.headers(), 'content-type': 'application/json' },
      body: JSON.stringify({ movimientos: pendientes }),
    });
    if (!r.ok) throw new Error(`push HTTP ${r.status}`);

    await this.prisma.movimiento.updateMany({
      where: { id: { in: pendientes.map((m) => m.id) } },
      data: { sincronizado: true },
    });
    this.logger.log(`Subidos ${pendientes.length} movimiento(s) a la nube`);
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private async aplicarSnapshot(s: any) {
    for (const p of s.parques ?? []) {
      const d = { nombre: p.nombre, direccion: p.direccion ?? null, timezone: p.timezone, activo: p.activo };
      await this.prisma.parque.upsert({ where: { id: p.id }, create: { id: p.id, ...d }, update: d });
    }
    for (const b of s.bodegas ?? []) {
      const d = { parqueId: b.parqueId, nombre: b.nombre, nave: b.nave ?? null, activo: b.activo };
      await this.prisma.bodega.upsert({ where: { id: b.id }, create: { id: b.id, ...d }, update: d });
    }
    for (const u of s.usuarios ?? []) {
      const d = {
        email: u.email, passwordHash: u.passwordHash, nombre: u.nombre, rol: u.rol,
        activo: u.activo, parqueId: u.parqueId ?? null, bodegaId: u.bodegaId ?? null,
        mfaHabilitado: u.mfaHabilitado, mfaSecret: u.mfaSecret ?? null,
      };
      await this.prisma.usuario.upsert({ where: { id: u.id }, create: { id: u.id, ...d }, update: d });
    }
    for (const p of s.personas ?? []) {
      const d = {
        bodegaId: p.bodegaId, tipo: p.tipo, nombre: p.nombre, apellidos: p.apellidos ?? null,
        documento: p.documento ?? null, telefono: p.telefono ?? null, email: p.email ?? null, activo: p.activo,
      };
      await this.prisma.persona.upsert({ where: { id: p.id }, create: { id: p.id, ...d }, update: d });
    }
    for (const v of s.vehiculos ?? []) {
      const d = { personaId: v.personaId ?? null, placas: v.placas, marca: v.marca ?? null, modelo: v.modelo ?? null, color: v.color ?? null, activo: v.activo };
      await this.prisma.vehiculo.upsert({ where: { id: v.id }, create: { id: v.id, ...d }, update: d });
    }
    for (const pa of s.puntosAcceso ?? []) {
      const d = { parqueId: pa.parqueId, tipo: pa.tipo, nombre: pa.nombre, activo: pa.activo };
      await this.prisma.puntoAcceso.upsert({ where: { id: pa.id }, create: { id: pa.id, ...d }, update: d });
    }
    for (const dev of s.dispositivos ?? []) {
      const d = { puntoAccesoId: dev.puntoAccesoId, nombre: dev.nombre, apiKeyHash: dev.apiKeyHash, estado: dev.estado };
      await this.prisma.dispositivo.upsert({ where: { id: dev.id }, create: { id: dev.id, ...d }, update: d });
    }
    for (const c of s.credenciales ?? []) {
      const vigenciaDesde = new Date(c.vigenciaDesde);
      const vigenciaHasta = c.vigenciaHasta ? new Date(c.vigenciaHasta) : null;
      // OJO: estadoPresencia / ultimaEntradaEn NO se tocan en update (son del edge).
      await this.prisma.credencial.upsert({
        where: { id: c.id },
        create: {
          id: c.id, codigo: c.codigo, tipo: c.tipo, estado: c.estado, estadoPresencia: 'AFUERA',
          vigenciaDesde, vigenciaHasta, personaId: c.personaId, vehiculoId: c.vehiculoId ?? null,
          emisorId: c.emisorId, bloqueoMotivo: c.bloqueoMotivo ?? null,
        },
        update: {
          codigo: c.codigo, tipo: c.tipo, estado: c.estado, vigenciaDesde, vigenciaHasta,
          personaId: c.personaId, vehiculoId: c.vehiculoId ?? null, emisorId: c.emisorId,
          bloqueoMotivo: c.bloqueoMotivo ?? null,
        },
      });
    }
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
