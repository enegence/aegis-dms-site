interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  role: string;
  timezone: string;
  totpEnabled: boolean;
  createdAt: string;
}

interface UserTableProps {
  users: AdminUser[];
}

export default function UserTable({ users }: UserTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm font-sans border border-brand-border rounded-lg overflow-hidden">
        <thead className="bg-brand-surface text-brand-muted">
          <tr>
            <th className="px-4 py-2 text-left">Email</th>
            <th className="px-4 py-2 text-left">Display Name</th>
            <th className="px-4 py-2 text-left">Role</th>
            <th className="px-4 py-2 text-left">Verified</th>
            <th className="px-4 py-2 text-left">TOTP</th>
            <th className="px-4 py-2 text-left">Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-brand-muted">No users.</td>
            </tr>
          )}
          {users.map(u => (
            <tr key={u.id} className="border-t border-brand-border hover:bg-brand-surface/50">
              <td className="px-4 py-2 text-brand-ink">{u.email}</td>
              <td className="px-4 py-2 text-brand-muted">{u.displayName}</td>
              <td className="px-4 py-2">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  u.role === 'admin' || u.role === 'sa'
                    ? 'bg-brand-accent text-white'
                    : 'bg-brand-surface text-brand-muted'
                }`}>
                  {u.role}
                </span>
              </td>
              <td className="px-4 py-2">
                {u.emailVerified
                  ? <span className="text-green-600 font-semibold">Yes</span>
                  : <span className="text-brand-muted">No</span>}
              </td>
              <td className="px-4 py-2">
                {u.totpEnabled
                  ? <span className="text-green-600 font-semibold">On</span>
                  : <span className="text-brand-muted">Off</span>}
              </td>
              <td className="px-4 py-2 text-brand-muted">
                {new Date(u.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
