import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { post } from '../lib/api';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/relay', label: 'Relay' },
  { to: '/app/billing', label: 'Billing' },
  { to: '/app/settings', label: 'Settings' },
];

export function Nav() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin' || user?.role === 'sa';

  async function handleSignOut() {
    try {
      await post('/api/auth/logout', {});
    } catch {
      // ignore — clear local state regardless
    }
    setUser(null);
    navigate('/');
  }

  return (
    <nav className="border-b border-brand-border bg-brand-surface px-6 py-3 flex items-center justify-between">
      <NavLink
        to="/dashboard"
        className="font-hand text-xl font-bold text-brand-ink hover:text-brand-accent transition-colors"
      >
        Aegis DMS
      </NavLink>

      <div className="flex items-center gap-4">
        {NAV_LINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `font-sans text-sm transition-colors ${
                isActive
                  ? 'text-brand-ink font-semibold'
                  : 'text-brand-muted hover:text-brand-accent'
              }`
            }
          >
            {label}
          </NavLink>
        ))}

        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `font-sans text-sm transition-colors ${
                isActive
                  ? 'text-brand-ink font-semibold'
                  : 'text-brand-muted hover:text-brand-accent'
              }`
            }
          >
            Admin
          </NavLink>
        )}

        <button
          onClick={handleSignOut}
          className="font-sans text-sm text-brand-muted hover:text-brand-danger transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
