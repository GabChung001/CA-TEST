import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import * as QRCode from 'qrcode';
import { QR_PREFIJO } from '@acceso/shared';
import { loadEnv } from '../config/env';

/**
 * Firma y verifica el contenido del QR. El QR es estático (sirve impreso o en
 * pantalla); la seguridad viene de la firma HMAC: nadie puede forjar un QR
 * válido sin QR_SIGNING_SECRET. La vigencia/estado se resuelven en BD.
 *
 * Formato: "TTA1.<codigo>.<firma base64url>"
 */
@Injectable()
export class QrService {
  private readonly secret = loadEnv().QR_SIGNING_SECRET;

  firmar(codigo: string): string {
    return `${QR_PREFIJO}.${codigo}.${this.firma(codigo)}`;
  }

  /** Verifica la firma y devuelve el código embebido. */
  verificar(qr: string): { ok: boolean; codigo?: string } {
    const parts = qr.split('.');
    if (parts.length !== 3 || parts[0] !== QR_PREFIJO) return { ok: false };
    const [, codigo, sig] = parts;
    const esperado = this.firma(codigo);
    const a = Buffer.from(sig);
    const b = Buffer.from(esperado);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };
    return { ok: true, codigo };
  }

  async imagenes(payload: string): Promise<{ svg: string; dataUrl: string }> {
    const [svg, dataUrl] = await Promise.all([
      QRCode.toString(payload, { type: 'svg', margin: 1, width: 320 }),
      QRCode.toDataURL(payload, { margin: 1, width: 320 }),
    ]);
    return { svg, dataUrl };
  }

  private firma(codigo: string): string {
    return createHmac('sha256', this.secret).update(`1|${codigo}`).digest('base64url');
  }
}
