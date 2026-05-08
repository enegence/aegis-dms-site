import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import { get } from './lib/api';
import Register from './pages/auth/Register';
import Login from './pages/auth/Login';
import RequestReset from './pages/auth/RequestReset';
import ResetPassword from './pages/auth/ResetPassword';

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
        <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/forgot-password" element={<RequestReset />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={
          user ? (
            <div className="min-h-screen p-8">
              <h1 className="font-hand text-4xl font-bold mb-4">Dashboard</h1>
              <p className="font-sans text-brand-muted">Welcome, {user.displayName}. Dashboard coming soon.</p>
            </div>
          ) : <Navigate to="/login" />
        } />
        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} />} />
      </Routes>
    </AuthContext.Provider>
  );
}

export default App;
