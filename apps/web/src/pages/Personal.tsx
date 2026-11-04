import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  useApi,
} from '../lib/ui';
import { fecha } from '../lib/format';

interface Bodega {
  id: string;
  nombre: string;
}
interface Vehiculo {
  id: string;
  placas: string;
  marca: string | null;
  activo: boolean;
}
interface Credencial {
  id: string;
  tipo: string;
  estado: string;
  estadoPresencia: string;
  vigenciaHasta: string | null;
}
interface Persona {
  id: string;
  nombre: string;
  apellidos: string | null;
  tipo: string;
  activo: boolean;
  bodega?: { nombre: string };
  vehiculos?: Vehiculo[];
  credenciales?: Credencial[];
}

const TIPOS = ['EMPLEADO', 'VISITANTE', 'PROVEEDOR', 'TRANSPORTISTA', 'EVENTUAL'];

export default function Personal() {
  const { user } = useAuth();
  const esBodega = user?.rol === 'ADMIN_BODEGA';
  const bodegas = useApi<Bodega[]>(esBodega ? null : '/bodegas');
  const [filtroBodega, setFiltroBodega] = useState('');
  const personas = useApi<Persona[]>(
    `/personas${!esBodega && filtroBodega ? `?bodegaId=${filtroBodega}` : ''}`,
  );

  const [form, setForm] = useState({ nombre: '', apellidos: '', tipo: 'EMPLEADO', bodegaId: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detalle, setDetalle] = useState<string | null>(null);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/personas', {
        nombre: form.nombre,
        apellidos: form.apellidos || undefined,
        tipo: form.tipo,
        bodegaId: esBodega ? undefined : form.bodegaId,
      });
      setForm({ ...form, nombre: '', apellidos: '' });
      personas.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Personal</h1>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Alta de persona</h2>
        <form onSubmit={crear} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nombre">
            <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </Field>
          <Field label="Apellidos">
            <Input value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} />
          </Field>
          <Field label="Tipo">
            <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          {!esBodega && (
            <Field label="Bodega">
              <Select value={form.bodegaId} onChange={(e) => setForm({ ...form, bodegaId: e.target.value })} required>
                <option value="">Selecciona…</option>
                {(bodegas.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="flex items-end">
            <Button type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Dar de alta'}
            </Button>
          </div>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Card>

      <Card className="p-5">
        {!esBodega && (
          <div className="mb-4 w-64">
            <Field label="Filtrar por bodega">
              <Select value={filtroBodega} onChange={(e) => setFiltroBodega(e.target.value)}>
                <option value="">Todas</option>
                {(bodegas.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        {personas.loading ? (
          <Spinner />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-500">
                <th className="py-2">Nombre</th>
                <th>Tipo</th>
                <th>Credenciales</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(personas.data ?? []).map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-800">
                    {p.nombre} {p.apellidos ?? ''}
                  </td>
                  <td>{p.tipo}</td>
                  <td>{p.credenciales?.length ?? 0}</td>
                  <td>{p.activo ? <Badge color="green">Activo</Badge> : <Badge color="slate">Baja</Badge>}</td>
                  <td>
                    <button className="text-xs text-teal-700 hover:underline" onClick={() => setDetalle(p.id)}>
                      Ver / QR
                    </button>
                  </td>
                </tr>
              ))}
              {personas.data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">
                    Sin personal registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      {detalle && (
        <PersonaDetalle
          personaId={detalle}
          onClose={() => {
            setDetalle(null);
            personas.reload();
          }}
        />
      )}
    </div>
  );
}

function PersonaDetalle({ personaId, onClose }: { personaId: string; onClose: () => void }) {
  const persona = useApi<Persona>(`/personas/${personaId}`);
  const [placas, setPlacas] = useState('');
  const [tipoCred, setTipoCred] = useState('PEATONAL');
  const [vehiculoId, setVehiculoId] = useState('');
  const [qrId, setQrId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agregarVehiculo = async () => {
    setError(null);
    try {
      await api.post('/vehiculos', { personaId, placas });
      setPlacas('');
      persona.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  };

  const emitir = async () => {
    setError(null);
    try {
      await api.post('/credenciales', {
        personaId,
        tipo: tipoCred,
        vehiculoId: tipoCred === 'VEHICULAR' ? vehiculoId : undefined,
      });
      persona.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  };

  const revocar = async (id: string) => {
    await api.post(`/credenciales/${id}/revocar`);
    persona.reload();
  };

  return (
    <Modal title="Persona · credenciales y QR" onClose={onClose}>
      {persona.loading || !persona.data ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          <div>
            <div className="text-lg font-semibold text-slate-900">
              {persona.data.nombre} {persona.data.apellidos ?? ''}
            </div>
            <div className="text-sm text-slate-500">
              {persona.data.tipo} · {persona.data.bodega?.nombre ?? ''}
            </div>
          </div>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Vehículos</h4>
            <ul className="mb-2 space-y-1 text-sm">
              {(persona.data.vehiculos ?? []).map((v) => (
                <li key={v.id} className="text-slate-700">
                  {v.placas} {v.marca ? `· ${v.marca}` : ''}
                </li>
              ))}
              {persona.data.vehiculos?.length === 0 && (
                <li className="text-slate-400">Sin vehículos.</li>
              )}
            </ul>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input placeholder="Placas" value={placas} onChange={(e) => setPlacas(e.target.value)} />
              </div>
              <Button variant="ghost" onClick={agregarVehiculo} disabled={!placas}>
                Agregar
              </Button>
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Emitir credencial</h4>
            <div className="flex items-end gap-2">
              <div className="w-40">
                <Select value={tipoCred} onChange={(e) => setTipoCred(e.target.value)}>
                  <option value="PEATONAL">Peatonal</option>
                  <option value="VEHICULAR">Vehicular</option>
                </Select>
              </div>
              {tipoCred === 'VEHICULAR' && (
                <div className="flex-1">
                  <Select value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)}>
                    <option value="">Vehículo…</option>
                    {(persona.data.vehiculos ?? []).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.placas}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <Button onClick={emitir} disabled={tipoCred === 'VEHICULAR' && !vehiculoId}>
                Emitir
              </Button>
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Credenciales</h4>
            <ul className="space-y-2">
              {(persona.data.credenciales ?? []).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <div>
                    <Badge color="teal">{c.tipo}</Badge>{' '}
                    <span className="text-xs text-slate-500">
                      {c.estado} · {c.estadoPresencia}
                      {c.vigenciaHasta ? ` · vence ${fecha(c.vigenciaHasta)}` : ''}
                    </span>
                  </div>
                  <div className="space-x-2">
                    <button className="text-xs text-teal-700 hover:underline" onClick={() => setQrId(c.id)}>
                      Ver QR
                    </button>
                    {c.estado !== 'REVOCADA' && (
                      <button className="text-xs text-red-600 hover:underline" onClick={() => revocar(c.id)}>
                        Revocar
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {persona.data.credenciales?.length === 0 && (
                <li className="text-sm text-slate-400">Sin credenciales.</li>
              )}
            </ul>
          </section>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
      {qrId && <QrView credencialId={qrId} onClose={() => setQrId(null)} />}
    </Modal>
  );
}

function QrView({ credencialId, onClose }: { credencialId: string; onClose: () => void }) {
  const qr = useApi<{ payload: string; dataUrl: string }>(`/credenciales/${credencialId}/qr`);
  return (
    <Modal title="Código QR" onClose={onClose}>
      {qr.loading || !qr.data ? (
        <Spinner />
      ) : (
        <div className="flex flex-col items-center gap-3">
          <img src={qr.data.dataUrl} alt="QR" className="h-60 w-60" />
          <code className="break-all text-center text-[10px] text-slate-400">{qr.data.payload}</code>
          <Button variant="ghost" onClick={() => window.print()}>
            Imprimir
          </Button>
        </div>
      )}
    </Modal>
  );
}
