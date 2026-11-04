import { IsArray } from 'class-validator';
import type { MovimientoWire } from '../sync.types';

export class IngestarMovimientosDto {
  @IsArray()
  movimientos!: MovimientoWire[];
}
