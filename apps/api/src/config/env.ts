import { z } from 'zod';

/**
 * Validación de configuración (SGSI: fallar temprano si falta un secreto).
 * Los secretos tienen longitud mínima para evitar claves débiles.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  QR_SIGNING_SECRET: z.string().min(32),

  PRESENCIA_RESET_HORAS: z.coerce.number().int().positive().default(24),

  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),

  // Sincronización nube <-> edge (caseta)
  SYNC_ROLE: z.enum(['cloud', 'edge']).default('cloud'),
  CLOUD_URL: z.string().url().optional(), // solo edge: URL base de la API en la nube (…/api)
  EDGE_SYNC_KEY: z.string().optional(), // secreto compartido entre nube y edge
  SYNC_INTERVAL_SEG: z.coerce.number().int().positive().default(60),
  PARQUE_ID: z.string().optional(), // solo edge: el parque que atiende esta controladora

  // Barrera / pluma. 'ninguno' = no se controla barrera (default, p. ej. en la nube).
  // 'simulado' = se simula en memoria (para pruebas sin hardware).
  // 'hikvision' = se controla un DS-K28xx por ISAPI.
  // 'rele' = la apertura física la hace ~/abrir-pluma.sh del lector (relé USB al
  // botón de salida del Hik); la lógica de "sigue abierta" usa el temporizador interno.
  BARRERA_MODO: z.enum(['ninguno', 'simulado', 'hikvision', 'rele']).default('ninguno'),
  BARRERA_PULSO_SEG: z.coerce.number().int().positive().default(5),
  BARRERA_ESPERA_CIERRE_MS: z.coerce.number().int().positive().default(6000),
  BARRERA_POLITICA_ABIERTA: z.enum(['reabrir', 'negar']).default('reabrir'),
  // Mapeo de puerta del controlador por tipo de punto (solo hikvision).
  BARRERA_DOOR_ENTRADA: z.string().default('1'),
  BARRERA_DOOR_SALIDA: z.string().default('2'),
  // Conexión al DS-K28xx (solo hikvision, auth Digest).
  HIKVISION_URL: z.string().url().optional(), // p. ej. http://192.168.100.50
  HIKVISION_USER: z.string().optional(),
  HIKVISION_PASS: z.string().optional(),
  HIKVISION_STATUS_PATH: z.string().optional(), // endpoint de estado (varía por firmware)
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error(
      'Configuración inválida (.env):',
      JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
    );
    process.exit(1);
  }
  cached = parsed.data;
  return cached;
}
