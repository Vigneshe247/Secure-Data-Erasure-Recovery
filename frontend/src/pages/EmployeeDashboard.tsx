import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { EnterpriseFile, RecoveryRequest } from '../types';
import { ShieldAlert, Trash2, Download, UploadCloud, RefreshCw, FileText, Lock, FileSearch } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState<EnterpriseFile[]>([]);
  const [requests, setRequests] = useState<RecoveryRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [recoveryTarget, setRecoveryTarget] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [filesData] = await Promise.all([
        api.getEmployeeFiles(),
      ]);
      setFiles(filesData);
      
      // Fetch recovery requests for files that are in recoverable states
      const recoverable = filesData.filter(f => ['ADMIN_RECOVERABLE', 'RECOVERY_REQUESTED'].includes(f.status));
      const reqs: RecoveryRequest[] = [];
      for (const f of recoverable) {
        const fileReqs = await api.getFileRecoveryRequests(f.id);
        reqs.push(...fileReqs);
      }
      setRequests(reqs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      await api.uploadEmployeeFile(selectedFile);
      setSelectedFile(null);
      fetchData();
    } catch (err) {
      alert('Upload failed.');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      const blob = await api.downloadEmployeeFile(fileId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Download failed. File might be restricted.');
    }
  };

  const handleDelete = async () => {
    if (!fileToDelete) return;
    try {
      await api.deleteEmployeeFile(fileToDelete);
      setFileToDelete(null);
      showNotification('File securely deleted and moved to quarantine vault.', 'success');
      fetchData();
    } catch (err) {
      showNotification('Delete failed.', 'error');
    }
  };

  const submitRecoveryRequest = async () => {
    if (!recoveryTarget) return;
    try {
      await api.createRecoveryRequest(recoveryTarget, reasonText);
      setRecoveryTarget(null);
      setReasonText('');
      fetchData();
    } catch (err) {
      alert('Failed to submit recovery request.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <span style={{ padding: '4px 10px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>ACTIVE</span>;
      case 'RECOVERED': return <span style={{ padding: '4px 10px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>RECOVERED</span>;
      case 'RECOVERY_APPROVED': return <span style={{ padding: '4px 10px', background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>RECOVERY APPROVED</span>;
      case 'ADMIN_RECOVERABLE': return <span style={{ padding: '4px 10px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>RESTRICTED (VAULT)</span>;
      case 'RECOVERY_REQUESTED': return <span style={{ padding: '4px 10px', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>PENDING RECOVERY</span>;
      case 'PURGE_IN_PROGRESS': return <span style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>PURGING</span>;
      case 'PURGED': return <span style={{ padding: '4px 10px', background: 'rgba(107,114,128,0.1)', color: '#6b7280', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>PURGED</span>;
      default: return <span>{status}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--c-text)', margin: '0 0 8px' }}>
            My Workspace
          </h1>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--c-text-muted)', margin: 0, fontSize: 15 }}>
            Manage your files within the Zero-Trust Data Lifecycle.
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <div style={{ background: 'var(--c-surface)', borderRadius: 16, border: '1px solid var(--c-border)', padding: 24 }}>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--c-text)', margin: '0 0 16px' }}>
          Upload File
        </h2>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <input 
            type="file" 
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            style={{ padding: '8px 12px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-bg)', color: 'var(--c-text)' }}
          />
          <button 
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            style={{ 
              background: 'var(--c-accent)', color: '#fff', border: 'none', padding: '10px 20px', 
              borderRadius: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
              cursor: (!selectedFile || isUploading) ? 'not-allowed' : 'pointer', opacity: (!selectedFile || isUploading) ? 0.6 : 1
            }}
          >
            {isUploading ? <RefreshCw size={18} className="spin" /> : <UploadCloud size={18} />}
            Upload
          </button>
        </div>
      </div>

      {/* Files List */}
      <div style={{ background: 'var(--c-surface)', borderRadius: 16, border: '1px solid var(--c-border)', overflow: 'hidden' }}>
        <div style={{ padding: 24, borderBottom: '1px solid var(--c-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--c-text)', margin: 0 }}>
            My Files
          </h2>
          <button onClick={fetchData} style={{ background: 'none', border: 'none', color: 'var(--c-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--c-bg)', borderBottom: '1px solid var(--c-border)' }}>
                <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>File Name</th>
                <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>Size</th>
                <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>Status</th>
                <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>Uploaded</th>
                <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map(file => (
                <tr key={file.id} style={{ borderBottom: '1px solid var(--c-border)' }}>
                  <td style={{ padding: '16px 24px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <FileText size={18} color="var(--c-text-muted)" />
                    {file.original_filename}
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 14 }}>
                    {(file.file_size / 1024).toFixed(1)} KB
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {getStatusBadge(file.status)}
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 14 }}>
                    {new Date(file.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      {file.status === 'ACTIVE' ? (
                        <>
                          <button onClick={() => handleDownload(file.id, file.original_filename)} style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                            <Download size={14} /> Download
                          </button>
                          <button onClick={() => setFileToDelete(file.id)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </>
                      ) : (
                        file.status === 'ADMIN_RECOVERABLE' ? (
                           <button onClick={() => setRecoveryTarget(file.id)} style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                             <ShieldAlert size={14} /> Request Recovery
                           </button>
                        ) : (
                          <span style={{ fontSize: 13, color: 'var(--c-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Lock size={14} /> Restricted
                          </span>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {files.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--c-text-muted)' }}>
                    No files found. Upload a file to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Recovery Request Modal */}
      {recoveryTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30, 34, 41, 0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="ds-card" style={{ maxWidth: 460, width: '100%', padding: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Request File Recovery</h2>
            <p style={{ color: 'var(--c-text-muted)', fontSize: 14, marginBottom: 16 }}>
              Provide a valid business justification for recovering this file from the quarantine vault.
            </p>
            <textarea
              value={reasonText}
              onChange={e => setReasonText(e.target.value)}
              placeholder="e.g. Needed for Q3 audit..."
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', minHeight: 100, marginBottom: 16, fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setRecoveryTarget(null)} className="ds-btn ds-btn-ghost">Cancel</button>
              <button onClick={submitRecoveryRequest} disabled={!reasonText} className="ds-btn ds-btn-primary">Submit Request</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {fileToDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30, 34, 41, 0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="ds-card" style={{ maxWidth: 400, width: '100%', padding: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#DC2626' }}>Confirm Deletion</h2>
            <p style={{ color: 'var(--c-text-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              Are you sure you want to delete this file? It will be moved to the quarantine vault and can only be restored via an admin-approved recovery request.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setFileToDelete(null)} className="ds-btn ds-btn-ghost">Cancel</button>
              <button onClick={handleDelete} className="ds-btn ds-btn-primary" style={{ background: '#DC2626' }}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '16px 20px', borderRadius: 8, zIndex: 200,
          background: notification.type === 'success' ? '#10b981' : '#ef4444', color: '#fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontWeight: 600, fontSize: 14
        }}>
          {notification.message}
        </div>
      )}
    </div>
  );
};
