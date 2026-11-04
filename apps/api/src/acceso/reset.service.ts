import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { loadEnv } from '../config/env';

/**
 * Reset de presencia (anti-passback): libera a AFUERA las credenciales que
 * siguen ADENTRO sin haber marcado salida en más de PRESENCIA_RESET_HORAS (24).
 */
@Injectable()
export class ResetPresenciaService {
  private readonly logger = new Logger(ResetPresenciaService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async ejecutar(): Promise<void> {
    const horas = loadEnv().PRESENCIA_RESET_HORAS;
    const limite = new Date(Date.now() - horas * 3_600_000);
    const r = await this.prisma.credencial.updateMany({
      where: {
        estadoPresencia: 'ADENTRO',
        OR: [{ ultimaEntradaEn: { lt: limite } }, { ultimaEntradaEn: null }],
      },
      data: { estadoPresencia: 'AFUERA' },
    });
    if (r.count > 0) {
      this.logger.log(`Reset de presencia 24h: ${r.count} credencial(es) liberadas`);
    }
  }
}
