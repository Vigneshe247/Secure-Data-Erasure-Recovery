import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { EnterpriseFile, RecoveryRequest } from '../types';
import { ShieldCheck, ShieldAlert, Trash2, CheckCircle, XCircle, RefreshCw, FileText, Lock, User as UserIcon, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const RecoveryVault: React.FC = () => {
  const { user } = useAuth();
  const [vaultFiles, setVaultFiles] = useState<EnterpriseFile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RecoveryRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionNotes, setActionNotes] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<RecoveryRequest | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [filesData, requestsData] = await Promise.all([
        api.getRecoveryVault(),
        api.getPendingRecoveryRequests(),
      ]);
      setVaultFiles(filesData);
      setPendingRequests(requestsData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async () => {
    if (!selectedRequest) return;
    try {
      await api.approveRecoveryRequest(selectedRequest.id, actionNotes);
      setSelectedRequest(null);
      setActionNotes('');
      fetchData();
    } catch (err) {
      alert('Approval failed.');
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    try {
      await api.rejectRecoveryRequest(selectedRequest.id, actionNotes);
      setSelectedRequest(null);
      setActionNotes('');
      fetchData();
    } catch (err) {
      alert('Rejection failed.');
    }
  };

  const handleAdminRecover = async (fileId: string) => {
    if (!confirm('Are you sure you want to recover this file directly from the vault without a user request?')) return;
    try {
      await api.adminRecoverFile(fileId);
      fetchData();
    } catch (err) {
      alert('Direct recovery failed.');
    }
  };

  const handlePurge = async (fileId: string) => {
    if (!confirm('WARNING: Are you sure you want to PERMANENTLY DESTROY this file? This will trigger the secure erasure pipeline.')) return;
    try {
      const res = await api.adminPurgeFile(fileId, 'SIMULATED_SECURE_ERASURE');
      alert(`File purged successfully. Verification: ${res.verified ? 'PASSED' : 'FAILED'}`);
      fetchData();
    } catch (err) {
      alert('Purge failed.');
    }
  };

  const handleHoldToggle = async (fileId: string, currentHold: boolean) => {
    try {
      await api.setRetentionHold(fileId, !currentHold);
      fetchData();
    } catch (err) {
      alert('Failed to update retention hold.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--c-text)', margin: '0 0 8px' }}>
            Zero-Trust Recovery Vault
          </h1>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--c-text-muted)', margin: 0, fontSize: 15 }}>
            Manage quarantined files, handle employee recovery requests, and execute secure purges.
          </p>
        </div>
        <button onClick={fetchData} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text)', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Pending Requests Section */}
      <div style={{ background: 'var(--c-surface)', borderRadius: 16, border: '1px solid var(--c-border)', overflow: 'hidden' }}>
        <div style={{ padding: 24, borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={18} color="#8b5cf6" />
          </div>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--c-text)', margin: 0 }}>
            Pending Recovery Requests ({pendingRequests.length})
          </h2>
        </div>

        {pendingRequests.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}>No pending requests.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16, padding: 24 }}>
            {pendingRequests.map(req => (
              <div key={req.id} style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                    <FileText size={16} color="var(--c-text-muted)" />
                    {req.filename}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{new Date(req.requested_at).toLocaleDateString()}</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--c-text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <UserIcon size={14} /> Requested by: <strong>{req.employee_username}</strong>
                </div>
                <div style={{ background: 'var(--c-surface)', padding: 12, borderRadius: 8, fontSize: 13, color: 'var(--c-text)', marginBottom: 16, fontStyle: 'italic' }}>
                  "{req.reason}"
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setSelectedRequest(req); setActionType('APPROVE'); }} style={{ flex: 1, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: 'none', padding: '8px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                    <CheckCircle size={16} /> Approve
                  </button>
                  <button onClick={() => { setSelectedRequest(req); setActionType('REJECT'); }} style={{ flex: 1, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', padding: '8px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                    <XCircle size={16} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quarantined Vault Files List */}
      <div style={{ background: 'var(--c-surface)', borderRadius: 16, border: '1px solid var(--c-border)', overflow: 'hidden' }}>
        <div style={{ padding: 24, borderBottom: '1px solid var(--c-border)' }}>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--c-text)', margin: 0 }}>
            Quarantined Files Inventory
          </h2>
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--c-bg)', borderBottom: '1px solid var(--c-border)' }}>
                <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>File Name</th>
                <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>Owner</th>
                <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>Status</th>
                <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>Retention Expires</th>
                <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600, textAlign: 'right' }}>Admin Actions</th>
              </tr>
            </thead>
            <tbody>
              {vaultFiles.map(file => (
                <tr key={file.id} style={{ borderBottom: '1px solid var(--c-border)' }}>
                  <td style={{ padding: '16px 24px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Lock size={16} color="#f59e0b" />
                    <div>
                      <div>{file.original_filename}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-muted)', fontFamily: 'monospace' }}>SHA: {file.sha256_hash.substring(0, 16)}...</div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 14 }}>
                    {file.owner_username || 'Unknown'}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                     <span style={{ padding: '4px 8px', background: file.status === 'RECOVERY_REQUESTED' ? 'rgba(139,92,246,0.1)' : 'rgba(245,158,11,0.1)', color: file.status === 'RECOVERY_REQUESTED' ? '#8b5cf6' : '#f59e0b', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                        {file.status}
                     </span>
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--c-text-muted)' }}>
                    {file.retention_expires_at ? new Date(file.retention_expires_at).toLocaleDateString() : 'N/A'}
                    {file.retention_hold && (
                      <span style={{ marginLeft: 8, padding: '2px 6px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>HOLD</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => handleHoldToggle(file.id, file.retention_hold)} style={{ background: 'var(--c-bg)', color: 'var(--c-text)', border: '1px solid var(--c-border)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                        {file.retention_hold ? 'Release Hold' : 'Set Hold'}
                      </button>
                      <button onClick={() => handleAdminRecover(file.id)} style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 12 }}>
                        <ShieldCheck size={14} /> Recover
                      </button>
                      <button onClick={() => handlePurge(file.id)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 12 }}>
                        <Trash2 size={14} /> Purge
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {vaultFiles.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--c-text-muted)' }}>
                    No files currently in the vault.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Review Modal */}
      {selectedRequest && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--c-surface)', width: 440, borderRadius: 16, padding: 24, border: '1px solid var(--c-border)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 20, fontFamily: 'Plus Jakarta Sans', fontWeight: 800 }}>
              {actionType === 'APPROVE' ? 'Approve Recovery' : 'Reject Recovery'}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--c-text-muted)' }}>
              Add optional notes for the audit log regarding this {actionType === 'APPROVE' ? 'approval' : 'rejection'}.
            </p>
            <textarea
              value={actionNotes}
              onChange={e => setActionNotes(e.target.value)}
              placeholder="Admin notes (optional)..."
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', minHeight: 100, marginBottom: 16, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => { setSelectedRequest(null); setActionNotes(''); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--c-border)', background: 'transparent', color: 'var(--c-text)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={actionType === 'APPROVE' ? handleApprove : handleReject} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: actionType === 'APPROVE' ? '#22c55e' : '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                Confirm {actionType === 'APPROVE' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
