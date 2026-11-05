import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Button, Card, Field, Input, Select, Spinner, useApi } from '../lib/ui';

interface Parque {
  id: string;
  nombre: string;
}
interface Bodega {
  id: string;
  nombre: string;
  nave: string | null;
  activo: boolean;
  parqueId: string;
}

export default function Bodegas() {
  const { user } = useAuth();
  const esSuper = user?.rol === 'SUPER_ADMIN';
  const parques = useApi<Parque[]>(esSuper ? '/parques' : null);
  const [parqueSel, setParqueSel] = useState('');

  // Super: solo las bodegas del parque elegido. Admin de parque: las suyas.
  const bodegas = useApi<Bodega[]>(
    esSuper ? (parqueSel ? `/bodegas?parqueId=${parqueSel}` : null) : '/bodegas',
  );

  const [form, setForm] = useState({ nombre: '', nave: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/bodegas', {
        nombre: form.nombre,
        nave: form.nave || undefined,
        parqueId: esSuper ? parqueSel : undefined,
      });
      setForm({ nombre: '', nave: '' });
      bodegas.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Bodegas</h1>

      {esSuper && (
        <Card className="p-5">
          <div className="sm:w-80">
            <Field label="Parque">
              <Select value={parqueSel} onChange={(e) => setParqueSel(e.target.value)}>
                <option value="">Selecciona un parque…</option>
                {(parques.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </Select>
            </Field>
          </div>
          {!parqueSel && (
            <p className="mt-2 text-xs text-slate-500">Elige un parque para ver y crear sus bodegas.</p>
          )}
        </Card>
      )}

      {(!esSuper || parqueSel) && (
        <>
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Nueva bodega</h2>
            <form onSubmit={crear} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Empresa / nombre">
                <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
              </Field>
              <Field label="Nave">
                <Input value={form.nave} onChange={(e) => setForm({ ...form, nave: e.target.value })} placeholder="NAVE B-12" />
              </Field>
              <div className="flex items-end">
                <Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Agregar bodega'}</Button>
              </div>
            </form>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </Card>

          <Card className="p-5">
            {bodegas.loading ? (
              <Spinner />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-500">
                    <th className="py-2">Empresa</th>
                    <th>Nave</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(bodegas.data ?? []).map((b) => (
                    <tr key={b.id} className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-800">{b.nombre}</td>
                      <td>{b.nave ?? '—'}</td>
                      <td>{b.activo ? <Badge color="green">Activa</Badge> : <Badge color="slate">Inactiva</Badge>}</td>
                    </tr>
                  ))}
                  {bodegas.data?.length === 0 && (
                    <tr><td colSpan={3} className="py-4 text-slate-500">Este parque aún no tiene bodegas.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
