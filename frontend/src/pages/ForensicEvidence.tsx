import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ForensicEvidence as ForensicEvidenceType, EnterpriseFile } from '../types';
import { Search, FileSearch, ShieldCheck, Activity, Link as LinkIcon, AlertCircle } from 'lucide-react';

export const ForensicEvidence: React.FC = () => {
  const [files, setFiles] = useState<EnterpriseFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [evidence, setEvidence] = useState<ForensicEvidenceType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load all files so the analyst can select one
    api.getEmployeeFiles().then(setFiles).catch(console.error);
  }, []);

  const fetchEvidence = async (id: string) => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    setEvidence(null);
    try {
      const data = await api.getForensicEvidence(id);
      setEvidence(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load forensic evidence');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--c-text)', margin: '0 0 8px' }}>
          File Forensic Evidence
        </h1>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--c-text-muted)', margin: 0, fontSize: 15 }}>
          Investigate enterprise files, verify magic bytes, and audit the cryptographic chain-of-custody.
        </p>
      </div>

      {/* Search/Select */}
      <div style={{ background: 'var(--c-surface)', padding: 24, borderRadius: 16, border: '1px solid var(--c-border)', display: 'flex', gap: 16, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--c-text-muted)', marginBottom: 8 }}>Select Quarantined File</label>
          <select 
            value={selectedFileId} 
            onChange={e => setSelectedFileId(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
          >
            <option value="">-- Select a file --</option>
            {files.map(f => (
              <option key={f.id} value={f.id}>{f.original_filename} [Owner: {f.owner_id.substring(0, 8)}] (SHA: {f.sha256_hash.substring(0,8)}...)</option>
            ))}
          </select>
        </div>
        <button 
          onClick={() => fetchEvidence(selectedFileId)}
          disabled={!selectedFileId || isLoading}
          style={{ padding: '10px 24px', borderRadius: 8, background: 'var(--c-accent)', color: '#fff', border: 'none', fontWeight: 600, cursor: (!selectedFileId || isLoading) ? 'not-allowed' : 'pointer', opacity: (!selectedFileId || isLoading) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <FileSearch size={18} /> Analyze
        </button>
      </div>

      {error && (
        <div style={{ padding: 16, background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}>Compiling forensic evidence...</div>}

      {evidence && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {/* File Metadata */}
            <div style={{ background: 'var(--c-surface)', padding: 24, borderRadius: 16, border: '1px solid var(--c-border)' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 18, fontFamily: 'Plus Jakarta Sans', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSearch size={20} color="var(--c-accent)" /> Metadata Analysis
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--c-text-muted)', fontSize: 14 }}>Filename</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{evidence.filename}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--c-text-muted)', fontSize: 14 }}>Size</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{(evidence.file_size / 1024).toFixed(2)} KB</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--c-text-muted)', fontSize: 14 }}>MIME Type</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{evidence.mime_type || 'Unknown'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--c-text-muted)', fontSize: 14 }}>Status</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{evidence.status}</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={{ color: 'var(--c-text-muted)', fontSize: 14, display: 'block', marginBottom: 4 }}>SHA-256 Hash</span>
                  <div style={{ padding: '8px 12px', background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: 8, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                    {evidence.sha256_hash}
                  </div>
                </div>
              </div>
            </div>

            {/* Forensic Signatures */}
            <div style={{ background: 'var(--c-surface)', padding: 24, borderRadius: 16, border: '1px solid var(--c-border)' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 18, fontFamily: 'Plus Jakarta Sans', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={20} color="#8b5cf6" /> Cryptographic Signatures
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--c-text-muted)', fontSize: 14 }}>Detected Type</span>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#8b5cf6' }}>{evidence.detected_type || 'N/A'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--c-text-muted)', fontSize: 14, display: 'block', marginBottom: 4 }}>Magic Bytes (Hex)</span>
                  <div style={{ padding: '8px 12px', background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: 8, fontFamily: 'monospace', fontSize: 13 }}>
                    {evidence.magic_bytes || 'N/A'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--c-text-muted)', fontSize: 14, display: 'block', marginBottom: 4 }}>Magic Signature Match</span>
                  <div style={{ padding: '8px 12px', background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: 8, fontFamily: 'monospace', fontSize: 13 }}>
                    {evidence.magic_signature || 'N/A'}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <span style={{ color: 'var(--c-text-muted)', fontSize: 14 }}>Recovery Confidence</span>
                  <span style={{ fontWeight: 800, fontSize: 18, color: evidence.recovery_confidence && evidence.recovery_confidence > 90 ? '#22c55e' : '#f59e0b' }}>
                    {evidence.recovery_confidence ? `${evidence.recovery_confidence}%` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Chain of Custody */}
          <div style={{ background: 'var(--c-surface)', padding: 24, borderRadius: 16, border: '1px solid var(--c-border)', marginTop: 8 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontFamily: 'Plus Jakarta Sans', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <LinkIcon size={20} color="#22c55e" /> Immutable Chain of Custody
            </h2>
            <p style={{ fontSize: 14, color: 'var(--c-text-muted)', marginBottom: 24 }}>
              This audit trail is cryptographically linked via SHA-256 hash chaining to ensure tamper evidence.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
              {/* Vertical line connecting nodes */}
              <div style={{ position: 'absolute', left: 24, top: 20, bottom: 20, width: 2, background: 'var(--c-border)', zIndex: 0 }}></div>

              {evidence.chain_of_custody?.map((block, i) => (
                <div key={block.id} style={{ display: 'flex', gap: 24, zIndex: 1, position: 'relative' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 24, background: 'var(--c-bg)', border: '2px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: 'var(--c-text-muted)' }}>
                    {block.index}
                  </div>
                  <div style={{ flex: 1, background: 'var(--c-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--c-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--c-text)' }}>{block.event_type}</span>
                      <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{new Date(block.timestamp).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>Actor: <strong style={{ color: 'var(--c-text)' }}>{block.actor_id === 'SYSTEM' ? 'SYSTEM' : block.actor_id}</strong> ({block.actor_role})</span>
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--c-text-muted)', background: 'var(--c-surface)', padding: '8px 12px', borderRadius: 8 }}>
                      <div><strong>Hash:</strong> {block.hash}</div>
                      <div><strong>Prev:</strong> {block.previous_hash}</div>
                    </div>
                  </div>
                </div>
              ))}

              {(!evidence.chain_of_custody || evidence.chain_of_custody.length === 0) && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--c-text-muted)' }}>No audit blocks found for this file.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
