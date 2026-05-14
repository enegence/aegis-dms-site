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
import Release from './pages/app/Release';
import Billing from './pages/app/Billing';
import Onboarding from './pages/app/Onboarding';
import Landing from './pages/marketing/Landing';
import Pricing from './pages/marketing/Pricing';
import ClaimLanding from './pages/claim/ClaimLanding';
import ClaimVerify from './pages/claim/ClaimVerify';
import ClaimAccept from './pages/claim/ClaimAccept';
import ClaimDownload from './pages/claim/ClaimDownload';
import ClaimAcknowledge from './pages/claim/ClaimAcknowledge';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminRelay from './pages/admin/AdminRelay';
import AdminReleaseRuns from './pages/admin/AdminReleaseRuns';

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
        <Route path="/app/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/estate" element={<ProtectedRoute><Estate /></ProtectedRoute>} />
        <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
        <Route path="/switches" element={<ProtectedRoute><Trigger /></ProtectedRoute>} />
        <Route path="/relay" element={<ProtectedRoute><Relay /></ProtectedRoute>} />
        <Route path="/release" element={<ProtectedRoute><Release /></ProtectedRoute>} />

        {/* Admin (protected — role checked server-side) */}
        <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/relay" element={<ProtectedRoute><AdminRelay /></ProtectedRoute>} />
        <Route path="/admin/release-runs" element={<ProtectedRoute><AdminReleaseRuns /></ProtectedRoute>} />

        {/* Claim portal (public — no auth required) */}
        <Route path="/claim/:token" element={<ClaimLanding />} />
        <Route path="/claim/:token/verify" element={<ClaimVerify />} />
        <Route path="/claim/:token/accept" element={<ClaimAccept />} />
        <Route path="/claim/:token/download" element={<ClaimDownload />} />
        <Route path="/claim/:token/acknowledge" element={<ClaimAcknowledge />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} />} />
      </Routes>
    </AuthContext.Provider>
  );
}

export default App;
