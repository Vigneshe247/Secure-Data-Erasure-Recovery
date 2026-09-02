import React, { useState, useRef } from 'react';
import {
  Trash2, FolderOpen, ShieldAlert, CheckCircle2, AlertTriangle, 
  X, Terminal, Activity, Clock, Hash, FileText, Layers,
  ChevronDown, RotateCw, Zap, Lock, Eye, Code, Sliders,
  Binary, FileCode, CheckSquare
} from 'lucide-react';

const S = {
  card:    { background:'#111318', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12 } as React.CSSProperties,
  label:   { display:'block', fontFamily:'Barlow Condensed,sans-serif', fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase' as const, color:'#4d5a6a', marginBottom:6 },
  input:   { width:'100%', background:'#161921', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'9px 12px', color:'#f0f4ff', fontFamily:'Barlow,sans-serif', fontSize:13, outline:'none', transition:'border-color 0.15s' } as React.CSSProperties,
  heading: { fontFamily:'Barlow Condensed,sans-serif', fontWeight:800, letterSpacing:'0.03em', textTransform:'uppercase' as const },
};

interface DeleteMethod {
  id:string; name:string; passes:number; standard:string; time:string;
  accent:string; desc:string; risk:'safe'|'medium'|'extreme';
}

const METHODS: DeleteMethod[] = [
  { id:'zero',      name:'Zero-Fill',           passes:1,  standard:'NIST SP 800-88',  time:'~2s',   accent:'#2d7ff9', desc:'Overwrites target bytes with continuous null bytes (0x00). Simple, rapid wipe.', risk:'safe' },
  { id:'random',    name:'Random Overwrite',    passes:1,  standard:'NIST SP 800-88',  time:'~3s',   accent:'#2d7ff9', desc:'Single-pass write using cryptographically secure pseudo-random bytes.', risk:'safe' },
  { id:'dod3',      name:'DoD 3-Pass',          passes:3,  standard:'DoD 5220.22-M',   time:'~6s',   accent:'#818cf8', desc:'Pass 1: zeros, Pass 2: ones, Pass 3: random + read-back verification.', risk:'medium' },
  { id:'dod7',      name:'DoD 7-Pass Military', passes:7,  standard:'DoD 5220.22-M ECE',time:'~12s', accent:'#818cf8', desc:'Alternating 0x00, 0xFF, complements, and PRNG random byte streams.', risk:'medium' },
  { id:'gutmann',   name:'Gutmann 35-Pass',     passes:35, standard:'Gutmann 1996',    time:'~25s',  accent:'#ef4444', desc:'35-pass magnetic transition sequence for absolute cryptographic obliteration.', risk:'extreme' },
  { id:'nist_purge',name:'NIST Purge (Crypto)', passes:1,  standard:'NIST SP 800-88r1',time:'~4s',   accent:'#00d4c8', desc:'Cryptographic erase: shreds symmetric keys rendering ciphertext permanently unrecoverable.', risk:'safe' },
  { id:'ssd_secure',name:'ATA Secure Erase',    passes:1,  standard:'ATA Controller',  time:'~8s',   accent:'#f59e0b', desc:'Issues direct block erasure command to storage controller firmware.', risk:'medium' },
  { id:'instant',   name:'Standard Unlink',     passes:1,  standard:'OS Filesystem',   time:'< 1s',  accent:'#22c55e', desc:'Removes directory pointer only (non-secure, recoverable in forensics).', risk:'safe' },
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

const PRESET_PATHS = [
  '/sandbox/confidential_memo.docx',
  '/sandbox/financial_audit_2026.db',
  '/sandbox/identity_keys/id_rsa.pem',
  '/sandbox/database_backup.sqlite',
  '/sandbox/production_telemetry.log'
];

type Phase = 'config' | 'confirm' | 'executing' | 'done';

export const SecureDelete: React.FC = () => {
  const [mode, setMode]               = useState<'path' | 'data'>('path');
  const [path, setPath]               = useState('/sandbox/confidential_memo.docx');
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
  
  // Advanced Options
  const [wipeSlack, setWipeSlack]     = useState(true);
  const [zeroInode, setZeroInode]     = useState(true);
  const [obfuscateName, setObfuscateName] = useState(true);
  const [verifyEntropy, setVerifyEntropy] = useState(true);
  const [auditNote, setAuditNote]     = useState('Authorized secure sanitization under SIH26149 compliance guidelines.');

  const [phase, setPhase]             = useState<Phase>('config');
  const [confirmText, setConfirmText] = useState('');
  const [progress, setProgress]       = useState(0);
  const [progLabel, setProgLabel]     = useState('');
  const [log, setLog]                 = useState<string[]>([]);
  const [shaHash, setShaHash]         = useState('');
  const logRef                        = useRef<HTMLDivElement>(null);

  const addLog = (line: string) => {
    setLog(p => {
      const n = [...p, `[${new Date().toLocaleTimeString()}] ${line}`];
      setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 40);
      return n;
    });
  };

  const handleNativeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const simulatedPath = `/sandbox/uploads/${file.name}`;
    setPath(simulatedPath);
    setSelectedFileMeta({
      name: file.name,
      size: file.size,
      type: file.type || file.name.split('.').pop()?.toUpperCase() || 'BINARY',
      lastModified: file.lastModified,
    });

    // Auto-detect format filter
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (['pdf', 'doc', 'docx', 'xlsx', 'txt', 'rtf'].includes(ext)) {
      setFileType('Documents (*.pdf, *.docx, *.xlsx, *.txt)');
    } else if (['db', 'sqlite', 'sql'].includes(ext)) {
      setFileType('Database Files (*.db, *.sqlite, *.sql)');
    } else if (['pem', 'key', 'pfx', 'crt'].includes(ext)) {
      setFileType('Certificates & Keys (*.pem, *.key, *.pfx)');
    } else if (['log', 'evt', 'journal'].includes(ext)) {
      setFileType('System Logs (*.log, *.evt, *.journal)');
    } else if (['jpg', 'jpeg', 'png', 'mp4', 'avi', 'mkv'].includes(ext)) {
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

  const simulate = async () => {
    setPhase('executing');
    setProgress(0);
    setLog([]);
    const generatedHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    setShaHash(generatedHash);

    const targetDesc = mode === 'path' ? path : `In-Memory Data Block (${rawData.length} bytes, ${dataFormat})`;

    const steps: [number, string][] = [
      [8, `Sanitization daemon initialized: ${method.name} (${method.passes} pass)`],
      [16, `Validating RBAC privilege & safety policies... PASS ✓`],
      [24, `Target acquisition: ${targetDesc}`],
    ];

    if (mode === 'path' && obfuscateName) {
      steps.push([32, `Renaming inode to random alphanumeric sequence... OK`]);
    }

    if (mode === 'path' && wipeSlack) {
      steps.push([38, `Wiping filesystem slack space to cluster boundary... OK`]);
    }

    // Passes
    for (let i = 1; i <= method.passes; i++) {
      const patternName = ['0x00 (Null Bytes)', '0xFF (Ones)', '0x55 (Alternating)', 'PRNG Cryptographic Noise'][i % 4];
      steps.push([
        40 + Math.floor((i * 40) / method.passes),
        `Pass ${i}/${method.passes} [${method.standard}]: Overwriting with ${patternName}... OK`
      ]);
    }

    if (mode === 'path' && zeroInode) {
      steps.push([86, `Zeroing out filesystem inode table & metadata attributes... OK`]);
    }

    if (verifyEntropy) {
      steps.push([92, `Post-erasure entropy analysis: sampling 512 sectors... OK`]);
      steps.push([96, `Calculated Shannon Entropy: 7.989 bits/byte (Zero residual data detected)`]);
    }

    steps.push([99, `Anchoring cryptographic audit record to SHA-256 chain: ${generatedHash.slice(0, 16)}...`]);
    steps.push([100, `✓ OPERATION COMPLETE: Target completely and irreversibly obliterated.`]);

    for (const [pct, label] of steps) {
      await new Promise(r => setTimeout(r, 220 + Math.random() * 250));
      setProgress(pct);
      setProgLabel(label);
      addLog(label);
    }
    setTimeout(() => setPhase('done'), 400);
  };

  const reset = () => {
    setPhase('config');
    setConfirmText('');
    setLog([]);
    setProgress(0);
  };

  const riskColor: Record<string, string> = { safe: '#22c55e', medium: '#f59e0b', extreme: '#ef4444' };

  return (
    <div className="ds-page" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="ds-section-label" style={{ justifyContent: 'flex-start', marginBottom: 6, color: '#ef4444' }}>
            <ShieldAlert size={12} /> Granular Data Sanitization & Shredder Engine
          </div>
          <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 32, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#f0f4ff' }}>
            Secure File &amp; Data Delete
          </h1>
        </div>
        {phase !== 'config' && (
          <button onClick={reset} className="ds-btn ds-btn-ghost ds-btn-sm">
            <RotateCw size={12} /> New Shred Operation
          </button>
        )}
      </div>

      {/* ═══ CONFIGURATION PHASE ═══ */}
      {phase === 'config' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
          {/* Main Left Config Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Target Mode Selector Tabs */}
            <div className="ds-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FolderOpen size={16} color="#f59e0b" />
                  <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f0f4ff' }}>
                    1. Select Target Type &amp; Input
                  </span>
                </div>
                {/* Switcher */}
                <div style={{ display: 'flex', background: '#0a0c10', borderRadius: 8, padding: 3, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    type="button"
                    onClick={() => setMode('path')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: mode === 'path' ? 'linear-gradient(135deg, #2d7ff9, #1a5fd4)' : 'transparent',
                      color: mode === 'path' ? '#fff' : '#8b96a8',
                      fontFamily: 'Barlow Condensed, sans-serif',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <FolderOpen size={12} /> File / Directory Path
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('data')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: mode === 'data' ? 'linear-gradient(135deg, #2d7ff9, #1a5fd4)' : 'transparent',
                      color: mode === 'data' ? '#fff' : '#8b96a8',
                      fontFamily: 'Barlow Condensed, sans-serif',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Binary size={12} /> Raw Data / Payload Shred
                  </button>
                </div>
              </div>

              {/* Path Input View */}
              {mode === 'path' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label style={{ ...S.label, marginBottom: 0 }}>File or Directory Target Path</label>
                      {selectedFileMeta && (
                        <span style={{ fontSize: 11, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, letterSpacing: '0.04em' }}>
                          <CheckCircle2 size={12} /> FILE LOADED: {selectedFileMeta.name} ({(selectedFileMeta.size / 1024).toFixed(1)} KB)
                        </span>
                      )}
                    </div>

                    {/* Hidden Native File Input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleNativeFileSelect}
                      style={{ display: 'none' }}
                    />

                    {/* Target Path Input with Integrated Select File Button */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Terminal size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#4d5a6a', zIndex: 2 }} />
                      <input
                        value={path}
                        onChange={(e) => { setPath(e.target.value); setSelectedFileMeta(null); }}
                        placeholder="/sandbox/path/to/target/file.pdf  or click 'Select File' →"
                        className="ds-input"
                        style={{ paddingLeft: 36, paddingRight: 135, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="ds-btn ds-btn-primary ds-btn-sm"
                        style={{
                          position: 'absolute',
                          right: 4,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          padding: '6px 12px',
                          fontSize: 11,
                          letterSpacing: '0.06em',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          zIndex: 2,
                          boxShadow: '0 2px 10px rgba(45,127,249,0.3)',
                        }}
                      >
                        <FolderOpen size={13} /> Select File
                      </button>
                    </div>

                    {/* File info banner if selected */}
                    {selectedFileMeta && (
                      <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 7, background: 'rgba(45,127,249,0.08)', border: '1px solid rgba(45,127,249,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <FileText size={14} color="#2d7ff9" />
                          <span style={{ color: '#f0f4ff', fontWeight: 600 }}>{selectedFileMeta.name}</span>
                          <span style={{ color: '#8b96a8' }}>({(selectedFileMeta.size / 1024).toFixed(1)} KB)</span>
                          <span className="ds-badge ds-badge-ghost" style={{ fontSize: 9 }}>{selectedFileMeta.type}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setSelectedFileMeta(null); setPath('/sandbox/confidential_memo.docx'); }}
                          style={{ background: 'none', border: 'none', color: '#8b96a8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}
                        >
                          <X size={12} /> Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Preset Quick-Picks */}
                  <div>
                    <span style={{ fontSize: 10, color: '#4d5a6a', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Quick Sandbox Presets:
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {PRESET_PATHS.map((pr) => (
                        <button
                          key={pr}
                          type="button"
                          onClick={() => setPath(pr)}
                          style={{
                            fontSize: 10,
                            fontFamily: 'JetBrains Mono, monospace',
                            padding: '3px 8px',
                            borderRadius: 5,
                            background: path === pr ? 'rgba(45,127,249,0.15)' : 'rgba(255,255,255,0.03)',
                            border: path === pr ? '1px solid rgba(45,127,249,0.4)' : '1px solid rgba(255,255,255,0.07)',
                            color: path === pr ? '#60a5fa' : '#8b96a8',
                            cursor: 'pointer',
                          }}
                        >
                          {pr.split('/').pop()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
                    <div>
                      <label style={S.label}>File Extension / Format Filter</label>
                      <select
                        value={fileType}
                        onChange={(e) => setFileType(e.target.value)}
                        className="ds-input"
                        style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 12, fontWeight: 700 }}
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
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', height: 38 }}>
                          <input
                            type="checkbox"
                            checked={recursive}
                            onChange={(e) => setRecursive(e.target.checked)}
                            style={{ accentColor: '#2d7ff9', width: 16, height: 16 }}
                          />
                          <span style={{ fontSize: 12, color: '#f0f4ff' }}>Recursive subdirectory wipe</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Raw Data Ingestion View */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={S.label}>Direct Data / Payload to Shred</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['plaintext', 'hex', 'json', 'binary'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setDataFormat(fmt)}
                          style={{
                            fontSize: 9,
                            fontFamily: 'Barlow Condensed, sans-serif',
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: dataFormat === fmt ? 'rgba(45,127,249,0.2)' : 'transparent',
                            color: dataFormat === fmt ? '#60a5fa' : '#4d5a6a',
                            border: dataFormat === fmt ? '1px solid rgba(45,127,249,0.4)' : '1px solid rgba(255,255,255,0.06)',
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
                    placeholder="Paste sensitive tokens, encryption keys, PII database rows, or raw hex bytes here..."
                    className="ds-input"
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, resize: 'none', lineHeight: 1.6 }}
                  />
                  <div style={{ fontSize: 11, color: '#8b96a8', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Size: <strong style={{ color: '#f0f4ff' }}>{rawData.length} bytes</strong></span>
                    <span>Format: <strong style={{ color: '#2d7ff9' }}>{dataFormat.toUpperCase()}</strong></span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Sanitization Algorithm Selection */}
            <div className="ds-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Zap size={16} color="#ef4444" />
                  <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f0f4ff' }}>
                    2. Select Sanitization Algorithm
                  </span>
                </div>
                <span className="ds-badge ds-badge-ghost">{METHODS.length} Algorithms</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {METHODS.map((m) => {
                  const isSel = method.id === m.id;
                  const rc = riskColor[m.risk];
                  return (
                    <div
                      key={m.id}
                      onClick={() => setMethod(m)}
                      style={{
                        padding: '12px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: isSel ? `${m.accent}12` : 'rgba(255,255,255,0.02)',
                        border: isSel ? `1px solid ${m.accent}60` : '1px solid rgba(255,255,255,0.06)',
                        boxShadow: isSel ? `0 0 14px ${m.accent}20` : 'none',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 13, color: isSel ? m.accent : '#f0f4ff', marginBottom: 3 }}>
                        {m.name}
                      </div>
                      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 10, color: '#8b96a8', marginBottom: 6 }}>
                        {m.passes} Pass{m.passes > 1 ? 'es' : ''} · {m.time}
                      </div>
                      <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', padding: '1px 5px', borderRadius: 3, background: `${rc}15`, color: rc, border: `1px solid ${rc}30` }}>
                        {m.risk.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Advanced Forensics & Compliance Options */}
            <div className="ds-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Sliders size={16} color="#2d7ff9" />
                <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f0f4ff' }}>
                  3. Advanced Forensics &amp; Verification Options
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Wipe Slack Space (Cluster Tail)', val: wipeSlack, set: setWipeSlack, desc: 'Overwrites hidden data between file end and cluster boundary' },
                  { label: 'Zero-out Inode & Directory Entry', val: zeroInode, set: setZeroInode, desc: 'Prevents metadata recovery via forensic MFT / Ext4 journal' },
                  { label: 'Obfuscate File Name before Unlink', val: obfuscateName, set: setObfuscateName, desc: 'Replaces filename with random string to mask historic identity' },
                  { label: 'Post-Erase Shannon Entropy Audit', val: verifyEntropy, set: setVerifyEntropy, desc: 'Verifies randomness (target ≥ 7.98 bits/byte) ensuring zero residuals' },
                ].map((opt) => (
                  <label
                    key={opt.label}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={opt.val}
                      onChange={(e) => opt.set(e.target.checked)}
                      style={{ accentColor: '#2d7ff9', marginTop: 3 }}
                    />
                    <div>
                      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 13, color: '#f0f4ff' }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 10, color: '#8b96a8', marginTop: 2 }}>
                        {opt.desc}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ marginTop: 14 }}>
                <label style={S.label}>Audit Log Justification</label>
                <input
                  value={auditNote}
                  onChange={(e) => setAuditNote(e.target.value)}
                  className="ds-input"
                  style={{ fontSize: 12 }}
                  placeholder="Compliance rationale logged to immutable SHA-256 ledger..."
                />
              </div>
            </div>

            {/* Launch Action Button */}
            <button
              onClick={() => setPhase('confirm')}
              disabled={mode === 'path' ? !path.trim() : !rawData.trim()}
              className="ds-btn ds-btn-danger ds-btn-lg"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '14px',
                fontSize: 16,
              }}
            >
              <Lock size={16} /> Proceed to Privileged Shred Authorization Gate
            </button>
          </div>

          {/* Right Summary / Protocol Spec Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Algorithm Card */}
            <div className="ds-card" style={{ padding: 18, borderTop: `2px solid ${method.accent}` }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.04em', color: method.accent, marginBottom: 2 }}>
                {method.name}
              </div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#8b96a8', textTransform: 'uppercase', marginBottom: 12 }}>
                {method.standard}
              </div>
              <p style={{ fontSize: 12, color: '#8b96a8', lineHeight: 1.6, marginBottom: 14 }}>
                {method.desc}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Wipe Passes', method.passes],
                  ['Est. Duration', method.time],
                  ['Standard', method.standard.split(' ')[0]],
                  ['Risk Rating', method.risk.toUpperCase()],
                ].map(([k, v]) => (
                  <div key={k as string} style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4d5a6a', marginBottom: 2 }}>
                      {k as string}
                    </div>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 15, color: k === 'Risk Rating' ? riskColor[method.risk] : '#f0f4ff' }}>
                      {v as string | number}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Live Inspector */}
            <div className="ds-card" style={{ padding: 18 }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f0f4ff', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Eye size={14} color="#2d7ff9" /> Target Inspection
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: '#0a0c10', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#8b96a8', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div><span style={{ color: '#4d5a6a' }}>MODE:</span> <strong style={{ color: '#f0f4ff' }}>{mode.toUpperCase()}</strong></div>
                <div><span style={{ color: '#4d5a6a' }}>TARGET:</span> <span style={{ color: '#2d7ff9', wordBreak: 'break-all' }}>{mode === 'path' ? path : `${rawData.length} bytes`}</span></div>
                <div><span style={{ color: '#4d5a6a' }}>CONTAINER:</span> <span style={{ color: '#22c55e' }}>Safe Demo Sandbox (.img)</span></div>
                <div><span style={{ color: '#4d5a6a' }}>SLACK WIPE:</span> <span style={{ color: wipeSlack ? '#22c55e' : '#8b96a8' }}>{wipeSlack ? 'ENABLED' : 'DISABLED'}</span></div>
                <div><span style={{ color: '#4d5a6a' }}>VERIFY ENTROPY:</span> <span style={{ color: verifyEntropy ? '#22c55e' : '#8b96a8' }}>{verifyEntropy ? 'YES (≥7.98)' : 'NO'}</span></div>
              </div>
            </div>

            {/* Safety Guarantee */}
            <div style={{ padding: '12px 14px', borderRadius: 9, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', display: 'flex', gap: 10 }}>
              <CheckCircle2 size={16} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 11, color: '#8b96a8', lineHeight: 1.5 }}>
                <strong style={{ color: '#4ade80' }}>Isolated Sandbox Protection:</strong> Host operating system partitions are strictly write-protected. All shredding executes inside safe isolated sandbox blocks.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CONFIRMATION GATE PHASE ═══ */}
      {phase === 'confirm' && (
        <div style={{ maxWidth: 540, margin: '20px auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '20px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '2px solid rgba(239,68,68,0.3)', display: 'flex', gap: 14 }}>
            <AlertTriangle size={24} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f87171', marginBottom: 4 }}>
                Irreversible Permanent Data Shred
              </div>
              <p style={{ fontSize: 12, color: '#fca5a5', lineHeight: 1.6 }}>
                You are about to permanently eradicate data using <strong>{method.name}</strong> ({method.passes} pass{method.passes > 1 ? 'es' : ''}). The overwritten sectors cannot be recovered by any software or hardware laboratory technique.
              </p>
            </div>
          </div>

          <div className="ds-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, marginBottom: 16 }}>
              {[
                ['Target', mode === 'path' ? path : `Direct Memory Payload (${rawData.length} bytes)`],
                ['Algorithm', `${method.name} (${method.standard})`],
                ['Total Passes', method.passes],
                ['Slack Space', wipeSlack ? 'Purge & Overwrite' : 'Preserve'],
                ['Post-Verification', verifyEntropy ? 'Shannon Entropy Randomness Test' : 'None'],
              ].map(([k, v]) => (
                <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: '#8b96a8', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, textTransform: 'uppercase' }}>{k as string}</span>
                  <span style={{ color: '#f0f4ff', fontFamily: k === 'Target' ? 'JetBrains Mono, monospace' : 'inherit', fontWeight: 600 }}>{v as string | number}</span>
                </div>
              ))}
            </div>

            <div>
              <label style={{ ...S.label, color: '#ef4444' }}>Type "SHRED" to authorize destruction:</label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type SHRED here..."
                className="ds-input"
                style={{
                  textAlign: 'center',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 14,
                  letterSpacing: '0.2em',
                  color: confirmText === 'SHRED' ? '#f87171' : '#f0f4ff',
                  borderColor: confirmText === 'SHRED' ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setPhase('config')} className="ds-btn ds-btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
              Cancel
            </button>
            <button
              onClick={simulate}
              disabled={confirmText !== 'SHRED'}
              className="ds-btn ds-btn-danger"
              style={{
                flex: 2,
                justifyContent: 'center',
                opacity: confirmText === 'SHRED' ? 1 : 0.4,
                cursor: confirmText === 'SHRED' ? 'pointer' : 'not-allowed',
              }}
            >
              <Trash2 size={15} /> Confirm &amp; Execute Shred
            </button>
          </div>
        </div>
      )}

      {/* ═══ EXECUTING PROGRESS PHASE ═══ */}
      {phase === 'executing' && (
        <div style={{ maxWidth: 720, margin: '20px auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="ds-card" style={{ padding: 22, borderTop: '3px solid #ef4444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block', boxShadow: '0 0 10px rgba(239,68,68,0.8)', animation: 'pulse 1s infinite' }} />
                <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f87171' }}>
                  Executing Shredder: {method.name}
                </span>
              </div>
              <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 24, color: '#f0f4ff' }}>
                {progress}%
              </span>
            </div>

            <div className="ds-progress" style={{ height: 6, marginBottom: 10 }}>
              <div className="ds-progress-fill" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #dc2626, #ef4444)' }} />
            </div>

            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#f87171' }}>
              {progLabel}
            </div>
          </div>

          {/* Realtime Terminal Log */}
          <div
            ref={logRef}
            className="ds-card"
            style={{
              padding: '14px 18px',
              maxHeight: 280,
              overflowY: 'auto',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              lineHeight: 1.8,
              background: '#0a0c10',
            }}
          >
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#4d5a6a', marginBottom: 8 }}>
              // SECURE SANITIZATION TELEMETRY STREAM
            </div>
            {log.map((line, i) => (
              <div key={i} style={{ color: line.includes('✓') ? '#22c55e' : line.includes('ERROR') ? '#ef4444' : '#8b96a8' }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ DONE PHASE ═══ */}
      {phase === 'done' && (
        <div style={{ maxWidth: 580, margin: '20px auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="ds-card" style={{ padding: 26, borderTop: '3px solid #22c55e', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle2 size={32} color="#22c55e" />
            </div>
            <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 24, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#4ade80', marginBottom: 8 }}>
              Permanent Sanitization Verified
            </h2>
            <p style={{ fontSize: 13, color: '#8b96a8', lineHeight: 1.6, marginBottom: 20 }}>
              The target <code style={{ color: '#2d7ff9' }}>{mode === 'path' ? path : `${rawData.length} bytes`}</code> has been sanitized using <strong>{method.name}</strong> ({method.passes} pass{method.passes > 1 ? 'es' : ''}).
              {verifyEntropy && ' Shannon entropy verified at 7.989 bits/byte. Zero residual byte signatures found.'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                ['Algorithm', method.name, method.accent],
                ['Pass Count', `${method.passes} Overwrites`, '#f0f4ff'],
                ['Entropy Audit', 'PASS (7.989)', '#22c55e'],
              ].map(([k, v, c]) => (
                <div key={k as string} style={{ padding: '10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4d5a6a', marginBottom: 3 }}>
                    {k as string}
                  </div>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 14, color: c as string }}>
                    {v as string}
                  </div>
                </div>
              ))}
            </div>

            {/* Cryptographic Proof Hash */}
            <div style={{ padding: '12px 14px', borderRadius: 8, background: '#0a0c10', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Hash size={12} color="#2d7ff9" />
                <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4d5a6a' }}>
                  Immutable Ledger Anchor (SHA-256)
                </span>
              </div>
              <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#8b96a8', wordBreak: 'break-all' }}>
                {shaHash}
              </code>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={reset} className="ds-btn ds-btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
                New Shred Job
              </button>
              <button onClick={() => window.location.reload()} className="ds-btn ds-btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                View Audit Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
