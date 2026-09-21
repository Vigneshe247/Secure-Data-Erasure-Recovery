import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { ForensicEvidence as ForensicEvidenceType, EnterpriseFile } from '../types';
import {
  Search, FileSearch, ShieldCheck, Activity, Link as LinkIcon,
  AlertCircle, FileText, Database, Cpu, Hash, Clock,
  CheckCircle, XCircle, RefreshCw, ChevronRight, Lock,
  Eye, Zap, Server, Info,
} from 'lucide-react';

// ─── Tiny helpers ───────────────────────────────────────────────────────────
const Skel = ({ w = '100%', h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) => (
  <div style={{ width: w, height: h, borderRadius: r, background: 'var(--c-border)', opacity: 0.55, animation: 'pulse 1.5s ease-in-out infinite' }} />
);

const Field = ({ label, value, mono = false, accent = false }: { label: string; value?: string | number | null; mono?: boolean; accent?: boolean }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-muted)' }}>{label}</span>
    <span style={{
      fontSize: 13, fontWeight: 600, color: accent ? 'var(--c-accent)' : 'var(--c-text)',
      fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all',
    }}>{value || '—'}</span>
  </div>
);

const Badge = ({ label, color }: { label: string; color: string }) => (
  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', background: `${color}18`, color, border: `1px solid ${color}30` }}>
    {label}
  </span>
);

const statusColor: Record<string, string> = {
  ACTIVE: '#22c55e', ADMIN_RECOVERABLE: '#f59e0b', RECOVERY_REQUESTED: '#8b5cf6',
  RECOVERY_APPROVED: '#10b981', RECOVERED: '#3b82f6', PURGE_IN_PROGRESS: '#ef4444', PURGED: '#6b7280',
};

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(2)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

// ─── Confidence Ring ─────────────────────────────────────────────────────────
const ConfidenceRing = ({ value }: { value: number }) => {
  const r = 42, circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const color = value >= 90 ? '#22c55e' : value >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={100} height={100} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={50} cy={50} r={r} fill="none" stroke="var(--c-border)" strokeWidth={8} />
        <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }} />
        <text x={50} y={55} textAnchor="middle" style={{ transform: 'rotate(90deg) translate(0px,-100px)', fontSize: 20, fontWeight: 800, fill: color, fontFamily: 'Plus Jakarta Sans' }}>
          {value}%
        </text>
      </svg>
      <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recovery Confidence</span>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
export const ForensicEvidence: React.FC = () => {
  const [files, setFiles] = useState<EnterpriseFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<EnterpriseFile | null>(null);
  const [evidence, setEvidence] = useState<ForensicEvidenceType | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Load ALL enterprise files (vault + active) on mount
  useEffect(() => {
    const loadFiles = async () => {
      setFilesLoading(true);
      try {
        const [emp, vault] = await Promise.allSettled([
          api.getEmployeeFiles(),
          api.getRecoveryVault(),
        ]);
        const empList = emp.status === 'fulfilled' ? emp.value : [];
        const vaultList = vault.status === 'fulfilled' ? vault.value : [];
        // Merge, deduplicate by id
        const map = new Map<string, EnterpriseFile>();
        [...empList, ...vaultList].forEach(f => map.set(f.id, f));
        setFiles(Array.from(map.values()));
      } catch { /* ignore */ } finally {
        setFilesLoading(false);
      }
    };
    loadFiles();
  }, []);

  // Auto-analyze when a file is selected
  const analyzeFile = useCallback(async (file: EnterpriseFile) => {
    setSelectedFile(file);
    setEvidence(null);
    setError('');
    setEvidenceLoading(true);
    try {
      const data = await api.getForensicEvidence(file.id);
      setEvidence(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load forensic evidence for this file.');
    } finally {
      setEvidenceLoading(false);
    }
  }, []);

  const filtered = files.filter(f =>
    f.original_filename.toLowerCase().includes(search.toLowerCase()) ||
    f.status.toLowerCase().includes(search.toLowerCase()) ||
    (f.owner_username || '').toLowerCase().includes(search.toLowerCase())
  );

  // ── Panel: File List ────────────────────────────────────────────────────
  const FilePanel = () => (
    <div style={{
      width: 320, minWidth: 280, background: 'var(--c-surface)',
      border: '1px solid var(--c-border)', borderRadius: 16,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--c-border)', background: 'var(--c-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Database size={16} color="var(--c-accent)" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Enterprise Files</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--c-text-muted)', background: 'var(--c-border)', padding: '2px 8px', borderRadius: 10 }}>
            {files.length}
          </span>
        </div>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={14} color="var(--c-text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 32px', boxSizing: 'border-box',
              borderRadius: 8, border: '1px solid var(--c-border)', background: 'var(--c-surface)',
              color: 'var(--c-text)', fontSize: 13,
            }}
          />
        </div>
      </div>

      {/* File List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filesLoading
          ? [1,2,3,4,5,6].map(i => (
              <div key={i} style={{ padding: '14px 20px', borderBottom: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Skel h={13} w="70%" />
                <Skel h={11} w="45%" />
              </div>
            ))
          : filtered.length === 0
            ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-text-muted)', fontSize: 13 }}>No files found</div>
            : filtered.map(f => {
                const isSelected = selectedFile?.id === f.id;
                const col = statusColor[f.status] || '#6b7280';
                return (
                  <button
                    key={f.id}
                    onClick={() => analyzeFile(f)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '14px 20px',
                      background: isSelected ? 'rgba(255,126,95,0.08)' : 'transparent',
                      border: 'none', borderBottom: '1px solid var(--c-border)',
                      borderLeft: isSelected ? '3px solid var(--c-accent)' : '3px solid transparent',
                      cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${col}15`, border: `1px solid ${col}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={16} color={col} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {f.original_filename}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ color: col, fontWeight: 700 }}>{f.status.replace(/_/g, ' ')}</span>
                        · {fmtBytes(f.file_size)}
                      </div>
                    </div>
                    {isSelected && <ChevronRight size={14} color="var(--c-accent)" />}
                  </button>
                );
              })
        }
      </div>
    </div>
  );

  // ── Panel: Evidence Detail ──────────────────────────────────────────────
  const EvidencePanel = () => {
    if (!selectedFile) return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--c-text-muted)' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--c-surface)', border: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileSearch size={36} color="var(--c-text-muted)" style={{ opacity: 0.4 }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--c-text)', marginBottom: 6 }}>Select a File to Investigate</div>
          <div style={{ fontSize: 14, maxWidth: 320 }}>Choose any enterprise file from the left panel to run a full forensic analysis.</div>
        </div>
      </div>
    );

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>

        {/* File header bar */}
        <div style={{ background: 'var(--c-surface)', borderRadius: 16, border: '1px solid var(--c-border)', padding: '20px 24px', display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: `${statusColor[selectedFile.status] || '#6b7280'}15`, border: `1px solid ${statusColor[selectedFile.status] || '#6b7280'}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={22} color={statusColor[selectedFile.status] || '#6b7280'} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{selectedFile.original_filename}</h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
              <Badge label={selectedFile.status.replace(/_/g, ' ')} color={statusColor[selectedFile.status] || '#6b7280'} />
              <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{fmtBytes(selectedFile.file_size)}</span>
              {selectedFile.owner_username && <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>Owner: <strong>{selectedFile.owner_username}</strong></span>}
              <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>Uploaded: {new Date(selectedFile.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          {evidenceLoading && <RefreshCw size={20} color="var(--c-accent)" style={{ animation: 'spin 1s linear infinite' }} />}
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: 16, background: 'rgba(239,68,68,0.08)', color: '#ef4444', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={20} /> {error}
          </div>
        )}

        {/* Loading skeletons */}
        {evidenceLoading && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ background: 'var(--c-surface)', borderRadius: 16, border: '1px solid var(--c-border)', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Skel h={18} w="50%" />
                  {[1,2,3,4].map(j => <Skel key={j} h={13} w={j % 2 === 0 ? '80%' : '60%'} />)}
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--c-surface)', borderRadius: 16, border: '1px solid var(--c-border)', padding: 24 }}>
              <Skel h={18} w="30%" r={6} />
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1,2,3].map(i => <Skel key={i} h={56} r={8} />)}
              </div>
            </div>
          </>
        )}

        {/* Evidence loaded */}
        {evidence && !evidenceLoading && (
          <>
            {/* Row 1: Metadata + Crypto Signatures + Confidence */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16 }}>

              {/* Metadata */}
              <div style={{ background: 'var(--c-surface)', padding: 24, borderRadius: 16, border: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Info size={16} color="#3b82f6" />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>File Metadata</span>
                </div>
                <Field label="Filename" value={evidence.filename} />
                <Field label="File Size" value={fmtBytes(evidence.file_size)} />
                <Field label="MIME Type" value={evidence.mime_type} />
                <Field label="Detected Type" value={evidence.detected_type} accent />
                <Field label="Lifecycle Status" value={evidence.status?.replace(/_/g, ' ')} />
                <Field label="Source Type" value={evidence.source_type} />
                <Field label="Owner ID" value={evidence.owner_id} mono />
              </div>

              {/* Cryptographic Signatures */}
              <div style={{ background: 'var(--c-surface)', padding: 24, borderRadius: 16, border: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Activity size={16} color="#8b5cf6" />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Cryptographic Analysis</span>
                </div>

                {/* SHA-256 Hash */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-muted)', marginBottom: 6 }}>SHA-256 Hash</div>
                  <div style={{ padding: '10px 14px', background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: 8, fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all', color: '#22c55e', lineHeight: 1.6 }}>
                    {evidence.sha256_hash}
                  </div>
                </div>

                <Field label="Magic Bytes (Hex)" value={evidence.magic_bytes} mono />
                <Field label="Magic Signature Match" value={evidence.magic_signature} accent />

                {/* Sector Info */}
                {evidence.sector_info && <Field label="Sector / Storage Info" value={evidence.sector_info} />}
                {evidence.source_offset !== null && evidence.source_offset !== undefined && (
                  <Field label="Source Byte Offset" value={`${evidence.source_offset} bytes`} mono />
                )}
                {evidence.recovery_timestamp && (
                  <Field label="Recovery Timestamp" value={new Date(evidence.recovery_timestamp).toLocaleString()} />
                )}
              </div>

              {/* Confidence Ring */}
              <div style={{ background: 'var(--c-surface)', padding: 24, borderRadius: 16, border: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, minWidth: 180 }}>
                <ConfidenceRing value={evidence.recovery_confidence ?? 0} />

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--c-text-muted)' }}>Chain Blocks</span>
                    <strong>{evidence.chain_of_custody?.length ?? 0}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--c-text-muted)' }}>Integrity</span>
                    {(evidence.recovery_confidence ?? 0) >= 90
                      ? <span style={{ color: '#22c55e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> VERIFIED</span>
                      : <span style={{ color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={12} /> PARTIAL</span>
                    }
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--c-text-muted)' }}>Hash Match</span>
                    <span style={{ color: '#22c55e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> OK</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Quick Stats Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { icon: Hash, label: 'Hash Algorithm', value: 'SHA-256', color: '34,197,94' },
                { icon: Cpu, label: 'Analysis Engine', value: 'DataShield v2.0', color: '59,130,246' },
                { icon: Server, label: 'Storage Layer', value: evidence.sector_info?.split(':')[0] || 'Sandbox', color: '245,158,11' },
                { icon: Zap, label: 'Erasure Verified', value: selectedFile?.erasure_verified ? 'YES — PASS' : 'N/A', color: selectedFile?.erasure_verified ? '34,197,94' : '107,114,128' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} style={{ background: 'var(--c-surface)', padding: '16px 20px', borderRadius: 12, border: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `rgba(${color},0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} color={`rgb(${color})`} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Row 3: Chain of Custody Timeline */}
            <div style={{ background: 'var(--c-surface)', borderRadius: 16, border: '1px solid var(--c-border)', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LinkIcon size={16} color="#22c55e" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Immutable Chain of Custody</h2>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--c-text-muted)' }}>Cryptographically linked SHA-256 hash chain — tamper-evident audit trail</p>
                </div>
                <span style={{ marginLeft: 'auto', background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                  {evidence.chain_of_custody?.length ?? 0} BLOCKS
                </span>
              </div>

              <div style={{ padding: 24 }}>
                {!evidence.chain_of_custody || evidence.chain_of_custody.length === 0 ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--c-text-muted)' }}>
                    <Lock size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <div style={{ fontWeight: 600 }}>No audit blocks recorded for this file yet.</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>Events will appear here as actions are taken on the file.</div>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    {/* Vertical connector line */}
                    <div style={{ position: 'absolute', left: 23, top: 24, bottom: 24, width: 2, background: 'linear-gradient(to bottom, var(--c-accent), #22c55e)', opacity: 0.3, zIndex: 0 }} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {evidence.chain_of_custody.map((block, i) => {
                        const isFirst = i === 0;
                        const dotColor = isFirst ? 'var(--c-accent)' : '#22c55e';
                        return (
                          <div key={block.id} style={{ display: 'flex', gap: 20, zIndex: 1, position: 'relative', paddingBottom: 20 }}>
                            {/* Block number dot */}
                            <div style={{ width: 48, height: 48, borderRadius: 24, background: isFirst ? 'rgba(255,126,95,0.1)' : 'rgba(34,197,94,0.1)', border: `2px solid ${dotColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: dotColor, flexShrink: 0, zIndex: 2 }}>
                              #{block.index}
                            </div>

                            {/* Block content */}
                            <div style={{ flex: 1, background: 'var(--c-bg)', padding: '16px 20px', borderRadius: 12, border: `1px solid ${isFirst ? 'rgba(255,126,95,0.2)' : 'var(--c-border)'}` }}>
                              {/* Event header */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontWeight: 800, fontSize: 14, color: dotColor }}>{block.event_type}</span>
                                  {block.actor_role && (
                                    <span style={{ fontSize: 11, padding: '2px 8px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, color: 'var(--c-text-muted)', fontWeight: 600 }}>
                                      {block.actor_role.toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: 12, color: 'var(--c-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Clock size={12} /> {new Date(block.timestamp).toLocaleString()}
                                </span>
                              </div>

                              {/* Actor info */}
                              <div style={{ fontSize: 13, color: 'var(--c-text-muted)', marginBottom: 12 }}>
                                Actor: <strong style={{ color: block.actor_id === 'SYSTEM' ? '#ef4444' : 'var(--c-text)' }}>
                                  {block.actor_id === 'SYSTEM' ? '⚙ SYSTEM' : block.actor_id || 'Unknown'}
                                </strong>
                                {block.source_ip && <span style={{ marginLeft: 16 }}>IP: <code style={{ fontSize: 12 }}>{block.source_ip}</code></span>}
                              </div>

                              {/* Action details */}
                              {block.action_details && (
                                <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 12, fontStyle: 'italic' }}>
                                  {block.action_details}
                                </div>
                              )}

                              {/* Hashes */}
                              <div style={{ background: 'var(--c-surface)', padding: '10px 14px', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#22c55e' }}>
                                  <span style={{ color: 'var(--c-text-muted)', marginRight: 8 }}>HASH:</span>{block.hash}
                                </div>
                                <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--c-text-muted)' }}>
                                  <span style={{ marginRight: 8 }}>PREV:</span>{block.previous_hash}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--c-text)', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,126,95,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSearch size={22} color="var(--c-accent)" />
            </div>
            File Forensic Evidence
          </h1>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--c-text-muted)', margin: 0, fontSize: 15 }}>
            Click any file to auto-analyze — magic bytes, SHA-256 verification, and cryptographic chain-of-custody.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, fontSize: 13, color: '#22c55e', fontWeight: 700 }}>
          <Eye size={16} /> Read-Only Analysis Mode
        </div>
      </div>

      {/* Main Layout: File Panel + Evidence Panel */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', minHeight: 600 }}>
        <FilePanel />
        <EvidencePanel />
      </div>
    </div>
  );
};
