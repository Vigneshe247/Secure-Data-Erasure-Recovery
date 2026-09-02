import React from 'react';
import {
  LayoutDashboard, HardDrive, FileSearch, Trash2,
  CheckCheck, History, FileText, Users, FlaskConical,
  ShieldAlert, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const GROUPS = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard',     icon: LayoutDashboard, show: true, badge: 'LIVE' },
      { id: 'demolab',   label: 'SIH Demo Lab',  icon: FlaskConical,    show: true, badge: 'TRY' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'storage',      label: 'Storage Analyzer',     icon: HardDrive,  perm: 'storage.view' },
      { id: 'recovery',     label: 'File Recovery',        icon: FileSearch, perm: 'recovery.scan' },
      { id: 'erasure',      label: 'Secure Erasure',       icon: Trash2,     perm: 'erasure.request', danger: true },
      { id: 'shred',        label: 'File / Data Delete',    icon: Trash2,     show: true, badge: 'NEW', danger: true },
      { id: 'verification', label: 'Post-Erasure Verify',  icon: CheckCheck, perm: 'verification.view' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { id: 'reports', label: 'Reports',       icon: FileText, perm: 'reports.view' },
      { id: 'audit',   label: 'Audit Trail',   icon: History,  perm: 'audit.view' },
      { id: 'users',   label: 'Users',         icon: Users,    perm: 'users.manage' },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { hasPermission } = useAuth();

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
        const visible = group.items.filter((i) =>
          (i as any).show !== undefined ? (i as any).show : hasPermission((i as any).perm)
        );
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

      {/* Sandbox guard banner */}
      <div
        style={{
          marginTop: 'auto',
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
