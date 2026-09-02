import React, { useState, useRef, useEffect } from 'react';
import {
  Trash2, FolderOpen, ShieldAlert, CheckCircle2, AlertTriangle, 
  X, Terminal, Activity, Clock, Hash, FileText, Layers,
  ChevronDown, RotateCw, Zap, Lock, Eye, Code, Sliders,
  Binary, FileCode, CheckSquare, HardDrive
} from 'lucide-react';
import { api } from '../services/api';

const S = {
  card: {
    background: '#FFFFFF',
    border: '1px solid var(--c-border)',
    borderRadius: 14,
    boxShadow: '0 10px 30px -4px rgba(30, 34, 41, 0.05), 0 2px 10px -2px rgba(30, 34, 41, 0.03)',
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: '#5E6676',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    background: '#FFFFFF',
    border: '1px solid #E2DED7',
    borderRadius: 14,
    padding: '10px 16px',
    color: '#1E2229',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontSize: 13,
    outline: 'none',
    boxShadow: 'inset 0 1px 3px rgba(30, 34, 41, 0.02)',
  } as React.CSSProperties,
  heading: {
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: '#1E2229',
  },
};

interface DeleteMethod {
  id: string;
  name: string;
  passes: number;
  standard: string;
  time: string;
  accent: string;
  desc: string;
  risk: 'safe' | 'medium' | 'extreme';
}

const METHODS: DeleteMethod[] = [
  { id: 'zero',      name: 'Zero-Fill',           passes: 1,  standard: 'NIST SP 800-88',   time: '~2s',  accent: '#FF7E5F', desc: 'Overwrites target bytes with continuous null bytes (0x00). Simple, rapid wipe.', risk: 'safe' },
  { id: 'random',    name: 'Random Overwrite',    passes: 1,  standard: 'NIST SP 800-88',   time: '~3s',  accent: '#FF7E5F', desc: 'Single-pass write using cryptographically secure pseudo-random bytes.', risk: 'safe' },
  { id: 'dod3',      name: 'DoD 3-Pass',          passes: 3,  standard: 'DoD 5220.22-M',    time: '~6s',  accent: '#2563EB', desc: 'Pass 1: zeros, Pass 2: ones, Pass 3: random + read-back verification.', risk: 'medium' },
  { id: 'dod7',      name: 'DoD 7-Pass Military', passes: 7,  standard: 'DoD 5220.22-M ECE',time: '~12s', accent: '#2563EB', desc: 'Alternating 0x00, 0xFF, complements, and PRNG random byte streams.', risk: 'medium' },
  { id: 'gutmann',   name: 'Gutmann 35-Pass',     passes: 35, standard: 'Gutmann 1996',     time: '~25s', accent: '#DC2626', desc: '35-pass magnetic transition sequence for absolute cryptographic obliteration.', risk: 'extreme' },
  { id: 'nist_purge',name: 'NIST Purge (Crypto)', passes: 1,  standard: 'NIST SP 800-88r1', time: '~4s',  accent: '#0D9488', desc: 'Cryptographic erase: deletes symmetric keys rendering ciphertext permanently unrecoverable.', risk: 'safe' },
  { id: 'ssd_secure',name: 'ATA Secure Erase',    passes: 1,  standard: 'ATA Controller',   time: '~8s',  accent: '#D97706', desc: 'Issues direct block erasure command to storage controller firmware.', risk: 'medium' },
  { id: 'instant',   name: 'Standard Unlink',     passes: 1,  standard: 'OS Filesystem',    time: '< 1s', accent: '#16A34A', desc: 'Removes directory pointer only (non-secure, recoverable in forensics).', risk: 'safe' },
];

const FILE_TYPES = [
  'All Files (*.*)',
  'Documents (*.pdf, *.docx, *.xlsx, *.txt)',
  'Database Files (*.db, *.sqlite, *.sql)',
  'Certificates & Keys (*.pem, *.key, *.pfx)',
  'System Logs (*.log, *.evt, *.journal)',
  'Images & Media (*.jpg, *.png, *.mp4)',
  'Source Code (*.py, *.ts, *.js, *.env)',
  'Custom Pattern'
];

type Phase = 'config' | 'executing' | 'done';

interface SecureDeleteProps {
  setActiveTab?: (tab: string) => void;
}

export const SecureDelete: React.FC<SecureDeleteProps> = ({ setActiveTab }) => {
  const [mode, setMode]               = useState<'path' | 'data'>('path');
  const [path, setPath]               = useState('');
  const [lastDeletedFile, setLastDeletedFile] = useState<string | null>(null);
  const [rawData, setRawData]         = useState('CONFIDENTIAL FINANCIAL DATA - SALARIES 2026\nAccount: 4892-0012-9938\nRouting: 021000021\nBalance: $4,850,200.00\nCryptographic Token: 8f9a2b4e7c1d3e5f');
  const [dataFormat, setDataFormat]   = useState<'plaintext' | 'hex' | 'json' | 'binary'>('plaintext');
  const [recursive, setRecursive]     = useState(true);
  const [method, setMethod]           = useState<DeleteMethod>(METHODS[2]);
  const [fileType, setFileType]       = useState('All Files (*.*)');
  const [customPattern, setCustomPattern] = useState('');
  const [selectedFileMeta, setSelectedFileMeta] = useState<{
    name: string;
    size: number;
    type: string;
    lastModified: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local file resolution status
  const [resolvedPathInfo, setResolvedPathInfo] = useState<{
    found: boolean;
    resolved_path: string;
    size_bytes: number;
    is_local: boolean;
  } | null>(null);
  
  // Advanced Options
  const [wipeSlack, setWipeSlack]         = useState(true);
  const [zeroInode, setZeroInode]         = useState(true);
  const [obfuscateName, setObfuscateName] = useState(true);
  const [verifyEntropy, setVerifyEntropy] = useState(true);
  const [auditNote, setAuditNote]         = useState('Authorized secure sanitization under SIH26149 compliance guidelines.');

  // Confirmation modal popup state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [phase, setPhase]                 = useState<Phase>('config');
  const [progress, setProgress]           = useState(0);
  const [progLabel, setProgLabel]         = useState('');
  const [log, setLog]                     = useState<string[]>([]);
  const [shaHash, setShaHash]             = useState('');
  const [shredResult, setShredResult]     = useState<any>(null);
  const logRef                            = useRef<HTMLDivElement>(null);

  // Debounced check if file exists on local system
  useEffect(() => {
    if (mode !== 'path' || !path.trim()) {
      setResolvedPathInfo(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const info = await api.resolveFile(path.trim());
        setResolvedPathInfo(info);
      } catch {
        setResolvedPathInfo(null);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [path, mode]);

  const addLog = (line: string) => {
    setLog(p => {
      const n = [...p, line.startsWith('[') ? line : `[${new Date().toLocaleTimeString()}] ${line}`];
      setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 40);
      return n;
    });
  };

  const handleNativeFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileMeta({
      name: file.name,
      size: file.size,
      type: file.type || file.name.split('.').pop()?.toUpperCase() || 'BINARY',
      lastModified: file.lastModified,
    });

    // Check if backend can resolve the exact local path of this file
    const resolved = await api.resolveFile(file.name);
    if (resolved && resolved.found) {
      setPath(resolved.resolved_path);
      setResolvedPathInfo(resolved);
    } else {
      setPath(file.name);
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (['pdf', 'doc', 'docx', 'xlsx', 'txt', 'rtf'].includes(ext)) {
      setFileType('Documents (*.pdf, *.docx, *.xlsx, *.txt)');
    } else if (['db', 'sqlite', 'sql'].includes(ext)) {
      setFileType('Database Files (*.db, *.sqlite, *.sql)');
    } else if (['pem', 'key', 'pfx', 'crt'].includes(ext)) {
      setFileType('Certificates & Keys (*.pem, *.key, *.pfx)');
    } else if (['log', 'evt', 'journal'].includes(ext)) {
      setFileType('System Logs (*.log, *.evt, *.journal)');
    } else if (['jpg', 'jpeg', 'png', 'webp', 'mp4', 'avi', 'mkv'].includes(ext)) {
      setFileType('Images & Media (*.jpg, *.png, *.mp4)');
    } else if (['py', 'ts', 'js', 'env', 'json'].includes(ext)) {
      setFileType('Source Code (*.py, *.ts, *.js, *.env)');
    }

    if (file.size < 500000) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setRawData(reader.result.slice(0, 2048));
        }
      };
      reader.readAsText(file);
    }
  };

  // Execute real physical shred and deletion via backend
  const handleConfirmExecute = async () => {
    setShowConfirmModal(false);
    setPhase('executing');
    setProgress(10);
    setLog([]);
    setProgLabel('Initializing storage sanitization daemon...');

    const targetToShred = resolvedPathInfo?.found ? resolvedPathInfo.resolved_path : path;

    try {
      addLog(`[${new Date().toLocaleTimeString()}] Sanitization daemon initialized: ${method.name} (${method.passes} passes)`);
      addLog(`[${new Date().toLocaleTimeString()}] Target acquired: ${targetToShred}`);
      setProgress(25);

      // Call backend API to physically overwrite and delete on local filesystem
      const result = await api.shredTarget({
        target_path: targetToShred,
        method: method.id,
        passes: method.passes,
        wipe_slack: wipeSlack,
        zero_inode: zeroInode,
        obfuscate_name: obfuscateName,
        verify_entropy: verifyEntropy,
        audit_note: auditNote,
        raw_payload: mode === 'data' ? rawData : undefined,
        data_format: dataFormat,
      });

      setShredResult(result);
      setShaHash(result.sha256_hash || '');

      // Stream logs returned from backend
      if (result.telemetry_logs && result.telemetry_logs.length > 0) {
        let currentPct = 35;
        const pctStep = Math.floor(55 / result.telemetry_logs.length);
        for (const line of result.telemetry_logs) {
          addLog(line);
          currentPct += pctStep;
          setProgress(Math.min(95, currentPct));
          setProgLabel(line.replace(/\[.*?\]\s*/, ''));
          await new Promise((r) => setTimeout(r, 120));
        }
      }

      setProgress(100);
      setProgLabel('Operation Complete: Target permanently eradicated from disk.');
      setLastDeletedFile(targetToShred);
      setPath('');
      setSelectedFileMeta(null);
      setResolvedPathInfo(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setTimeout(() => {
        setPhase('done');
      }, 400);
    } catch (err: any) {
      addLog(`[ERROR] Sanitization execution halted: ${err.message}`);
      setProgLabel(`Error: ${err.message}`);
      alert(`Sanitization error: ${err.message}`);
      setPhase('config');
    }
  };

  const reset = () => {
    setPhase('config');
    setShowConfirmModal(false);
    setLog([]);
    setProgress(0);
    setShredResult(null);
    setPath('');
    setSelectedFileMeta(null);
    setResolvedPathInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const setPresetPath = (preset: string) => {
    setPath(preset);
  };

  const riskColor: Record<string, string> = { safe: '#16A34A', medium: '#D97706', extreme: '#DC2626' };

  return (
    <div className="ds-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="ds-section-label" style={{ justifyContent: 'flex-start', marginBottom: 6 }}>
            <ShieldAlert size={14} /> Granular Data Sanitization &amp; Physical Disk Erasure
          </div>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', color: '#1E2229' }}>
            Secure File &amp; Data Deletion
          </h1>
        </div>
        {phase !== 'config' && (
          <button onClick={reset} className="ds-btn ds-btn-ghost ds-btn-sm">
            <RotateCw size={13} /> New Deletion Operation
          </button>
        )}
      </div>

      {/* ═══ CONFIGURATION PHASE ═══ */}
      {phase === 'config' && (
        <>
          {lastDeletedFile && (
            <div style={{
              padding: '14px 18px',
              borderRadius: 14,
              background: 'rgba(22, 163, 74, 0.08)',
              border: '1px solid rgba(22, 163, 74, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#15803D' }}>
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Target Eradicated:</strong> <code style={{ background: 'rgba(22,163,74,0.12)', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>{lastDeletedFile}</code> was successfully wiped from disk and registered in Recovery catalog.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {setActiveTab && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('recovery')}
                    style={{
                      background: 'linear-gradient(135deg, #16A34A, #15803D)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 10,
                      padding: '6px 14px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <RotateCw size={12} /> View in Recovery Page →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLastDeletedFile(null)}
                  style={{ background: 'none', border: 'none', color: '#5E6676', cursor: 'pointer', padding: 4 }}
                  title="Dismiss notification"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18 }}>
          {/* Main Left Config Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Target Mode Selector Tabs */}
            <div className="ds-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FolderOpen size={18} color="#FF7E5F" />
                  <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 16, color: '#1E2229' }}>
                    1. Select Target Type &amp; Input
                  </span>
                </div>
                {/* Mode Switcher */}
                <div style={{ display: 'flex', background: '#FAF8F5', borderRadius: 14, padding: 4, border: '1px solid var(--c-border)' }}>
                  <button
                    type="button"
                    onClick={() => setMode('path')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 12,
                      border: 'none',
                      background: mode === 'path' ? 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)' : 'transparent',
                      color: mode === 'path' ? '#FFFFFF' : '#5E6676',
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: mode === 'path' ? '0 4px 12px rgba(255,126,95,0.25)' : 'none',
                    }}
                  >
                    <FolderOpen size={13} /> Local File / Path
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('data')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 12,
                      border: 'none',
                      background: mode === 'data' ? 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)' : 'transparent',
                      color: mode === 'data' ? '#FFFFFF' : '#5E6676',
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: mode === 'data' ? '0 4px 12px rgba(255,126,95,0.25)' : 'none',
                    }}
                  >
                    <Binary size={13} /> Raw Data / Payload Deletion
                  </button>
                </div>
              </div>

              {/* Path Input View */}
              {mode === 'path' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label style={{ ...S.label, marginBottom: 0 }}>Target File or Directory Path to Delete</label>
                      {resolvedPathInfo?.found ? (
                        <span style={{ fontSize: 11, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700 }}>
                          <CheckCircle2 size={13} /> LOCAL FILE DETECTED ON DISK ({(resolvedPathInfo.size_bytes / 1024).toFixed(1)} KB)
                        </span>
                      ) : selectedFileMeta ? (
                        <span style={{ fontSize: 11, color: '#2563EB', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700 }}>
                          <CheckCircle2 size={13} /> FILE LOADED: {selectedFileMeta.name} ({(selectedFileMeta.size / 1024).toFixed(1)} KB)
                        </span>
                      ) : null}
                    </div>

                    {/* Hidden Native File Input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleNativeFileSelect}
                      style={{ display: 'none' }}
                    />

                    {/* Target Path Input with Integrated Select File Button and Clear Button */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Terminal size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', zIndex: 2 }} />
                      <input
                        value={path}
                        onChange={(e) => { setPath(e.target.value); }}
                        placeholder="Enter full path e.g. C:\Users\...\document.docx or click 'Select File' →"
                        className="ds-input"
                        style={{ paddingLeft: 38, paddingRight: path ? 160 : 130, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
                      />
                      {path && (
                        <button
                          type="button"
                          onClick={() => {
                            setPath('');
                            setSelectedFileMeta(null);
                            setResolvedPathInfo(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          title="Clear selected target"
                          style={{
                            position: 'absolute',
                            right: 122,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94A3B8',
                            padding: 4,
                            display: 'flex',
                            alignItems: 'center',
                            zIndex: 3,
                          }}
                        >
                          <X size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="ds-btn ds-btn-primary ds-btn-sm"
                        style={{
                          position: 'absolute',
                          right: 5,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          padding: '6px 14px',
                          fontSize: 11,
                          borderRadius: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          zIndex: 2,
                        }}
                      >
                        <FolderOpen size={13} /> Select File
                      </button>
                    </div>

                    {/* Live disk resolution indicator */}
                    {resolvedPathInfo?.found && (
                      <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 12, background: 'rgba(22, 163, 74, 0.08)', border: '1px solid rgba(22, 163, 74, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, wordBreak: 'break-all' }}>
                          <HardDrive size={15} color="#16A34A" style={{ flexShrink: 0 }} />
                          <span style={{ color: '#1E2229' }}>
                            <strong>Verified Local Target:</strong> <code style={{ color: '#15803D', fontWeight: 700 }}>{resolvedPathInfo.resolved_path}</code>
                          </span>
                        </div>
                        <span className="ds-badge" style={{ background: '#16A34A', color: '#FFFFFF', fontSize: 10, flexShrink: 0 }}>
                          READY ON DISK
                        </span>
                      </div>
                    )}

                    {/* File info banner if selected */}
                    {selectedFileMeta && !resolvedPathInfo?.found && (
                      <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 12, background: '#E6EFFB', border: '1px solid #D0E0F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <FileText size={15} color="#2B579A" />
                          <span style={{ color: '#1E2229', fontWeight: 700 }}>{selectedFileMeta.name}</span>
                          <span style={{ color: '#5E6676' }}>({(selectedFileMeta.size / 1024).toFixed(1)} KB)</span>
                          <span className="ds-badge" style={{ background: '#FFFFFF', color: '#2B579A', border: '1px solid #D0E0F7', fontSize: 10 }}>{selectedFileMeta.type}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFileMeta(null);
                            setPath('');
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          style={{ background: 'none', border: 'none', color: '#5E6676', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}
                        >
                          <X size={13} /> Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick folder presets for easy deletion */}
                  <div>
                    <span style={{ fontSize: 11, color: '#5E6676', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Quick Target Presets:
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {[
                        { label: 'confidential_memo.docx', full: 'confidential_memo.docx' },
                        { label: 'financial_audit_2026.db', full: 'financial_audit_2026.db' },
                        { label: 'infrastructure_diagram.png', full: 'infrastructure_diagram.png' },
                        { label: 'sample.webp', full: 'sample.webp' },
                        { label: 'system_event.log', full: 'system_event.log' },
                      ].map((pr) => (
                        <button
                          key={pr.label}
                          type="button"
                          onClick={() => setPresetPath(pr.full)}
                          style={{
                            fontSize: 11,
                            fontFamily: 'JetBrains Mono, monospace',
                            padding: '4px 10px',
                            borderRadius: 12,
                            background: path === pr.full || path === pr.label ? 'rgba(255, 126, 95, 0.12)' : '#FAF8F5',
                            border: path === pr.full || path === pr.label ? '1px solid #FF7E5F' : '1px solid var(--c-border)',
                            color: path === pr.full || path === pr.label ? '#FF7E5F' : '#5E6676',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {pr.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 4 }}>
                    <div>
                      <label style={S.label}>File Extension / Format Filter</label>
                      <select
                        value={fileType}
                        onChange={(e) => setFileType(e.target.value)}
                        className="ds-input"
                        style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700 }}
                      >
                        {FILE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    {fileType === 'Custom Pattern' ? (
                      <div>
                        <label style={S.label}>Custom Wildcard Pattern</label>
                        <input
                          value={customPattern}
                          onChange={(e) => setCustomPattern(e.target.value)}
                          placeholder="*.wallet, *.bak, *.env.*"
                          className="ds-input"
                          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
                        />
                      </div>
                    ) : (
                      <div>
                        <label style={S.label}>Directory Processing</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', height: 42 }}>
                          <input
                            type="checkbox"
                            checked={recursive}
                            onChange={(e) => setRecursive(e.target.checked)}
                            style={{ accentColor: '#FF7E5F', width: 16, height: 16 }}
                          />
                          <span style={{ fontSize: 13, color: '#1E2229' }}>Recursive subdirectory wipe</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Raw Data Ingestion View */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={S.label}>Direct Data / Payload for Deletion</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['plaintext', 'hex', 'json', 'binary'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setDataFormat(fmt)}
                          style={{
                            fontSize: 10,
                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '3px 9px',
                            borderRadius: 10,
                            background: dataFormat === fmt ? 'rgba(255, 126, 95, 0.15)' : '#FAF8F5',
                            color: dataFormat === fmt ? '#FF7E5F' : '#5E6676',
                            border: dataFormat === fmt ? '1px solid #FF7E5F' : '1px solid var(--c-border)',
                            cursor: 'pointer',
                          }}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    value={rawData}
                    onChange={(e) => setRawData(e.target.value)}
                    placeholder="Paste sensitive tokens, keys, database records, or raw hex here..."
                    className="ds-input"
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#5E6676' }}>
                    <span>Byte Count: <strong>{new Blob([rawData]).size} bytes</strong></span>
                    <span>Format: <strong style={{ color: '#FF7E5F', textTransform: 'uppercase' }}>{dataFormat}</strong></span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Algorithm Grid */}
            <div className="ds-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Zap size={18} color="#FF7E5F" />
                  <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 16, color: '#1E2229' }}>
                    2. Select Sanitization Algorithm
                  </h2>
                </div>
                <span className="ds-badge" style={{ background: '#E6EFFB', color: '#2B579A', border: '1px solid #D0E0F7' }}>
                  8 Algorithms
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {METHODS.map((m) => {
                  const isSel = method.id === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setMethod(m)}
                      style={{
                        padding: '16px',
                        borderRadius: 14,
                        cursor: 'pointer',
                        background: isSel ? 'rgba(255, 126, 95, 0.06)' : '#FAF8F5',
                        border: isSel ? '2px solid #FF7E5F' : '1px solid var(--c-border)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 14, color: isSel ? '#FF7E5F' : '#1E2229' }}>
                          {m.name}
                        </span>
                        <span
                          className="ds-badge"
                          style={{
                            background: `${riskColor[m.risk]}15`,
                            color: riskColor[m.risk],
                            border: `1px solid ${riskColor[m.risk]}30`,
                            fontSize: 9,
                          }}
                        >
                          {m.risk.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#5E6676', marginBottom: 6 }}>
                        {m.passes} Pass · {m.time}
                      </div>
                      <p style={{ fontSize: 11, color: '#5E6676', lineHeight: 1.4 }}>
                        {m.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Advanced Forensic Options */}
            <div className="ds-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Sliders size={18} color="#FF7E5F" />
                <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 16, color: '#1E2229' }}>
                  3. Advanced Forensic &amp; Verification Options
                </h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px 14px', borderRadius: 12, background: '#FAF8F5', border: '1px solid var(--c-border)' }}>
                  <input
                    type="checkbox"
                    checked={wipeSlack}
                    onChange={(e) => setWipeSlack(e.target.checked)}
                    style={{ accentColor: '#FF7E5F', width: 16, height: 16 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2229' }}>Wipe File Slack Space</div>
                    <div style={{ fontSize: 11, color: '#5E6676' }}>Zero cluster tail bytes</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px 14px', borderRadius: 12, background: '#FAF8F5', border: '1px solid var(--c-border)' }}>
                  <input
                    type="checkbox"
                    checked={zeroInode}
                    onChange={(e) => setZeroInode(e.target.checked)}
                    style={{ accentColor: '#FF7E5F', width: 16, height: 16 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2229' }}>Zero Inode &amp; MFT Entry</div>
                    <div style={{ fontSize: 11, color: '#5E6676' }}>Erase file descriptors</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px 14px', borderRadius: 12, background: '#FAF8F5', border: '1px solid var(--c-border)' }}>
                  <input
                    type="checkbox"
                    checked={obfuscateName}
                    onChange={(e) => setObfuscateName(e.target.checked)}
                    style={{ accentColor: '#FF7E5F', width: 16, height: 16 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2229' }}>Obfuscate Filename First</div>
                    <div style={{ fontSize: 11, color: '#5E6676' }}>Mask original directory entry</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px 14px', borderRadius: 12, background: '#FAF8F5', border: '1px solid var(--c-border)' }}>
                  <input
                    type="checkbox"
                    checked={verifyEntropy}
                    onChange={(e) => setVerifyEntropy(e.target.checked)}
                    style={{ accentColor: '#FF7E5F', width: 16, height: 16 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2229' }}>Post-Erase Entropy Audit</div>
                    <div style={{ fontSize: 11, color: '#5E6676' }}>Verify Shannon randomness ≥7.98</div>
                  </div>
                </label>
              </div>

              <div style={{ marginTop: 14 }}>
                <label style={S.label}>Audit Justification Note</label>
                <input
                  value={auditNote}
                  onChange={(e) => setAuditNote(e.target.value)}
                  className="ds-input"
                  style={{ fontSize: 12 }}
                />
              </div>
            </div>
          </div>

          {/* Right Summary Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Selected Method Details */}
            <div className="ds-card" style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)' }} />
              <h3 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 18, color: '#1E2229', marginBottom: 2 }}>
                {method.name}
              </h3>
              <div style={{ fontSize: 12, color: '#FF7E5F', fontWeight: 700, marginBottom: 12 }}>
                {method.standard}
              </div>
              <p style={{ fontSize: 12, color: '#5E6676', lineHeight: 1.6, marginBottom: 16 }}>
                {method.desc}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div style={{ padding: '10px 12px', borderRadius: 12, background: '#FAF8F5', border: '1px solid var(--c-border)' }}>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Wipe Passes</div>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 20, color: '#1E2229' }}>{method.passes}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 12, background: '#FAF8F5', border: '1px solid var(--c-border)' }}>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Est. Duration</div>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 20, color: '#1E2229' }}>{method.time}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 12, background: '#FAF8F5', border: '1px solid var(--c-border)' }}>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Standard</div>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 14, color: '#1E2229' }}>{method.standard.split(' ')[0]}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 12, background: '#FAF8F5', border: '1px solid var(--c-border)' }}>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Risk Rating</div>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 14, color: riskColor[method.risk] }}>{method.risk.toUpperCase()}</div>
                </div>
              </div>

              {/* One-Click Trigger for the Confirm Popup Modal */}
              <button
                onClick={() => {
                  if (mode === 'path' && !path.trim()) {
                    alert('Please select or specify a target file to delete.');
                    return;
                  }
                  setShowConfirmModal(true);
                }}
                disabled={mode === 'path' && !path.trim()}
                className="ds-btn ds-btn-danger ds-btn-lg"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  opacity: mode === 'path' && !path.trim() ? 0.6 : 1,
                  cursor: mode === 'path' && !path.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                <Trash2 size={16} /> Proceed to Deletion
              </button>
            </div>

            {/* Target Inspection Card */}
            <div className="ds-card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Eye size={16} color="#FF7E5F" />
                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 14, color: '#1E2229' }}>
                  Target Inspection
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#5E6676' }}>Mode:</span>
                  <strong style={{ color: '#1E2229', textTransform: 'uppercase' }}>{mode}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#5E6676' }}>Target:</span>
                  <code style={{ color: path ? '#FF7E5F' : '#94A3B8', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {mode === 'path' ? (path || 'None Selected') : `${rawData.length} bytes`}
                  </code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#5E6676' }}>Disk State:</span>
                  <span style={{ color: resolvedPathInfo?.found ? '#16A34A' : '#2563EB', fontWeight: 700 }}>
                    {resolvedPathInfo?.found ? 'Verified on Disk ✓' : 'Direct Target'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#5E6676' }}>Slack Wipe:</span>
                  <span style={{ color: wipeSlack ? '#16A34A' : '#94A3B8', fontWeight: 700 }}>{wipeSlack ? 'ENABLED' : 'DISABLED'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#5E6676' }}>Verify Entropy:</span>
                  <span style={{ color: verifyEntropy ? '#16A34A' : '#94A3B8', fontWeight: 700 }}>{verifyEntropy ? 'YES (≥7.98)' : 'NO'}</span>
                </div>
              </div>
            </div>

            {/* Permanent Destruction Warning */}
            <div style={{ padding: '16px', borderRadius: 14, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', display: 'flex', gap: 10 }}>
              <AlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12, color: '#991B1B', lineHeight: 1.5 }}>
                <strong>Physical Erasure Active:</strong> Executing this protocol performs real multi-pass overwrites across physical sectors and removes the target file directly from your local disk.
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      {/* ═══ CONFIRMATION MODAL POPUP (NO TYPING REQUIRED) ═══ */}
      {showConfirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30, 34, 41, 0.7)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div
            className="ds-card"
            style={{
              maxWidth: 520,
              width: '100%',
              padding: 28,
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 18,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--c-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={20} color="#DC2626" />
                </div>
                <div>
                  <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 18, color: '#1E2229' }}>
                    Confirm to Delete
                  </h2>
                  <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Irreversible Permanent Data Deletion
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#5E6676', lineHeight: 1.6, marginBottom: 18 }}>
              Are you sure you want to permanently delete this item? This action performs physical multi-pass overwrites on the storage disk and deletes the file directly from your local system.
            </p>

            {/* Target Breakdown Box */}
            <div style={{ padding: '16px 18px', borderRadius: 14, background: '#FAF8F5', border: '1px solid var(--c-border)', marginBottom: 22, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: '#5E6676' }}>Target:</span>
                <strong style={{ color: '#1E2229', wordBreak: 'break-all', textAlign: 'right' }}>
                  {resolvedPathInfo?.found ? resolvedPathInfo.resolved_path : mode === 'path' ? path : `In-Memory Data Block (${rawData.length} bytes)`}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#5E6676' }}>Algorithm:</span>
                <strong style={{ color: '#FF7E5F' }}>{method.name} ({method.passes} passes)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#5E6676' }}>Local System Status:</span>
                <span style={{ color: resolvedPathInfo?.found ? '#16A34A' : '#2563EB', fontWeight: 700 }}>
                  {resolvedPathInfo?.found ? 'Local File Found on Disk ✓' : 'Target Ready'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#5E6676' }}>Post-Erase Action:</span>
                <span style={{ color: '#DC2626', fontWeight: 700 }}>Physical Disk Unlink &amp; Erasure</span>
              </div>
            </div>

            {/* Actions: Direct Confirm to Delete Button (NO TYPING) */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="ds-btn ds-btn-ghost"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExecute}
                className="ds-btn ds-btn-danger ds-btn-lg"
                style={{
                  flex: 1.5,
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
                  boxShadow: '0 4px 16px rgba(220, 38, 38, 0.35)',
                }}
              >
                <Trash2 size={16} /> Confirm to Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EXECUTING & DONE PHASES ═══ */}
      {(phase === 'executing' || phase === 'done') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="ds-card" style={{ padding: 28, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: phase === 'done' ? 'linear-gradient(135deg, #16A34A, #22C55E)' : 'linear-gradient(135deg, #FF7E5F, #FEB47B)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {phase === 'executing' ? (
                  <Activity size={20} color="#FF7E5F" className="animate-spin" />
                ) : (
                  <CheckCircle2 size={22} color="#16A34A" />
                )}
                <div>
                  <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 18, color: '#1E2229' }}>
                    {phase === 'executing' ? 'Deleting in Progress...' : 'Sanitization Complete & Verified'}
                  </h2>
                  <div style={{ fontSize: 12, color: '#5E6676' }}>
                    {progLabel}
                  </div>
                </div>
              </div>
              <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 24, color: phase === 'done' ? '#16A34A' : '#FF7E5F' }}>
                {progress}%
              </span>
            </div>

            <div className="ds-progress" style={{ height: 8, marginBottom: 20 }}>
              <div className="ds-progress-fill" style={{ width: `${progress}%` }} />
            </div>

            {/* Result Details if Completed */}
            {phase === 'done' && shredResult && (
              <div style={{ padding: '16px 18px', borderRadius: 14, background: 'rgba(22, 163, 74, 0.08)', border: '1px solid rgba(22, 163, 74, 0.25)', marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803D', fontWeight: 800, fontSize: 13 }}>
                  <CheckCircle2 size={16} /> {shredResult.message || 'Sanitization successfully completed.'}
                </div>
                <div style={{ color: '#5E6676' }}>
                  Target: <strong style={{ color: '#1E2229' }}>{shredResult.target_path}</strong>
                </div>
                <div style={{ display: 'flex', gap: 16, color: '#5E6676', flexWrap: 'wrap' }}>
                  <span>Overwritten Passes: <strong style={{ color: '#1E2229' }}>{shredResult.passes_executed}</strong></span>
                  <span>Residual Entropy: <strong style={{ color: '#16A34A' }}>{shredResult.verified_entropy} bits/byte</strong></span>
                  <span>Disk State: <strong style={{ color: shredResult.deleted_from_disk ? '#16A34A' : '#DC2626' }}>{shredResult.deleted_from_disk ? 'Permanently Deleted from Local Disk ✓' : 'Data Zeroed'}</strong></span>
                </div>
              </div>
            )}

            {/* Overwrite Telemetry Stream Box */}
            <div>
              <div style={{ fontSize: 11, color: '#5E6676', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
                Execution Telemetry &amp; Overwrite Stream:
              </div>
              <div
                ref={logRef}
                style={{
                  height: 200,
                  overflowY: 'auto',
                  borderRadius: 14,
                  padding: 14,
                  background: '#FAF8F5',
                  border: '1px solid var(--c-border)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  lineHeight: 1.7,
                  color: '#1E2229',
                }}
              >
                {log.map((l, i) => (
                  <div key={i} style={{ color: l.includes('COMPLETE') || l.includes('✓') ? '#16A34A' : l.includes('Pass') ? '#FF7E5F' : l.includes('ERROR') ? '#DC2626' : '#5E6676' }}>
                    {l}
                  </div>
                ))}
              </div>
            </div>

            {/* Cryptographic Anchor */}
            {shaHash && (
              <div style={{ marginTop: 18, padding: '12px 16px', borderRadius: 14, background: '#E6EFFB', border: '1px solid #D0E0F7', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Hash size={16} color="#2B579A" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: 11, color: '#2B579A', wordBreak: 'break-all' }}>
                  <strong>SHA-256 Ledger Anchor:</strong> {shaHash}
                </div>
              </div>
            )}

            {phase === 'done' && (
              <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
                <button onClick={reset} className="ds-btn ds-btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
                  <RotateCw size={14} /> Delete Another File
                </button>
                {setActiveTab ? (
                  <button
                    onClick={() => {
                      reset();
                      setActiveTab('recovery');
                    }}
                    className="ds-btn ds-btn-primary"
                    style={{
                      flex: 1.3,
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
                      boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
                    }}
                  >
                    <CheckCircle2 size={14} /> View in Recovery &amp; Restore →
                  </button>
                ) : (
                  <button onClick={reset} className="ds-btn ds-btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                    <CheckCircle2 size={14} /> Start New Deletion
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
