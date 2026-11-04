export interface ResultadoValidacion {
  resultado: 'AUTORIZADO' | 'RECHAZADO';
  sentido: 'ENTRADA' | 'SALIDA';
  motivo?: string;
  abrirBarrera: boolean;
  persona?: {
    nombre: string;
    tipo: string;
    bodega?: string;
    placas?: string;
  };
  vigenciaHasta?: string | null;
  movimientoId: string;
}
