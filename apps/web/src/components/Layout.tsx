import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, type Rol } from '../lib/auth';

const NAV: { to: string; label: string; roles: Rol[] }[] = [
  { to: '/', label: 'Panel de vigilancia', roles: ['SUPER_ADMIN', 'ADMIN_PARQUE', 'VIGILANCIA', 'ADMIN_BODEGA'] },
  { to: '/personal', label: 'Personal', roles: ['SUPER_ADMIN', 'ADMIN_PARQUE', 'ADMIN_BODEGA'] },
  { to: '/bodegas', label: 'Bodegas', roles: ['SUPER_ADMIN', 'ADMIN_PARQUE'] },
  { to: '/usuarios', label: 'Usuarios', roles: ['SUPER_ADMIN', 'ADMIN_PARQUE'] },
  { to: '/historial', label: 'Historial de accesos', roles: ['SUPER_ADMIN', 'ADMIN_PARQUE', 'VIGILANCIA', 'ADMIN_BODEGA'] },
  { to: '/configuracion', label: 'Configuración', roles: ['SUPER_ADMIN', 'ADMIN_PARQUE', 'ADMIN_BODEGA', 'VIGILANCIA'] },
];

const ROL_LABEL: Record<Rol, string> = {
  SUPER_ADMIN: 'Super administrador',
  ADMIN_PARQUE: 'Administrador del parque',
  ADMIN_BODEGA: 'Administrador de bodega',
  VIGILANCIA: 'Vigilancia',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const items = NAV.filter((n) => n.roles.includes(user.rol));

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col bg-slate-900 text-slate-300">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-teal-500 font-bold text-white">
            T
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">THINKTECH</div>
            <div className="text-[11px] text-slate-400">Control de acceso</div>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-teal-600 font-medium text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="mb-2 text-sm font-medium text-white">{user.nombre}</div>
          <div className="mb-3 text-xs text-slate-400">{ROL_LABEL[user.rol]}</div>
          <button
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="w-full rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden bg-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
