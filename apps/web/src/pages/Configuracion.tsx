import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Button, Card, Field, Input, Select, Spinner, useApi } from '../lib/ui';

interface Perfil {
  mfaHabilitado: boolean;
}
interface Parque {
  id: string;
  nombre: string;
}
interface Dispositivo {
  id: string;
  nombre: string;
  estado: string;
  ultimoLatido: string | null;
  creadoEn: string;
}
interface Punto {
  id: string;
  nombre: string;
  tipo: string;
  activo: boolean;
  dispositivos: Dispositivo[];
}

const TIPOS_PUNTO = [
  'ENTRADA_VEHICULAR',
  'SALIDA_VEHICULAR',
  'ENTRADA_PEATONAL',
  'SALIDA_PEATONAL',
];

export default function Configuracion() {
  const { user } = useAuth();
  const operaPuntos = user?.rol === 'SUPER_ADMIN' || user?.rol === 'ADMIN_PARQUE';

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Configuración</h1>
      <MfaCard />
      {user?.rol === 'SUPER_ADMIN' && <ParquesCard />}
      {operaPuntos && <PuntosCard esSuper={user?.rol === 'SUPER_ADMIN'} />}
    </div>
  );
}

function MfaCard() {
  const { refreshUser } = useAuth();
  const perfil = useApi<Perfil>('/auth/me');
  const [setup, setSetup] = useState<{ qrDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const iniciar = async () => {
    setError(null);
    try {
      setSetup(await api.post('/auth/mfa/setup'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  };
  const activar = async () => {
    setError(null);
    try {
      await api.post('/auth/mfa/activar', { code });
      setSetup(null);
      setCode('');
      perfil.reload();
      await refreshUser();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  };
  const desactivar = async () => {
    setError(null);
    try {
      await api.post('/auth/mfa/desactivar', { code });
      setCode('');
      perfil.reload();
      await refreshUser();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Autenticación de dos factores (MFA)</h2>
        {perfil.data &&
          (perfil.data.mfaHabilitado ? <Badge color="green">Activo</Badge> : <Badge color="amber">Inactivo</Badge>)}
      </div>

      {perfil.loading ? (
        <Spinner />
      ) : perfil.data?.mfaHabilitado ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Para desactivarlo, ingresa un código actual.</p>
          <div className="flex items-end gap-2">
            <div className="w-32">
              <Field label="Código">
                <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
              </Field>
            </div>
            <Button variant="danger" onClick={desactivar} disabled={code.length !== 6}>
              Desactivar
            </Button>
          </div>
        </div>
      ) : setup ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Escanea el código con Google Authenticator / Authy y confirma con un código.
          </p>
          <img src={setup.qrDataUrl} alt="QR MFA" className="h-44 w-44 rounded border border-slate-200" />
          <div className="flex items-end gap-2">
            <div className="w-32">
              <Field label="Código">
                <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
              </Field>
            </div>
            <Button onClick={activar} disabled={code.length !== 6}>
              Activar
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={iniciar}>Activar MFA</Button>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

function ParquesCard() {
  const parques = useApi<Parque[]>('/parques');
  const [nombre, setNombre] = useState('');
  const [busy, setBusy] = useState(false);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/parques', { nombre });
      setNombre('');
      parques.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Parques</h2>
      <form onSubmit={crear} className="mb-4 flex items-end gap-2">
        <div className="flex-1">
          <Field label="Nombre del parque">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </Field>
        </div>
        <Button type="submit" disabled={busy}>
          Agregar
        </Button>
      </form>
      <ul className="space-y-1 text-sm text-slate-700">
        {(parques.data ?? []).map((p) => (
          <li key={p.id} className="flex flex-col border-b border-slate-100 py-1">
            <span className="font-medium">{p.nombre}</span>
            <code className="text-[11px] text-slate-400">PARQUE_ID: {p.id}</code>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        El <code>PARQUE_ID</code> se usa para designar cada controladora de caseta a su parque.
      </p>
    </Card>
  );
}

function PuntosCard({ esSuper }: { esSuper: boolean }) {
  const puntos = useApi<Punto[]>('/puntos');
  const parques = useApi<Parque[]>(esSuper ? '/parques' : null);
  const [form, setForm] = useState({ tipo: TIPOS_PUNTO[0], nombre: '', parqueId: '' });
  const [nuevaKey, setNuevaKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const crearPunto = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/puntos', {
        tipo: form.tipo,
        nombre: form.nombre,
        parqueId: esSuper ? form.parqueId : undefined,
      });
      setForm({ ...form, nombre: '' });
      puntos.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  };

  const crearDispositivo = async (puntoId: string) => {
    const nombre = window.prompt('Nombre del dispositivo (p. ej. Cámara entrada, Tótem salida):');
    if (!nombre) return;
    const r = await api.post<{ apiKey: string }>(`/puntos/${puntoId}/dispositivos`, { nombre });
    setNuevaKey(r.apiKey);
    puntos.reload();
  };

  const regenerarLlave = async (devId: string) => {
    if (!window.confirm('Se generará una llave NUEVA y la anterior dejará de funcionar. ¿Continuar?')) return;
    const r = await api.post<{ apiKey: string }>(`/puntos/dispositivos/${devId}/regenerar`, {});
    setNuevaKey(r.apiKey);
    puntos.reload();
  };

  const cambiarEstado = async (devId: string, estado: string) => {
    await api.patch(`/puntos/dispositivos/${devId}/estado`, { estado });
    puntos.reload();
  };

  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Puntos de acceso</h2>
      <form onSubmit={crearPunto} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
          {TIPOS_PUNTO.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Nombre"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          required
        />
        {esSuper && (
          <Select value={form.parqueId} onChange={(e) => setForm({ ...form, parqueId: e.target.value })} required>
            <option value="">Parque…</option>
            {(parques.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Select>
        )}
        <Button type="submit">Agregar punto</Button>
      </form>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {nuevaKey && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold text-amber-800">
              API key del dispositivo — cópiala ahora, se muestra una sola vez:
            </span>
            <div className="flex gap-2">
              <button
                className="rounded bg-amber-200 px-2 py-0.5 text-amber-900 hover:bg-amber-300"
                onClick={() => navigator.clipboard?.writeText(nuevaKey)}
              >
                Copiar
              </button>
              <button className="text-amber-700 hover:underline" onClick={() => setNuevaKey(null)}>
                Ocultar
              </button>
            </div>
          </div>
          <code className="block break-all rounded bg-white/60 p-2 text-amber-900">{nuevaKey}</code>
          <p className="mt-1 text-amber-700">
            Pégala en la controladora: <code>designar-lector.sh &lt;nombre&gt; /dev/videoN {nuevaKey.split('.')[0]}…</code>
          </p>
        </div>
      )}

      <div className="space-y-4">
        {(puntos.data ?? []).map((p) => (
          <div key={p.id} className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <span className="font-medium text-slate-800">{p.nombre}</span>{' '}
                <Badge color={p.tipo.startsWith('ENTRADA') ? 'green' : 'amber'}>{p.tipo}</Badge>
                {!p.activo && <span className="ml-2 text-xs text-red-500">(inactivo)</span>}
              </div>
              <button className="text-xs font-medium text-teal-700 hover:underline" onClick={() => crearDispositivo(p.id)}>
                + Dispositivo
              </button>
            </div>

            {p.dispositivos.length === 0 ? (
              <p className="text-xs text-slate-400">Sin dispositivos. Agrega uno para obtener su API key.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="pb-1 font-medium">Dispositivo</th>
                    <th className="pb-1 font-medium">ID / prefijo de API key</th>
                    <th className="pb-1 font-medium">Estado</th>
                    <th className="pb-1 font-medium">Último latido</th>
                    <th className="pb-1 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {p.dispositivos.map((d) => (
                    <tr key={d.id} className="border-t border-slate-100">
                      <td className="py-1.5 pr-2 font-medium text-slate-700">{d.nombre}</td>
                      <td className="py-1.5 pr-2">
                        <code className="rounded bg-slate-100 px-1 text-slate-600">{d.id}</code>
                      </td>
                      <td className="py-1.5 pr-2">
                        <Badge
                          color={
                            d.estado === 'OPERATIVO' ? 'green' : d.estado === 'DESCONECTADO' ? 'amber' : 'slate'
                          }
                        >
                          {d.estado}
                        </Badge>
                      </td>
                      <td className="py-1.5 pr-2 text-slate-500">
                        {d.ultimoLatido ? new Date(d.ultimoLatido).toLocaleString() : '—'}
                      </td>
                      <td className="py-1.5 text-right">
                        <button
                          className="text-teal-700 hover:underline"
                          onClick={() => regenerarLlave(d.id)}
                        >
                          Regenerar llave
                        </button>
                        {d.estado === 'FUERA_DE_SERVICIO' ? (
                          <button
                            className="ml-3 text-emerald-600 hover:underline"
                            onClick={() => cambiarEstado(d.id, 'OPERATIVO')}
                          >
                            Reactivar
                          </button>
                        ) : (
                          <button
                            className="ml-3 text-red-600 hover:underline"
                            onClick={() => cambiarEstado(d.id, 'FUERA_DE_SERVICIO')}
                          >
                            Revocar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        El <strong>ID / prefijo</strong> es la parte antes del punto en la API key
        (<code>&lt;id&gt;.&lt;secreto&gt;</code>): sirve para identificar a qué dispositivo pertenece cada llave.
        El secreto no se puede volver a mostrar; si lo perdiste, usa <strong>Regenerar llave</strong>.
      </p>
    </Card>
  );
}
