import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Spinner } from './lib/ui';
import Layout from './components/Layout';
import Login from './pages/Login';
import Panel from './pages/Panel';
import Personal from './pages/Personal';
import Bodegas from './pages/Bodegas';
import Usuarios from './pages/Usuarios';
import Historial from './pages/Historial';
import Configuracion from './pages/Configuracion';
import Lector from './pages/Lector';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Panel />} />
        <Route path="/personal" element={<Personal />} />
        <Route path="/bodegas" element={<Bodegas />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/historial" element={<Historial />} />
        <Route path="/lector" element={<Lector />} />
        <Route path="/configuracion" element={<Configuracion />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
