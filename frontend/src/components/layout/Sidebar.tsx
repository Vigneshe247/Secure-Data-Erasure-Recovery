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
      { id: 'shred',        label: 'File / Data Shred',    icon: Trash2,     show: true, badge: 'NEW', danger: true },
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
    <aside style={{
      width: 216,
      background: '#0d0f14',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      minHeight: 'calc(100vh - 56px)',
      padding: '16px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      flexShrink: 0,
    }}>
      {GROUPS.map((group) => {
        const visible = group.items.filter((i) =>
          (i as any).show !== undefined ? (i as any).show : hasPermission((i as any).perm)
        );
        if (!visible.length) return null;
        return (
          <div key={group.label} style={{ marginBottom: 12 }}>
            <div style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: '#4d5a6a', padding: '6px 10px 4px', userSelect: 'none',
            }}>
              {group.label}
            </div>
            {visible.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isDanger = (item as any).danger;
              return (
                <button key={item.id} onClick={() => setActiveTab(item.id)}
                  className={`ds-nav-item${isActive ? ' active' : ''}`}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none' }}>
                  <Icon size={14} style={{ flexShrink: 0, color: isActive ? '#60a5fa' : isDanger ? '#f87171' : '#4d5a6a' }} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {(item as any).badge && !isActive && (
                    <span style={{
                      fontFamily: 'Barlow Condensed,sans-serif', fontSize: 8, fontWeight: 700,
                      letterSpacing: '0.12em', padding: '1px 5px', borderRadius: 3,
                      background: 'rgba(45,127,249,0.1)', color: '#60a5fa',
                      border: '1px solid rgba(45,127,249,0.2)',
                    }}>
                      {(item as any).badge}
                    </span>
                  )}
                  {isActive && <ChevronRight size={11} color="#3b82f6" />}
                </button>
              );
            })}
          </div>
        );
      })}

      {/* Sandbox guard */}
      <div style={{
        marginTop: 'auto',
        padding: '12px', borderRadius: 9,
        background: 'rgba(34,197,94,0.06)',
        border: '1px solid rgba(34,197,94,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <ShieldAlert size={12} color="#22c55e" />
          <span style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4ade80' }}>
            Sandbox Active
          </span>
        </div>
        <p style={{ fontSize: 10, color: '#8b96a8', lineHeight: 1.5 }}>
          All destructive operations are isolated in sandboxed <code style={{ fontSize: 9, color: '#22c55e' }}>.img</code> containers.
        </p>
      </div>
    </aside>
  );
};
