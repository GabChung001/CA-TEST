import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { ResultadoValidacion } from '../lib/tipos';
import { Badge, Button, Card, Field, Select, Spinner, useApi } from '../lib/ui';

interface Punto {
  id: string;
  nombre: string;
  tipo: string;
  activo: boolean;
}

// BarcodeDetector no está en los tipos del DOM: acceso laxo.
type DetectorCtor = new (opts: { formats: string[] }) => {
  detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

export default function Lector() {
  const puntos = useApi<Punto[]>('/puntos');
  const [puntoId, setPuntoId] = useState('');
  const [activo, setActivo] = useState(false);
  const [res, setRes] = useState<ResultadoValidacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const puntoRef = useRef(puntoId);
  const ultimo = useRef<{ code: string; t: number }>({ code: '', t: 0 });

  puntoRef.current = puntoId;
  const soportado =
    typeof window !== 'undefined' && 'BarcodeDetector' in window;

  useEffect(() => {
    if (!activo) return;
    let cancelado = false;
    let timer = 0;
    const Detector = (window as unknown as { BarcodeDetector: DetectorCtor })
      .BarcodeDetector;
    const detector = new Detector({ formats: ['qr_code'] });

    const validar = async (qr: string) => {
      const pid = puntoRef.current;
      if (!pid) return;
      try {
        const r = await api.post<ResultadoValidacion>('/acceso/validar', {
          qr,
          puntoAccesoId: pid,
        });
        setRes(r);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Error de validación');
      }
    };

    const tick = async () => {
      if (cancelado) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        try {
          const codes = await detector.detect(v);
          if (codes.length) {
            const raw = codes[0].rawValue;
            const now = Date.now();
            // Evita re-escanear el mismo QR en 4 s.
            if (raw && (raw !== ultimo.current.code || now - ultimo.current.t > 4000)) {
              ultimo.current = { code: raw, t: now };
              void validar(raw);
            }
          }
        } catch {
          /* cuadro sin QR */
        }
      }
      timer = window.setTimeout(tick, 350);
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch (e) {
        setError('No se pudo abrir la cámara: ' + (e as Error).message);
        setActivo(false);
      }
    })();

    return () => {
      cancelado = true;
      if (timer) clearTimeout(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [activo]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Lector (cámara)</h1>

      {!soportado && (
        <Card className="p-4">
          <p className="text-sm text-amber-700">
            Este navegador no soporta la lectura de QR por cámara. Usa Chrome o Edge.
          </p>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-72">
            <Field label="Punto de acceso">
              <Select
                value={puntoId}
                onChange={(e) => setPuntoId(e.target.value)}
                disabled={activo}
              >
                <option value="">Selecciona…</option>
                {(puntos.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.tipo})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {!activo ? (
            <Button disabled={!puntoId || !soportado} onClick={() => { setError(null); setRes(null); setActivo(true); }}>
              Iniciar cámara
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setActivo(false)}>Detener</Button>
          )}
        </div>
        {puntos.loading && <Spinner />}
        {(puntos.data ?? []).length === 0 && !puntos.loading && (
          <p className="mt-3 text-sm text-slate-500">
            No hay puntos de acceso. Crea uno en Configuración primero.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <video
            ref={videoRef}
            className="aspect-video w-full bg-slate-900 object-cover"
            muted
            playsInline
          />
          {!activo && (
            <div className="p-3 text-center text-xs text-slate-400">
              La cámara aparece aquí al iniciar. Muestra el QR frente a ella.
            </div>
          )}
        </Card>

        <ResultadoAcceso res={res} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function ResultadoAcceso({ res }: { res: ResultadoValidacion | null }) {
  if (!res) {
    return (
      <Card className="flex items-center justify-center p-10 text-slate-400">
        Esperando lectura…
      </Card>
    );
  }
  const ok = res.resultado === 'AUTORIZADO';
  return (
    <Card
      className={`flex flex-col items-center justify-center p-10 text-center ${
        ok ? 'bg-green-50' : 'bg-red-50'
      }`}
    >
      <div className={`text-4xl font-bold ${ok ? 'text-green-700' : 'text-red-700'}`}>
        {ok ? '✓ ACCESO' : '✗ RECHAZADO'}
      </div>
      {res.persona && (
        <div className="mt-3 text-lg font-medium text-slate-800">
          {res.persona.nombre}
        </div>
      )}
      {res.persona?.bodega && (
        <div className="text-sm text-slate-600">{res.persona.bodega}</div>
      )}
      {res.persona?.placas && (
        <div className="text-sm text-slate-600">Placas: {res.persona.placas}</div>
      )}
      {res.motivo && <div className="mt-2 text-sm text-red-600">{res.motivo}</div>}
      <div className="mt-3">
        <Badge color={ok ? 'green' : 'red'}>
          {res.sentido} · {res.abrirBarrera ? 'barrera abierta' : 'barrera cerrada'}
        </Badge>
      </div>
    </Card>
  );
}
