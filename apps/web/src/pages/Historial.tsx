import { useState } from 'react';
import { Badge, Card, Select, Spinner, useApi } from '../lib/ui';
import { fechaHora } from '../lib/format';

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

export default function Historial() {
  const [limit, setLimit] = useState(50);
  const movimientos = useApi<Movimiento[]>(`/movimientos?limit=${limit}`);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Historial de accesos</h1>
        <div className="w-40">
          <Select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={50}>Últimos 50</option>
            <option value={100}>Últimos 100</option>
            <option value={200}>Últimos 200</option>
          </Select>
        </div>
      </div>

      <Card className="p-5">
        {movimientos.loading ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-500">
                  <th className="py-2">Fecha</th>
                  <th>Persona</th>
                  <th>Bodega</th>
                  <th>Punto</th>
                  <th>Sentido</th>
                  <th>Apertura</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {(movimientos.data ?? []).map((m) => (
                  <tr key={m.id} className="border-b border-slate-100">
                    <td className="py-2 text-slate-500">{fechaHora(m.creadoEn)}</td>
                    <td>{m.snapshot?.nombre ?? '—'}</td>
                    <td>{m.snapshot?.bodega ?? '—'}</td>
                    <td>{m.puntoAcceso?.nombre ?? '—'}</td>
                    <td>{m.sentido}</td>
                    <td>
                      {m.tipoApertura === 'MANUAL' ? (
                        <Badge color="amber">Manual</Badge>
                      ) : (
                        <span className="text-slate-400">Auto</span>
                      )}
                    </td>
                    <td>
                      {m.resultado === 'AUTORIZADO' ? (
                        <Badge color="green">Autorizado</Badge>
                      ) : (
                        <Badge color="red">{m.motivoRechazo ?? 'Rechazado'}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {movimientos.data?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-4 text-slate-500">
                      Sin movimientos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
