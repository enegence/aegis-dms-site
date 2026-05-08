import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import { get } from './lib/api';
import Register from './pages/auth/Register';
import Login from './pages/auth/Login';
import RequestReset from './pages/auth/RequestReset';
import ResetPassword from './pages/auth/ResetPassword';
import Dashboard from './pages/app/Dashboard';
import Estate from './pages/app/Estate';
import Contacts from './pages/app/Contacts';
import Trigger from './pages/app/Trigger';
import Relay from './pages/app/Relay';
import Landing from './pages/marketing/Landing';
import Pricing from './pages/marketing/Pricing';

interface AuthUser {
  id: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  timezone: string;
}

interface AuthContextType {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, setUser: () => {} });
export const useAuth = () => useContext(AuthContext);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<AuthUser>('/api/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-hand text-3xl text-brand-muted">
        Loading...
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <Routes>
        {/* Public marketing */}
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />

        {/* Auth */}
        <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/forgot-password" element={<RequestReset />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* App (protected) */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/estate" element={<ProtectedRoute><Estate /></ProtectedRoute>} />
        <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
        <Route path="/switches" element={<ProtectedRoute><Trigger /></ProtectedRoute>} />
        <Route path="/relay" element={<ProtectedRoute><Relay /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} />} />
      </Routes>
    </AuthContext.Provider>
  );
}

export default App;
