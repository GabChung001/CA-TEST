import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoCredencial } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PersonasService } from '../personas/personas.service';
import { QrService } from '../qr/qr.service';
import type { AuthUser } from '../auth/types';
import { EmitirCredencialDto } from './dto/credencial.dto';

@Injectable()
export class CredencialesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly personas: PersonasService,
    private readonly qr: QrService,
  ) {}

  async emitir(actor: AuthUser, dto: EmitirCredencialDto) {
    await this.personas.getEnAmbito(actor, dto.personaId);

    if (dto.tipo === 'VEHICULAR') {
      if (!dto.vehiculoId) {
        throw new BadRequestException('vehiculoId requerido para credencial vehicular');
      }
      const vehiculo = await this.prisma.vehiculo.findUnique({
        where: { id: dto.vehiculoId },
      });
      if (!vehiculo || vehiculo.personaId !== dto.personaId) {
        throw new BadRequestException('El vehículo no pertenece a la persona');
      }
    }

    const codigo = randomBytes(16).toString('base64url');
    const credencial = await this.prisma.credencial.create({
      data: {
        codigo,
        tipo: dto.tipo,
        personaId: dto.personaId,
        vehiculoId: dto.tipo === 'VEHICULAR' ? dto.vehiculoId : null,
        vigenciaHasta: dto.vigenciaHasta ? new Date(dto.vigenciaHasta) : null,
        emisorId: actor.sub,
      },
    });

    await this.audit.registrar({
      usuarioId: actor.sub,
      accion: 'CREDENCIAL_EMITIDA',
      entidad: 'Credencial',
      entidadId: credencial.id,
      detalle: { tipo: dto.tipo, personaId: dto.personaId },
    });

    return { ...credencial, qr: this.qr.firmar(codigo) };
  }

  listar(actor: AuthUser, personaId: string) {
    return this.personas.getEnAmbito(actor, personaId).then(() =>
      this.prisma.credencial.findMany({
        where: { personaId },
        orderBy: { creadoEn: 'desc' },
      }),
    );
  }

  /** Devuelve el QR (payload firmado + imágenes) para imprimir o mostrar. */
  async qrDe(actor: AuthUser, id: string) {
    const credencial = await this.getEnAmbito(actor, id);
    const payload = this.qr.firmar(credencial.codigo);
    const imagenes = await this.qr.imagenes(payload);
    return { credencialId: credencial.id, payload, ...imagenes };
  }

  async cambiarEstado(actor: AuthUser, id: string, estado: EstadoCredencial, motivo?: string) {
    await this.getEnAmbito(actor, id);
    const credencial = await this.prisma.credencial.update({
      where: { id },
      data: {
        estado,
        bloqueoMotivo: estado === 'BLOQUEADA' ? motivo ?? null : null,
      },
    });
    await this.audit.registrar({
      usuarioId: actor.sub,
      accion: `CREDENCIAL_${estado}`,
      entidad: 'Credencial',
      entidadId: id,
      detalle: motivo ? { motivo } : undefined,
    });
    return credencial;
  }

  private async getEnAmbito(actor: AuthUser, id: string) {
    const credencial = await this.prisma.credencial.findUnique({ where: { id } });
    if (!credencial) throw new NotFoundException('Credencial no encontrada');
    await this.personas.getEnAmbito(actor, credencial.personaId);
    return credencial;
  }
}
