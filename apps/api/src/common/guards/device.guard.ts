import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PuntosService } from '../../puntos/puntos.service';

/** Autentica a un lector/tótem por su API key (header x-api-key). */
@Injectable()
export class DeviceGuard implements CanActivate {
  constructor(private readonly puntos: PuntosService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('Dispositivo no autorizado');
    }
    const dispositivo = await this.puntos.verificarDispositivo(apiKey);
    if (!dispositivo) throw new UnauthorizedException('Dispositivo no autorizado');
    req.dispositivo = dispositivo;
    return true;
  }
}
