// ════════════════════════════════════════════════════════════════════
//  @acceso/shared — Tipos de dominio compartidos entre API, web y tótem.
//  Fuente única de verdad para roles, enums y contratos de validación.
// ════════════════════════════════════════════════════════════════════

// ───────────────────────────  ROLES  ────────────────────────────────

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN_PARQUE: 'ADMIN_PARQUE',
  ADMIN_BODEGA: 'ADMIN_BODEGA',
  VIGILANCIA: 'VIGILANCIA',
} as const;

export type Rol = (typeof ROLES)[keyof typeof ROLES];

/**
 * Qué puede hacer cada rol. La autorización SIEMPRE se verifica en el
 * servidor; esto es la referencia canónica del modelo RBAC.
 */
export const PERMISOS_POR_ROL: Record<Rol, string[]> = {
  // ThinkTech: control total de la plataforma (todos los parques).
  SUPER_ADMIN: ['*'],

  // Dueño del parque: todo dentro de SU parque, incluidos admins de bodega
  // y usuarios de caseta, y bloqueo de personal.
  ADMIN_PARQUE: [
    'parque:leer',
    'bodega:crear', 'bodega:editar', 'bodega:leer',
    'usuario:crear', 'usuario:editar', 'usuario:bloquear', 'usuario:leer',
    'persona:leer', 'persona:bloquear',
    'credencial:leer', 'credencial:bloquear', 'credencial:revocar',
    'movimiento:leer', 'reporte:leer', 'apertura:manual',
  ],

  // Admin de bodega: altas/bajas de SU personal y sus QR, y su chart.
  ADMIN_BODEGA: [
    'persona:crear', 'persona:editar', 'persona:baja', 'persona:leer',
    'vehiculo:crear', 'vehiculo:editar', 'vehiculo:leer',
    'credencial:crear', 'credencial:leer', 'credencial:bloquear', 'credencial:revocar',
    'movimiento:leer:bodega', 'reporte:asistencia:bodega',
  ],

  // Caseta: operación en vivo, visitas y apertura manual (con registro).
  VIGILANCIA: [
    'panel:leer', 'movimiento:leer', 'visita:registrar',
    'apertura:manual', 'credencial:leer',
  ],
};

// ─────────────────────────  ENUMS DOMINIO  ──────────────────────────
// (Reflejan el schema de Prisma; se mantienen sincronizados a mano.)

export type TipoCredencial = 'PEATONAL' | 'VEHICULAR';
export type EstadoCredencial = 'ACTIVA' | 'BLOQUEADA' | 'REVOCADA' | 'VENCIDA';
export type EstadoPresencia = 'AFUERA' | 'ADENTRO';
export type SentidoAcceso = 'ENTRADA' | 'SALIDA';

export type TipoPuntoAcceso =
  | 'ENTRADA_VEHICULAR'
  | 'SALIDA_VEHICULAR'
  | 'ENTRADA_PEATONAL'
  | 'SALIDA_PEATONAL';

export type ResultadoAcceso = 'AUTORIZADO' | 'RECHAZADO';

export type MotivoRechazo =
  | 'QR_NO_RECONOCIDO'
  | 'FIRMA_INVALIDA'
  | 'CREDENCIAL_BLOQUEADA'
  | 'CREDENCIAL_REVOCADA'
  | 'FUERA_DE_VIGENCIA'
  | 'TIPO_INCORRECTO'
  | 'NO_AUTORIZADO_PUNTO'
  | 'REINGRESO_NO_PERMITIDO'
  | 'DISPOSITIVO_NO_AUTORIZADO';

/** Mensajes legibles para la pantalla de caseta. */
export const MENSAJE_RECHAZO: Record<MotivoRechazo, string> = {
  QR_NO_RECONOCIDO: 'QR no reconocido',
  FIRMA_INVALIDA: 'QR inválido o alterado',
  CREDENCIAL_BLOQUEADA: 'Credencial bloqueada',
  CREDENCIAL_REVOCADA: 'Credencial dada de baja',
  FUERA_DE_VIGENCIA: 'Credencial vencida',
  TIPO_INCORRECTO: 'Tipo de acceso incorrecto',
  NO_AUTORIZADO_PUNTO: 'No autorizado en este punto',
  REINGRESO_NO_PERMITIDO: 'Reingreso no permitido (ya se encuentra dentro)',
  DISPOSITIVO_NO_AUTORIZADO: 'Dispositivo no autorizado',
};

// ──────────────────────────  QR FIRMADO  ────────────────────────────

/**
 * Carga del QR. Es estática (sirve impreso/enmicado/gaffete y en pantalla).
 * `sig` es un HMAC-SHA256 de `v|cid` con QR_SIGNING_SECRET → impide forjar
 * un QR válido sin la clave. La vigencia/estado reales se resuelven en BD.
 *
 * Formato serializado en el QR:  "TTA1.<cid>.<sig>"
 */
export interface QrPayload {
  v: 1; // versión del formato
  cid: string; // Credencial.codigo (identificador opaco)
  sig: string; // HMAC base64url
}

export const QR_PREFIJO = 'TTA1';

// ─────────────────  CONTRATO DE VALIDACIÓN DE ACCESO  ───────────────

/** Lo que envía el tótem/lector al validar una lectura. */
export interface SolicitudAcceso {
  qr: string; // cadena cruda leída del QR
  puntoAccesoId: string;
  dispositivoId?: string;
}

/** Respuesta del servidor al lector y al panel en vivo. */
export interface ResultadoValidacion {
  resultado: ResultadoAcceso;
  sentido: SentidoAcceso;
  motivo?: MotivoRechazo;
  abrirBarrera: boolean; // si el controlador debe abrir pluma/torniquete
  persona?: {
    nombre: string;
    tipo: string;
    bodega?: string;
    placas?: string;
  };
  vigenciaHasta?: string | null;
  movimientoId: string;
  /** Resultado del control de la barrera/pluma (abrir, esperar cierre, reabrir). */
  barrera?: {
    accion: 'abierta' | 'esperada' | 'reabierta' | 'negada' | 'sin_barrera';
    esperoCierre: boolean;
    detalle: string;
  };
}
