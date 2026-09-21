import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { SOCDashboardMetrics } from '../types';
import { Shield, ShieldAlert, Activity, FileCheck, Trash2, Database, AlertTriangle, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AdminSOCDashboard: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<SOCDashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await api.getSOCDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isLoading || !metrics) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}>Loading SOC Metrics...</div>;
  }

  const StatCard = ({ icon: Icon, title, value, color, subtitle }: any) => (
    <div style={{ background: 'var(--c-surface)', padding: 24, borderRadius: 16, border: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `rgba(${color}, 0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color={`rgb(${color})`} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-muted)', fontFamily: 'Plus Jakarta Sans' }}>{title}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Plus Jakarta Sans', color: 'var(--c-text)' }}>
        {value}
      </div>
      {subtitle && <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{subtitle}</div>}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--c-text)', margin: '0 0 8px' }}>
            Enterprise SOC Dashboard
          </h1>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--c-text-muted)', margin: 0, fontSize: 15 }}>
            Zero-Trust Lifecycle visibility and Governance metrics.
          </p>
        </div>
      </div>

      {/* Primary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <StatCard icon={Database} title="Total Monitored Files" value={metrics.total_files} color="59, 130, 246" />
        <StatCard icon={FileCheck} title="Active Storage" value={metrics.active_files} color="34, 197, 94" />
        <StatCard icon={ShieldAlert} title="Quarantined (Vault)" value={metrics.recoverable_files} color="245, 158, 11" subtitle={`${metrics.pending_recovery_requests} Pending Requests`} />
        <StatCard icon={Trash2} title="Securely Purged" value={metrics.files_purged} color="239, 68, 68" />
      </div>

      {/* Compliance & Audit Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Blockchain Status */}
        <div style={{ background: 'var(--c-surface)', padding: 24, borderRadius: 16, border: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LinkIcon size={24} color={metrics.audit_chain_status === 'VALID' ? '#22c55e' : '#ef4444'} />
            <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'Plus Jakarta Sans', fontWeight: 700 }}>Blockchain Ledger Status</h2>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: 'var(--c-text-muted)' }}>Chain Integrity</span>
            <span style={{ padding: '6px 12px', background: metrics.audit_chain_status === 'VALID' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: metrics.audit_chain_status === 'VALID' ? '#22c55e' : '#ef4444', borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
              {metrics.audit_chain_status}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: 'var(--c-text-muted)' }}>Blocks Verified</span>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{metrics.audit_blocks_count}</span>
          </div>
        </div>

        {/* Retention Alerts */}
        <div style={{ background: 'var(--c-surface)', padding: 24, borderRadius: 16, border: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={24} color="#f59e0b" />
            <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'Plus Jakarta Sans', fontWeight: 700 }}>Retention Automation</h2>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--c-text-muted)' }}>
            The retention engine automatically purges quarantined files after 30 days unless a Legal Hold is active.
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: 'rgba(245,158,11,0.05)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#f59e0b' }}>Expiring within 7 Days</span>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{metrics.retention_expiring_soon} files</span>
          </div>
        </div>
      </div>

      {/* Recent Ledger Events */}
      <div style={{ background: 'var(--c-surface)', borderRadius: 16, border: '1px solid var(--c-border)', overflow: 'hidden' }}>
        <div style={{ padding: 24, borderBottom: '1px solid var(--c-border)' }}>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--c-text)', margin: 0 }}>
            Real-Time Audit Ledger
          </h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--c-bg)', borderBottom: '1px solid var(--c-border)' }}>
              <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>Idx</th>
              <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>Event</th>
              <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>Actor</th>
              <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>Timestamp (UTC)</th>
              <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>Hash</th>
            </tr>
          </thead>
          <tbody>
            {metrics.recent_events.map(ev => (
              <tr key={ev.index} style={{ borderBottom: '1px solid var(--c-border)' }}>
                <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: 13, color: 'var(--c-text-muted)' }}>{ev.index}</td>
                <td style={{ padding: '16px 24px', fontWeight: 600, fontSize: 13 }}>{ev.event_type}</td>
                <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--c-text-muted)' }}>{ev.actor_role === 'system' ? 'SYSTEM' : ev.actor_id}</td>
                <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--c-text-muted)' }}>{ev.timestamp ? new Date(ev.timestamp).toLocaleString() : 'N/A'}</td>
                <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: 12, color: 'var(--c-accent)' }}>{ev.hash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
