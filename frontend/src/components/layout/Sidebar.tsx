import React from 'react';
import {
  LayoutDashboard, HardDrive, FileSearch, Trash2,
  CheckCheck, History, FileText, Users, FlaskConical,
  ShieldAlert, ChevronRight, Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// Role-based access: each item lists which roles can see & use it.
// 'all' means every authenticated role.
const ROLE_PAGES: Record<string, string[]> = {
  dashboard:    ['all'],
  demolab:      ['admin', 'demo_user'],
  storage:      ['admin', 'security_admin', 'forensic_analyst', 'demo_user', 'auditor'],
  recovery:     ['admin', 'security_admin', 'forensic_analyst', 'demo_user'],
  erasure:      ['admin', 'security_admin'],
  shred:        ['admin', 'security_admin', 'demo_user'],
  verification: ['admin', 'security_admin', 'forensic_analyst', 'demo_user', 'auditor'],
  reports:      ['admin', 'security_admin', 'forensic_analyst', 'demo_user', 'auditor'],
  audit:        ['admin', 'security_admin', 'auditor'],
  users:        ['admin'],
};

const GROUPS = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard',    icon: LayoutDashboard, badge: 'LIVE' },
      { id: 'demolab',   label: 'SIH Demo Lab', icon: FlaskConical,    badge: 'TRY' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'storage',      label: 'Storage Analyzer',    icon: HardDrive  },
      { id: 'recovery',     label: 'File Recovery',       icon: FileSearch },
      { id: 'erasure',      label: 'Secure Erasure',      icon: Trash2,    danger: true },
      { id: 'shred',        label: 'File / Data Delete',  icon: Trash2,    badge: 'NEW', danger: true },
      { id: 'verification', label: 'Post-Erasure Verify', icon: CheckCheck },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { id: 'reports', label: 'Reports',     icon: FileText },
      { id: 'audit',   label: 'Audit Trail', icon: History  },
      { id: 'users',   label: 'Users',       icon: Users    },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user } = useAuth();
  const role = user?.role || '';

  const canAccess = (id: string): boolean => {
    const allowed = ROLE_PAGES[id] || [];
    return allowed.includes('all') || allowed.includes(role);
  };

  return (
    <aside
      style={{
        width: 236,
        background: '#FFFFFF',
        borderRight: '1px solid var(--c-border)',
        minHeight: 'calc(100vh - 60px)',
        padding: '20px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        flexShrink: 0,
      }}
    >
      {GROUPS.map((group) => {
        const visible = group.items.filter((i) => canAccess(i.id));
        if (!visible.length) return null;
        return (
          <div key={group.label} style={{ marginBottom: 16 }}>
            <div
              style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#94A3B8',
                padding: '6px 12px 6px',
                userSelect: 'none',
              }}
            >
              {group.label}
            </div>
            {visible.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isDanger = (item as any).danger;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(255, 126, 95, 0.12), rgba(254, 180, 123, 0.12))'
                      : 'transparent',
                    border: 'none',
                    borderRadius: 14,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 600,
                    color: isActive ? '#FF7E5F' : '#5E6676',
                    boxShadow: isActive ? '0 2px 10px rgba(255, 126, 95, 0.1)' : 'none',
                    transition: 'all 0.16s ease',
                    marginBottom: 2,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = '#FAF8F5';
                      (e.currentTarget as HTMLElement).style.color = '#1E2229';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = '#5E6676';
                    }
                  }}
                >
                  <Icon
                    size={16}
                    style={{
                      flexShrink: 0,
                      color: isActive ? '#FF7E5F' : isDanger ? '#EF4444' : '#94A3B8',
                    }}
                  />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {(item as any).badge && !isActive && (
                    <span
                      style={{
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        padding: '2px 7px',
                        borderRadius: 10,
                        background: '#E6EFFB',
                        color: '#2B579A',
                        border: '1px solid #D0E0F7',
                      }}
                    >
                      {(item as any).badge}
                    </span>
                  )}
                  {isActive && <ChevronRight size={14} color="#FF7E5F" />}
                </button>
              );
            })}
          </div>
        );
      })}

      {/* Role Access Badge */}
      <div
        style={{
          marginTop: 'auto',
          padding: '12px 14px',
          borderRadius: 14,
          background: role === 'admin'
            ? 'linear-gradient(135deg, rgba(255,126,95,0.1), rgba(254,180,123,0.1))'
            : role === 'auditor'
            ? 'rgba(37,99,235,0.07)'
            : role === 'forensic_analyst'
            ? 'rgba(16,163,74,0.07)'
            : '#E6EFFB',
          border: role === 'admin'
            ? '1px solid rgba(255,126,95,0.3)'
            : role === 'auditor'
            ? '1px solid rgba(37,99,235,0.2)'
            : role === 'forensic_analyst'
            ? '1px solid rgba(16,163,74,0.2)'
            : '1px solid #D0E0F7',
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
          {role === 'admin'
            ? <ShieldAlert size={14} color="#FF7E5F" />
            : <Lock size={14} color={role === 'auditor' ? '#2563EB' : role === 'forensic_analyst' ? '#16A34A' : '#94A3B8'} />
          }
          <span
            style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: role === 'admin' ? '#FF7E5F' : '#1E2229',
            }}
          >
            {role === 'admin' ? 'Full Access' :
             role === 'security_admin' ? 'SecOps Access' :
             role === 'forensic_analyst' ? 'Analyst Access' :
             role === 'auditor' ? 'Read-Only Access' :
             'Demo Access'}
          </span>
        </div>
        <p style={{ fontSize: 11, color: '#5E6676', lineHeight: 1.5, margin: 0 }}>
          {role === 'admin'
            ? 'Full system control. All operations permitted.'
            : role === 'security_admin'
            ? 'Erasure, recovery & audit access.'
            : role === 'forensic_analyst'
            ? 'Recovery & analysis only. No erasure.'
            : role === 'auditor'
            ? 'View-only: audit logs & reports.'
            : 'Sandbox demo environment.'}
        </p>
      </div>

      {/* Sandbox guard banner */}
      <div
        style={{
          padding: '14px',
          borderRadius: 14,
          background: '#E6EFFB',
          border: '1px solid #D0E0F7',
          boxShadow: '0 2px 8px rgba(30, 34, 41, 0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
          <ShieldAlert size={14} color="#16A34A" />
          <span
            style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: '#1E2229',
            }}
          >
            Sandbox Active
          </span>
        </div>
        <p style={{ fontSize: 11, color: '#5E6676', lineHeight: 1.5 }}>
          Destructive operations are isolated in sandboxed <code style={{ fontSize: 10, color: '#16A34A', fontWeight: 600 }}>.img</code> containers.
        </p>
      </div>
    </aside>
  );
};
