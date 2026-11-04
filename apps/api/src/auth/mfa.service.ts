import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { authenticator } from 'otplib';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { QrService } from '../qr/qr.service';

/**
 * MFA por TOTP (Google Authenticator / Authy, etc.).
 * NOTA SGSI: `mfaSecret` se guarda en claro en esta fase; endurecer con
 * cifrado en reposo a nivel de aplicación antes de producción.
 */
@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly qr: QrService,
  ) {}

  async setup(usuarioId: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!u) throw new NotFoundException();
    if (u.mfaHabilitado) throw new BadRequestException('MFA ya está habilitado');

    const secret = authenticator.generateSecret();
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { mfaSecret: secret },
    });
    const otpauth = authenticator.keyuri(u.email, 'ThinkTech Accesos', secret);
    const { dataUrl } = await this.qr.imagenes(otpauth);
    return { otpauth, qrDataUrl: dataUrl };
  }

  async activar(usuarioId: string, code: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!u?.mfaSecret) throw new BadRequestException('Primero genera el MFA (setup)');
    if (!authenticator.verify({ token: code, secret: u.mfaSecret })) {
      throw new BadRequestException('Código inválido');
    }
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { mfaHabilitado: true },
    });
    await this.audit.registrar({
      usuarioId,
      accion: 'MFA_ACTIVADO',
      entidad: 'Usuario',
      entidadId: usuarioId,
    });
    return { ok: true };
  }

  async desactivar(usuarioId: string, code: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!u?.mfaHabilitado || !u.mfaSecret) {
      throw new BadRequestException('MFA no está habilitado');
    }
    if (!authenticator.verify({ token: code, secret: u.mfaSecret })) {
      throw new BadRequestException('Código inválido');
    }
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { mfaHabilitado: false, mfaSecret: null },
    });
    await this.audit.registrar({
      usuarioId,
      accion: 'MFA_DESACTIVADO',
      entidad: 'Usuario',
      entidadId: usuarioId,
    });
    return { ok: true };
  }
}
