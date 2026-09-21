import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AuditBlock, ChainVerificationResponse } from '../types';
import { Link as LinkIcon, RefreshCw, CheckCircle, XCircle, Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuditBlockchain: React.FC = () => {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState<AuditBlock[]>([]);
  const [verification, setVerification] = useState<ChainVerificationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await api.getAuditBlocks(200); // fetch last 200 blocks
      setBlocks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const result = await api.verifyAuditChain();
      setVerification(result);
    } catch (err) {
      alert('Failed to verify audit chain.');
    } finally {
      setIsVerifying(false);
    }
  };

  const filteredBlocks = blocks.filter(b => 
    b.hash.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.event_type.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (b.target_file_id && b.target_file_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (b.actor_id && b.actor_id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--c-text)', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <LinkIcon size={32} color="#22c55e" /> Immutable Audit Ledger
          </h1>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--c-text-muted)', margin: 0, fontSize: 15 }}>
            Cryptographically verifiable record of all lifecycle events in the Zero-Trust system.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handleVerify} disabled={isVerifying} style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', padding: '10px 20px', borderRadius: 8, cursor: isVerifying ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
            {isVerifying ? <RefreshCw size={18} className="spin" /> : <ShieldCheck size={18} />}
            Verify Integrity
          </button>
          <button onClick={fetchData} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text)', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Verification Result Banner */}
      {verification && (
        <div style={{ padding: 20, borderRadius: 12, border: `1px solid ${verification.valid ? '#22c55e' : '#ef4444'}`, background: verification.valid ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', display: 'flex', alignItems: 'center', gap: 16 }}>
          {verification.valid ? <CheckCircle size={32} color="#22c55e" /> : <XCircle size={32} color="#ef4444" />}
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, color: verification.valid ? '#22c55e' : '#ef4444', fontWeight: 800 }}>
              {verification.valid ? 'Blockchain Integrity Verified' : 'Blockchain Integrity Compromised!'}
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--c-text-muted)' }}>
              {verification.valid 
                ? `Successfully verified ${verification.blocks_checked} sequential cryptographic blocks. No tampering detected.` 
                : `Tampering detected! Error: ${verification.error}`}
            </p>
          </div>
        </div>
      )}

      {/* Main Ledger UI */}
      <div style={{ background: 'var(--c-surface)', borderRadius: 16, border: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 24, borderBottom: '1px solid var(--c-border)', display: 'flex', gap: 16 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} color="var(--c-text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search by hash, event type, actor, or file ID..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 42px', borderRadius: 8, border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}>Syncing blockchain ledger...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ background: 'var(--c-bg)', borderBottom: '1px solid var(--c-border)' }}>
                  <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>Block #</th>
                  <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>Event Type</th>
                  <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>Actor</th>
                  <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>Target File ID</th>
                  <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>Timestamp (UTC)</th>
                  <th style={{ padding: '16px 24px', color: 'var(--c-text-muted)', fontSize: 13, fontWeight: 600 }}>SHA-256 Hash / Link</th>
                </tr>
              </thead>
              <tbody>
                {filteredBlocks.map(block => (
                  <tr key={block.id} style={{ borderBottom: '1px solid var(--c-border)' }}>
                    <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: 14, fontWeight: 800, color: 'var(--c-text)' }}>
                      {block.index}
                    </td>
                    <td style={{ padding: '16px 24px', fontWeight: 600, fontSize: 13 }}>
                      {block.event_type}
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--c-text-muted)' }}>
                      {block.actor_id === 'SYSTEM' ? <span style={{ color: '#ef4444', fontWeight: 600 }}>SYSTEM</span> : (
                        <span>{block.actor_id} <span style={{ opacity: 0.5 }}>({block.actor_role})</span></span>
                      )}
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--c-text-muted)' }}>
                      {block.target_file_id || '-'}
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--c-text-muted)' }}>
                      {new Date(block.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e' }}>
                          <LinkIcon size={12} /> {block.hash}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--c-text-muted)', fontSize: 11 }}>
                          Prev: {block.previous_hash}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredBlocks.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--c-text-muted)' }}>
                      No blocks found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
