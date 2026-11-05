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
    const nombre = `Lector ${new Date().toISOString().slice(11, 16)}`;
    const r = await api.post<{ apiKey: string }>(`/puntos/${puntoId}/dispositivos`, { nombre });
    setNuevaKey(r.apiKey);
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
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
          <div className="font-semibold text-amber-800">API key del dispositivo (se muestra una sola vez):</div>
          <code className="break-all text-amber-900">{nuevaKey}</code>
        </div>
      )}

      <div className="space-y-2">
        {(puntos.data ?? []).map((p) => (
          <div key={p.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
            <div>
              <span className="font-medium text-slate-800">{p.nombre}</span>{' '}
              <span className="text-xs text-slate-400">{p.tipo}</span>
              <span className="ml-2 text-xs text-slate-500">{p.dispositivos.length} dispositivo(s)</span>
            </div>
            <button className="text-xs text-teal-700 hover:underline" onClick={() => crearDispositivo(p.id)}>
              + Dispositivo
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
