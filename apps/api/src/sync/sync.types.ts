/** Forma de un movimiento transmitido del edge a la nube. */
export interface MovimientoWire {
  id: string;
  puntoAccesoId: string;
  dispositivoId: string | null;
  credencialId: string | null;
  sentido: string;
  resultado: string;
  motivoRechazo: string | null;
  tipoApertura: string;
  operadorId: string | null;
  motivoManual: string | null;
  qrLeido: string | null;
  snapshot: unknown;
  creadoEn: string;
}
