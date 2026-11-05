import { Badge, Card, Spinner, useApi } from '../lib/ui';
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
  // Auto-refresco cada 8 s (actualización silenciosa, sin recargar la página).
  const resumen = useApi<Resumen>('/movimientos/resumen', 8000);
  const serie = useApi<SeriePunto[]>('/movimientos/serie?dias=7', 30000);
  const movimientos = useApi<Movimiento[]>('/movimientos?limit=20', 8000);

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

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Entradas por día (7 días)</h2>
        {serie.loading ? <Spinner /> : <BarChart data={serie.data ?? []} />}
      </Card>

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
            <th>Bodega</th>
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
              <td>{m.snapshot?.bodega ?? '—'}</td>
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
