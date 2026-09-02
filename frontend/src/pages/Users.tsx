import React, { useEffect, useState } from 'react';
import { Users as UsersIcon, UserPlus, Shield, CheckCircle2, Trash2, Key, Mail, User, X } from 'lucide-react';
import { api } from '../services/api';
import { User as UserType, Role } from '../types';

export const Users: React.FC = () => {
  const [userList, setUserList] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);

  // New user state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('demo_user');
  const [fullName, setFullName] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUserList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser({
        username,
        email,
        password,
        role,
        full_name: fullName,
      });
      setIsModalOpen(false);
      setUsername('');
      setEmail('');
      setPassword('');
      setFullName('');
      await loadUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (userId: string, uname: string) => {
    if (!confirm(`Are you sure you want to delete user ${uname}?`)) return;
    try {
      await api.deleteUser(userId);
      await loadUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const roleAccents: Record<string, string> = {
    admin: '#ef4444',
    security_admin: '#2d7ff9',
    forensic_analyst: '#f59e0b',
    auditor: '#22c55e',
    demo_user: '#818cf8',
  };

  return (
    <div className="ds-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="ds-section-label" style={{ justifyContent: 'flex-start', marginBottom: 6 }}>
            Role-Based Access Control &amp; User Directory
          </div>
          <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 32, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#f0f4ff' }}>
            User Management
          </h1>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="ds-btn ds-btn-primary"
        >
          <UserPlus size={14} /> Provision New User
        </button>
      </div>

      {/* Users Table */}
      <div className="ds-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="ds-table">
            <thead>
              <tr>
                {['User Identity', 'Email Address', 'Assigned Role', 'Access Status', 'Created Date', 'Actions'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {userList.map((u) => {
                const accent = roleAccents[u.role] || '#8b96a8';
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: `${accent}18`, border: `1px solid ${accent}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 13 }}>
                          {u.username[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 14, color: '#f0f4ff' }}>
                            {u.username}
                          </div>
                          {u.full_name && (
                            <div style={{ fontSize: 11, color: '#8b96a8' }}>{u.full_name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: '#8b96a8' }}>{u.email}</td>
                    <td>
                      <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 4, background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}>
                        {u.role.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className="ds-badge ds-badge-green">
                        <span className="ds-dot ds-dot-green" style={{ width: 5, height: 5 }} /> ACTIVE
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#4d5a6a' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.username)}
                        style={{
                          background: 'none',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 6,
                          padding: '5px 8px',
                          color: '#4d5a6a',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#ef4444'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#4d5a6a'; }}
                        title="Delete User"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision User Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="ds-card" style={{ maxWidth: 440, width: '100%', padding: 24, borderTop: '3px solid #2d7ff9' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={16} color="#2d7ff9" />
                <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f0f4ff' }}>
                  Provision User Account
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b96a8' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8b96a8', marginBottom: 4 }}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="analyst_02"
                  className="ds-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8b96a8', marginBottom: 4 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="analyst@datashield.sih"
                  className="ds-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8b96a8', marginBottom: 4 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe (Forensic Lead)"
                  className="ds-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8b96a8', marginBottom: 4 }}>
                  Initial Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="ds-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8b96a8', marginBottom: 4 }}>
                  Assigned RBAC Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="ds-input"
                  style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 13, fontWeight: 700 }}
                >
                  <option value="admin">Administrator (Full Privileges)</option>
                  <option value="security_admin">IT / Security Administrator</option>
                  <option value="forensic_analyst">Forensic / Recovery Analyst</option>
                  <option value="auditor">Auditor (Read-Only)</option>
                  <option value="demo_user">Demo User (Evaluation Access)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="ds-btn ds-btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ds-btn ds-btn-primary"
                >
                  Provision User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
