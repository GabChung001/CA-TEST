import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth, type Rol } from '../lib/auth';
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

interface Parque {
  id: string;
  nombre: string;
}
interface Bodega {
  id: string;
  nombre: string;
}
interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
}

const ROL_LABEL: Record<Rol, string> = {
  SUPER_ADMIN: 'Super admin',
  ADMIN_PARQUE: 'Admin parque',
  ADMIN_BODEGA: 'Admin bodega',
  VIGILANCIA: 'Vigilancia',
};

export default function Usuarios() {
  const { user } = useAuth();
  const esSuper = user?.rol === 'SUPER_ADMIN';
  const usuarios = useApi<Usuario[]>('/usuarios');
  const parques = useApi<Parque[]>(esSuper ? '/parques' : null);
  const bodegas = useApi<Bodega[]>('/bodegas');

  const rolesDisponibles: Rol[] = esSuper
    ? ['ADMIN_PARQUE', 'ADMIN_BODEGA', 'VIGILANCIA', 'SUPER_ADMIN']
    : ['ADMIN_BODEGA', 'VIGILANCIA'];

  const [form, setForm] = useState({
    email: '',
    password: '',
    nombre: '',
    rol: rolesDisponibles[0],
    parqueId: '',
    bodegaId: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);

  const necesitaParque = esSuper && (form.rol === 'ADMIN_PARQUE' || form.rol === 'VIGILANCIA');
  const necesitaBodega = form.rol === 'ADMIN_BODEGA';

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/usuarios', {
        email: form.email,
        password: form.password,
        nombre: form.nombre,
        rol: form.rol,
        parqueId: necesitaParque ? form.parqueId : undefined,
        bodegaId: necesitaBodega ? form.bodegaId : undefined,
      });
      setForm({ ...form, email: '', password: '', nombre: '' });
      usuarios.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const toggleBloqueo = async (u: Usuario) => {
    await api.post(`/usuarios/${u.id}/${u.activo ? 'bloquear' : 'desbloquear'}`);
    usuarios.reload();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Usuarios</h1>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Nuevo usuario</h2>
        <form onSubmit={crear} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nombre">
            <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </Field>
          <Field label="Correo">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="Contraseña (mín. 10)">
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </Field>
          <Field label="Rol">
            <Select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}>
              {rolesDisponibles.map((r) => (
                <option key={r} value={r}>
                  {ROL_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
          {necesitaParque && (
            <Field label="Parque">
              <Select value={form.parqueId} onChange={(e) => setForm({ ...form, parqueId: e.target.value })} required>
                <option value="">Selecciona…</option>
                {(parques.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {necesitaBodega && (
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
              {busy ? 'Guardando…' : 'Crear usuario'}
            </Button>
          </div>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Card>

      <Card className="p-5">
        {usuarios.loading ? (
          <Spinner />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-500">
                <th className="py-2">Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(usuarios.data ?? []).map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-800">{u.nombre}</td>
                  <td className="text-slate-600">{u.email}</td>
                  <td>
                    <Badge color="teal">{ROL_LABEL[u.rol]}</Badge>
                  </td>
                  <td>
                    {u.activo ? <Badge color="green">Activo</Badge> : <Badge color="red">Bloqueado</Badge>}
                  </td>
                  <td className="space-x-2">
                    {u.id !== user?.id && (
                      <>
                        <button className="text-xs text-teal-700 hover:underline" onClick={() => toggleBloqueo(u)}>
                          {u.activo ? 'Bloquear' : 'Desbloquear'}
                        </button>
                        <button className="text-xs text-slate-500 hover:underline" onClick={() => setResetId(u.id)}>
                          Reset contraseña
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {resetId && <ResetModal usuarioId={resetId} onClose={() => setResetId(null)} />}
    </div>
  );
}

function ResetModal({ usuarioId, onClose }: { usuarioId: string; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const guardar = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/usuarios/${usuarioId}/reset-password`, { password });
      setOk(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Restablecer contraseña" onClose={onClose}>
      {ok ? (
        <p className="text-sm text-green-700">Contraseña actualizada. Las sesiones activas se cerraron.</p>
      ) : (
        <div className="space-y-3">
          <Field label="Nueva contraseña (mín. 10)">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={guardar} disabled={busy || password.length < 10}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      )}
    </Modal>
  );
}
