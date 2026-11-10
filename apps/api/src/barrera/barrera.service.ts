import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { loadEnv } from '../config/env';

type EstadoPuerta = 'ABIERTA' | 'CERRADA' | 'DESCONOCIDA';

export interface ResultadoBarrera {
  accion: 'abierta' | 'esperada' | 'reabierta' | 'negada' | 'sin_barrera';
  esperoCierre: boolean;
  detalle: string;
}

interface PuntoBarrera {
  id: string;
  tipo: string; // ENTRADA_* | SALIDA_*
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const md5 = (s: string) => createHash('md5').update(s).digest('hex');

/**
 * Control de la barrera/pluma con dos backends:
 *  - 'simulado': estado en memoria (pruebas sin hardware).
 *  - 'hikvision': abre un DS-K28xx por ISAPI (auth Digest). El relé conmuta aunque
 *    no haya pluma/sensor; para la lógica de "sigue abierta" se usa un temporizador
 *    interno (pulso) combinado con el estado ISAPI si el equipo lo reporta.
 */
@Injectable()
export class BarreraService {
  private readonly logger = new Logger('Barrera');
  /** Hasta cuándo se considera abierta cada puerta (ms epoch), por el pulso de apertura. */
  private abiertaHasta = new Map<string, number>();

  /** Resuelve el número de puerta del controlador según el tipo de punto. */
  private doorId(p: PuntoBarrera): string {
    const env = loadEnv();
    if (env.BARRERA_MODO === 'hikvision') {
      return p.tipo.startsWith('ENTRADA')
        ? env.BARRERA_DOOR_ENTRADA
        : env.BARRERA_DOOR_SALIDA;
    }
    // En simulado, cada punto es su propia "puerta".
    return p.id;
  }

  /**
   * Concede el acceso accionando la barrera, aplicando la lógica de "sigue abierta":
   * si está cerrada, abre; si sigue abierta de un paso previo, espera el cierre hasta
   * BARRERA_ESPERA_CIERRE_MS y luego reabre (o niega, según política).
   */
  async conceder(p: PuntoBarrera): Promise<ResultadoBarrera> {
    const env = loadEnv();
    if (env.BARRERA_MODO === 'ninguno') {
      return { accion: 'sin_barrera', esperoCierre: false, detalle: 'sin control de barrera' };
    }
    const door = this.doorId(p);

    let estado = await this.estado(door);
    let esperoCierre = false;

    if (estado === 'ABIERTA') {
      const limite = Date.now() + env.BARRERA_ESPERA_CIERRE_MS;
      while (estado === 'ABIERTA' && Date.now() < limite) {
        esperoCierre = true;
        await sleep(400);
        estado = await this.estado(door);
      }
      if (estado === 'ABIERTA') {
        // Siguió abierta tras el timeout.
        if (env.BARRERA_POLITICA_ABIERTA === 'negar') {
          this.logger.warn(`Puerta ${door} seguía abierta; acceso NO reabre (política negar)`);
          return {
            accion: 'negada',
            esperoCierre,
            detalle: 'la pluma seguía abierta (posible obstrucción); no se reabrió',
          };
        }
        await this.abrir(door);
        this.logger.warn(`Puerta ${door} seguía abierta; se REABRE (política reabrir)`);
        return {
          accion: 'reabierta',
          esperoCierre,
          detalle: 'la pluma seguía abierta; se mantuvo/reabrió',
        };
      }
      // Cerró dentro del tiempo → abrir normal.
      await this.abrir(door);
      return { accion: 'esperada', esperoCierre, detalle: 'abierta tras esperar el cierre' };
    }

    await this.abrir(door);
    return { accion: 'abierta', esperoCierre: false, detalle: 'abierta' };
  }

  /** Estado efectivo: ISAPI (si reporta) u "abierta" si aún corre el pulso interno. */
  async estado(door: string): Promise<EstadoPuerta> {
    const env = loadEnv();
    if ((this.abiertaHasta.get(door) ?? 0) > Date.now()) return 'ABIERTA';
    if (env.BARRERA_MODO === 'hikvision') {
      const isapi = await this.estadoHikvision(door);
      if (isapi !== 'DESCONOCIDA') return isapi;
    }
    return 'CERRADA';
  }

  /** Abre (pulso). En hikvision manda el comando ISAPI; siempre marca el pulso interno. */
  async abrir(door: string): Promise<void> {
    const env = loadEnv();
    this.abiertaHasta.set(door, Date.now() + env.BARRERA_PULSO_SEG * 1000);
    if (env.BARRERA_MODO === 'hikvision') {
      try {
        await this.abrirHikvision(door);
        this.logger.log(`[hikvision] Puerta ${door} ABIERTA (ISAPI)`);
      } catch (e) {
        this.logger.error(`[hikvision] No se pudo abrir la puerta ${door}: ${(e as Error).message}`);
      }
    } else {
      // 'simulado' o 'rele': el pulso/estado se lleva por temporizador interno. En
      // 'rele' la apertura física la dispara ~/abrir-pluma.sh desde el lector.
      this.logger.log(`[${env.BARRERA_MODO}] Puerta ${door} ABIERTA por ${env.BARRERA_PULSO_SEG}s`);
    }
  }

  // ───────────────────────── Hikvision ISAPI (auth Digest) ─────────────────────────

  private async abrirHikvision(door: string): Promise<void> {
    const path = `/ISAPI/AccessControl/RemoteControl/door/${encodeURIComponent(door)}`;
    const body = '<RemoteControlDoor><cmd>open</cmd></RemoteControlDoor>';
    const r = await this.isapi('PUT', path, body);
    if (!r.ok) throw new Error(`ISAPI open HTTP ${r.status}`);
  }

  private async estadoHikvision(door: string): Promise<EstadoPuerta> {
    const env = loadEnv();
    if (!env.HIKVISION_STATUS_PATH) return 'DESCONOCIDA';
    try {
      const path = env.HIKVISION_STATUS_PATH.replace('{door}', encodeURIComponent(door));
      const r = await this.isapi('GET', path);
      if (!r.ok) return 'DESCONOCIDA';
      const t = (await r.text()).toLowerCase();
      // Heurística tolerante a distintos firmwares.
      if (/\bopen\b|abierta|"doorstatus"\s*:\s*"?open/.test(t)) return 'ABIERTA';
      if (/\bclose|cerrada|"doorstatus"\s*:\s*"?close/.test(t)) return 'CERRADA';
      return 'DESCONOCIDA';
    } catch {
      return 'DESCONOCIDA';
    }
  }

  /** Petición ISAPI con autenticación Digest (dos pasos: 401 -> Authorization). */
  private async isapi(method: string, path: string, body?: string): Promise<Response> {
    const env = loadEnv();
    const base = env.HIKVISION_URL;
    if (!base || !env.HIKVISION_USER || !env.HIKVISION_PASS) {
      throw new Error('Falta HIKVISION_URL/USER/PASS');
    }
    const url = `${base.replace(/\/$/, '')}${path}`;
    const headers: Record<string, string> = {};
    if (body) headers['Content-Type'] = 'application/xml';

    // 1) Reto
    const reto = await fetch(url, { method, headers, body });
    if (reto.status !== 401) return reto;
    const wa = reto.headers.get('www-authenticate') ?? '';
    if (!/digest/i.test(wa)) return reto;

    // 2) Respuesta Digest
    const auth = this.digestHeader(wa, method, path, env.HIKVISION_USER, env.HIKVISION_PASS);
    return fetch(url, { method, headers: { ...headers, Authorization: auth }, body });
  }

  private digestHeader(
    wwwAuth: string,
    method: string,
    uri: string,
    user: string,
    pass: string,
  ): string {
    const val = (k: string) =>
      new RegExp(`${k}="?([^",]+)"?`).exec(wwwAuth)?.[1] ?? '';
    const realm = val('realm');
    const nonce = val('nonce');
    const qop = val('qop');
    const opaque = val('opaque');
    const cnonce = randomBytes(8).toString('hex');
    const nc = '00000001';
    const ha1 = md5(`${user}:${realm}:${pass}`);
    const ha2 = md5(`${method}:${uri}`);
    const response = qop
      ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
      : md5(`${ha1}:${nonce}:${ha2}`);
    let h =
      `Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${uri}", ` +
      `response="${response}"`;
    if (qop) h += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
    if (opaque) h += `, opaque="${opaque}"`;
    return h;
  }
}
