import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { ResultadoValidacion } from '../lib/tipos';
import {
  Badge,
  Button,
  Card,
  Field,
  Select,
  Spinner,
  useApi,
} from '../lib/ui';
import { fechaHora } from '../lib/format';

interface Resumen {
  accesosHoy: number;
  rechazosHoy: number;
  dentro: number;
}
interface SeriePunto {
  fecha: string;
  entradas: number;
}
interface Punto {
  id: string;
  nombre: string;
  tipo: string;
  activo: boolean;
}
interface Movimiento {
  id: string;
  sentido: string;
  resultado: string;
  motivoRechazo: string | null;
  tipoApertura: string;
  creadoEn: string;
  snapshot: { nombre?: string; bodega?: string; placas?: string } | null;
  puntoAcceso: { nombre: string; tipo: string } | null;
}

export default function Panel() {
  const resumen = useApi<Resumen>('/movimientos/resumen');
  const serie = useApi<SeriePunto[]>('/movimientos/serie?dias=7');
  const puntos = useApi<Punto[]>('/puntos');
  const movimientos = useApi<Movimiento[]>('/movimientos?limit=15');

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Panel de vigilancia</h1>

      {resumen.data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Accesos hoy" value={resumen.data.accesosHoy} color="text-slate-900" />
          <Stat label="Personas dentro" value={resumen.data.dentro} color="text-teal-600" />
          <Stat label="Rechazos hoy" value={resumen.data.rechazosHoy} color="text-red-600" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Simulador
          puntos={puntos.data ?? []}
          disponible={!puntos.error}
          onValidado={() => {
            resumen.reload();
            movimientos.reload();
          }}
        />
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Entradas por día (7 días)
          </h2>
          {serie.loading ? <Spinner /> : <BarChart data={serie.data ?? []} />}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Últimos movimientos</h2>
        {movimientos.loading ? (
          <Spinner />
        ) : (
          <MovimientosTabla movimientos={movimientos.data ?? []} />
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${color}`}>{value}</div>
    </Card>
  );
}

function Simulador({
  puntos,
  disponible,
  onValidado,
}: {
  puntos: Punto[];
  disponible: boolean;
  onValidado: () => void;
}) {
  const [puntoId, setPuntoId] = useState('');
  const [qr, setQr] = useState('');
  const [res, setRes] = useState<ResultadoValidacion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validar = async () => {
    setBusy(true);
    setError(null);
    setRes(null);
    try {
      const r = await api.post<ResultadoValidacion>('/acceso/validar', {
        qr: qr.trim(),
        puntoAccesoId: puntoId,
      });
      setRes(r);
      onValidado();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  if (!disponible) {
    return (
      <Card className="p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Simulador de lector</h2>
        <p className="text-sm text-slate-500">
          Tu rol no opera puntos de acceso.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-700">
        Simulador de lector
      </h2>
      <div className="space-y-3">
        <Field label="Punto de acceso">
          <Select value={puntoId} onChange={(e) => setPuntoId(e.target.value)}>
            <option value="">Selecciona…</option>
            {puntos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.tipo})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Contenido del QR">
          <textarea
            value={qr}
            onChange={(e) => setQr(e.target.value)}
            rows={2}
            placeholder="TTA1.xxx.yyy"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
        </Field>
        <Button onClick={validar} disabled={busy || !puntoId || !qr} className="w-full">
          {busy ? 'Validando…' : 'Validar acceso'}
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {res && <ResultadoAcceso res={res} />}
      </div>
    </Card>
  );
}

function ResultadoAcceso({ res }: { res: ResultadoValidacion }) {
  const ok = res.resultado === 'AUTORIZADO';
  return (
    <div
      className={`rounded-lg border p-4 ${
        ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
      }`}
    >
      <div className={`font-semibold ${ok ? 'text-green-700' : 'text-red-700'}`}>
        {ok ? '✓ Acceso autorizado' : '✗ Acceso rechazado'}
      </div>
      {res.persona && (
        <div className="mt-1 text-sm text-slate-700">
          {res.persona.nombre}
          {res.persona.bodega ? ` · ${res.persona.bodega}` : ''}
          {res.persona.placas ? ` · ${res.persona.placas}` : ''}
        </div>
      )}
      {res.motivo && (
        <div className="mt-1 text-sm text-red-600">{res.motivo}</div>
      )}
      <div className="mt-1 text-xs text-slate-500">
        {res.sentido} · {res.abrirBarrera ? 'barrera abierta' : 'barrera cerrada'}
      </div>
    </div>
  );
}

function BarChart({ data }: { data: SeriePunto[] }) {
  const max = Math.max(1, ...data.map((d) => d.entradas));
  return (
    <div className="flex h-40 items-end gap-2">
      {data.map((d) => (
        <div key={d.fecha} className="flex flex-1 flex-col items-center gap-1">
          <div className="text-xs font-medium text-slate-600">{d.entradas}</div>
          <div
            className="w-full rounded-t bg-teal-500"
            style={{ height: `${(d.entradas / max) * 100}%`, minHeight: 2 }}
          />
          <div className="text-[10px] text-slate-400">{d.fecha.slice(5)}</div>
        </div>
      ))}
    </div>
  );
}

function MovimientosTabla({ movimientos }: { movimientos: Movimiento[] }) {
  if (movimientos.length === 0)
    return <p className="text-sm text-slate-500">Sin movimientos aún.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-slate-500">
            <th className="py-2">Hora</th>
            <th>Persona</th>
            <th>Punto</th>
            <th>Sentido</th>
            <th>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {movimientos.map((m) => (
            <tr key={m.id} className="border-b border-slate-100">
              <td className="py-2 text-slate-500">{fechaHora(m.creadoEn)}</td>
              <td>{m.snapshot?.nombre ?? '—'}</td>
              <td>{m.puntoAcceso?.nombre ?? '—'}</td>
              <td>{m.sentido}</td>
              <td>
                {m.resultado === 'AUTORIZADO' ? (
                  <Badge color="green">Autorizado</Badge>
                ) : (
                  <Badge color="red">{m.motivoRechazo ?? 'Rechazado'}</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
