import React, { useEffect, useState } from 'react';
import {
  FileSearch, Plus, Play, CheckCircle2, Binary, Sparkles, Hash, Layers, X, FileText
} from 'lucide-react';
import { api } from '../services/api';
import { RecoveryCase, RecoveryCandidate, StorageDevice } from '../types';
import { HexViewer } from '../components/HexViewer';

const S = {
  card: {
    background: '#FFFFFF',
    border: '1px solid var(--c-border)',
    borderRadius: 14,
    boxShadow: '0 10px 30px -4px rgba(30, 34, 41, 0.05), 0 2px 10px -2px rgba(30, 34, 41, 0.03)',
  } as React.CSSProperties,
  label: {
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: '#5E6676',
  },
  heading: {
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: '#1E2229',
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
  } as React.CSSProperties,
  select: {
    background: '#FFFFFF',
    border: '1px solid #E2DED7',
    borderRadius: 14,
    padding: '8px 14px',
    color: '#1E2229',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontSize: 12,
    fontWeight: 700,
    outline: 'none',
  } as React.CSSProperties,
};

const badge = (color: string, text: string) => (
  <span
    style={{
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      padding: '3px 9px',
      borderRadius: 12,
      background: `${color}14`,
      color,
      border: `1px solid ${color}28`,
    }}
  >
    {text}
  </span>
);

export const Recovery: React.FC = () => {
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<RecoveryCase | null>(null);
  const [devices, setDevices] = useState<StorageDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedCand, setSelectedCand] = useState<RecoveryCandidate | null>(null);
  const [recoveringIds, setRecoveringIds] = useState<string[]>([]);
  const [hexCand, setHexCand] = useState<RecoveryCandidate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [scanPct, setScanPct] = useState(0);
  const [scanSector, setScanSector] = useState(0);
  const [scanHex, setScanHex] = useState('');

  const load = async () => {
    const [c, d] = await Promise.all([api.getRecoveryCases(), api.getStorageDevices()]);
    setCases(c);
    setDevices(d);
    if (c.length > 0) setSelectedCase(c[0]);
    if (d.length > 0) setNewDeviceId(d[0].id);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const nc = await api.createRecoveryCase(newTitle, newDeviceId, newNotes);
      setIsModalOpen(false);
      setNewTitle('');
      await load();
      setSelectedCase(nc);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleScan = async () => {
    if (!selectedCase) return;
    setScanning(true);
    setScanPct(0);
    const HEX = ['FF D8 FF E0', '89 50 4E 47', '25 50 44 46', '50 4B 03 04'];
    let p = 0;
    const iv = setInterval(() => {
      p += 8;
      setScanPct(Math.min(p, 100));
      setScanSector(p * 128);
      setScanHex(HEX[Math.floor(Math.random() * HEX.length)]);
      if (p >= 100) clearInterval(iv);
    }, 120);

    try {
      await api.scanRecoveryCase(selectedCase.id);
      setTimeout(async () => {
        setScanning(false);
        const u = await api.getRecoveryCase(selectedCase.id);
        setSelectedCase(u);
        await load();
      }, 1200);
    } catch (err: any) {
      clearInterval(iv);
      setScanning(false);
      alert(err.message);
    }
  };

  const handleRecover = async (id: string) => {
    setRecoveringIds((p) => [...p, id]);
    try {
      await api.recoverCandidates([id]);
      if (selectedCase) setSelectedCase(await api.getRecoveryCase(selectedCase.id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRecoveringIds((p) => p.filter((i) => i !== id));
    }
  };

  const [generatingReport, setGeneratingReport] = useState(false);
  const handleExportReport = async () => {
    if (!selectedCase) return;
    setGeneratingReport(true);
    try {
      const report = await api.generateRecoveryReport(selectedCase.id);
      window.open(api.getReportPdfUrl(report.id), '_blank');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGeneratingReport(false);
    }
  };

  const intColor: Record<string, string> = { PASS: '#16A34A', PARTIAL: '#D97706', FAIL: '#DC2626', CORRUPT: '#DC2626' };

  return (
    <div className="ds-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ ...S.label, color: '#D97706', marginBottom: 6 }}>
            Forensic Deleted-File Carving &amp; Integrity Validation
          </div>
          <h1 style={{ ...S.heading, fontSize: 32 }}>Authorized File Recovery</h1>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="ds-btn ds-btn-primary ds-btn-sm"
        >
          <Plus size={14} /> New Forensic Case
        </button>
      </div>

      {/* Case Selector Bar */}
      <div style={{ ...S.card, padding: '16px 22px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ ...S.label }}>Active Case:</span>
          <select
            value={selectedCase?.id || ''}
            onChange={(e) => {
              const c = cases.find((i) => i.id === e.target.value);
              if (c) setSelectedCase(c);
            }}
            style={S.select}
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.case_number} · {c.title}
              </option>
            ))}
          </select>
        </div>
        {selectedCase && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ fontSize: 13, color: '#5E6676' }}>
              Candidates: <strong style={{ color: '#1E2229' }}>{selectedCase.total_candidates}</strong>
            </div>
            <div style={{ fontSize: 13, color: '#5E6676' }}>
              Recovered: <strong style={{ color: '#16A34A' }}>{selectedCase.recovered_count}</strong>
            </div>
            <button
              onClick={handleExportReport}
              disabled={generatingReport}
              className="ds-btn ds-btn-ghost"
              style={{ padding: '8px 18px', borderRadius: 14 }}
            >
              <FileText size={12} /> {generatingReport ? 'Generating...' : 'Export Report'}
            </button>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="ds-btn"
              style={{
                background: scanning ? '#FAF8F5' : 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)',
                color: scanning ? '#94A3B8' : '#FFFFFF',
                boxShadow: scanning ? 'none' : '0 4px 16px rgba(255,126,95,0.3)',
                padding: '8px 18px',
                borderRadius: 14,
              }}
            >
              <Play size={12} style={{ fill: scanning ? '#94A3B8' : '#FFFFFF' }} /> {scanning ? 'Carving Sectors...' : 'Execute Recovery Scan'}
            </button>
          </div>
        )}
      </div>

      {/* Scan Progress */}
      {scanning && (
        <div style={{ ...S.card, padding: '16px 20px', borderLeft: '3px solid #FF7E5F', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: '#FF7E5F' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF7E5F', boxShadow: '0 0 8px rgba(255,126,95,0.7)', display: 'inline-block' }} />
              LIVE CARVER · SECTOR #{scanSector}
            </div>
            <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 15, color: '#1E2229' }}>
              {scanPct}%
            </span>
          </div>
          <div style={{ padding: '10px 14px', borderRadius: 12, background: '#FAF8F5', border: '1px solid var(--c-border)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#16A34A' }}>
            <span style={{ color: '#94A3B8', fontSize: 11 }}>SECTOR BUFFER: </span>{scanHex} <span style={{ color: '#94A3B8' }}>...</span>
          </div>
          <div className="ds-progress">
            <div className="ds-progress-fill" style={{ width: `${scanPct}%` }} />
          </div>
        </div>
      )}

      {/* Candidates Table */}
      {selectedCase && (
        <div style={{ ...S.card, overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Layers size={16} color="#FF7E5F" />
              <span style={{ ...S.heading, fontSize: 16 }}>Detected File Candidates</span>
              <span style={{ ...S.label, fontSize: 12, color: '#94A3B8' }}>({selectedCase.candidates?.length || 0})</span>
            </div>
            <span className="ds-badge" style={{ background: '#E6EFFB', color: '#2B579A', border: '1px solid #D0E0F7' }}>
              Magic-Byte Carving
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="ds-table">
              <thead>
                <tr>
                  {['Candidate File', 'Format', 'Byte Offset', 'Size', 'Integrity', 'Confidence', 'Actions'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedCase.candidates?.map((cand) => {
                  const isRec = recoveringIds.includes(cand.id);
                  const isRecovered = cand.recovery_status === 'RECOVERED';
                  const ic = intColor[cand.integrity_status] || '#5E6676';

                  return (
                    <tr key={cand.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <FileSearch size={14} color="#94A3B8" />
                          <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 13, color: '#1E2229' }}>
                            {cand.file_name}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="ds-badge" style={{ background: '#E6EFFB', color: '#2B579A', border: '1px solid #D0E0F7' }}>
                          {cand.detected_format}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#5E6676' }}>
                        0x{cand.byte_offset.toString(16).toUpperCase()}
                      </td>
                      <td style={{ fontSize: 12, color: '#5E6676' }}>
                        {(cand.file_size_bytes / 1024).toFixed(1)} KB
                      </td>
                      <td>{badge(ic, cand.integrity_status)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 14, color: cand.confidence_score >= 80 ? '#16A34A' : '#D97706' }}>
                            {cand.confidence_score}%
                          </span>
                          <span style={{ fontSize: 11, color: '#94A3B8' }}>({cand.confidence_level})</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            onClick={() => setHexCand(cand)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '5px 12px',
                              borderRadius: 10,
                              border: '1px solid #D0E0F7',
                              background: '#E6EFFB',
                              color: '#2B579A',
                              cursor: 'pointer',
                              fontFamily: 'Plus Jakarta Sans, sans-serif',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            <Binary size={12} /> Hex
                          </button>
                          <button
                            onClick={() => setSelectedCand(cand)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '5px 12px',
                              borderRadius: 10,
                              border: '1px solid rgba(255,126,95,0.25)',
                              background: 'rgba(255,126,95,0.08)',
                              color: '#FF7E5F',
                              cursor: 'pointer',
                              fontFamily: 'Plus Jakarta Sans, sans-serif',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            <Sparkles size={12} /> AI
                          </button>
                          {isRecovered ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '5px 12px',
                                borderRadius: 10,
                                background: 'rgba(22,163,74,0.08)',
                                border: '1px solid rgba(22,163,74,0.22)',
                                color: '#16A34A',
                                fontFamily: 'Plus Jakarta Sans, sans-serif',
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              <CheckCircle2 size={12} /> Done
                            </span>
                          ) : cand.recovery_status === 'UNRECOVERABLE' ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '5px 12px',
                                borderRadius: 10,
                                background: 'rgba(220,38,38,0.08)',
                                border: '1px solid rgba(220,38,38,0.22)',
                                color: '#DC2626',
                                fontFamily: 'Plus Jakarta Sans, sans-serif',
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              <X size={12} /> Wiped
                            </span>
                          ) : (
                            <button
                              onClick={() => handleRecover(cand.id)}
                              disabled={isRec}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '5px 12px',
                                borderRadius: 10,
                                border: 'none',
                                background: isRec ? '#EAE5DE' : 'linear-gradient(135deg, #16A34A, #15803D)',
                                color: '#fff',
                                cursor: 'pointer',
                                fontFamily: 'Plus Jakarta Sans, sans-serif',
                                fontSize: 11,
                                fontWeight: 700,
                                opacity: isRec ? 0.6 : 1,
                              }}
                            >
                              {isRec ? 'Working...' : 'Recover'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(!selectedCase.candidates || selectedCase.candidates.length === 0) && (
              <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14 }}>
                Run a recovery scan to detect file candidates
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hex Inspector Modal */}
      {hexCand && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30, 34, 41, 0.6)', backdropFilter: 'blur(6px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ maxWidth: 900, width: '100%', background: '#FFFFFF', borderRadius: 14, padding: 20, boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ ...S.heading, fontSize: 15 }}>Hex Inspector — {hexCand.file_name}</span>
              <button onClick={() => setHexCand(null)} className="ds-btn ds-btn-ghost ds-btn-sm">
                <X size={13} /> Close
              </button>
            </div>
            <HexViewer initialOffset={hexCand.byte_offset} fileName={hexCand.file_name} detectedFormat={hexCand.detected_format} />
          </div>
        </div>
      )}

      {/* Explainable AI Confidence Modal */}
      {selectedCand && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30, 34, 41, 0.6)', backdropFilter: 'blur(6px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ ...S.card, maxWidth: 500, width: '100%', padding: 28, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--c-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color="#FF7E5F" />
                <span style={{ ...S.heading, fontSize: 16 }}>Explainable AI Confidence</span>
              </div>
              <button onClick={() => setSelectedCand(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 14, color: '#1E2229', marginBottom: 14 }}>
              {selectedCand.file_name}
            </div>

            <div style={{ background: '#FAF8F5', borderRadius: 14, padding: '16px 18px', border: '1px solid var(--c-border)', marginBottom: 14 }}>
              <div style={{ ...S.label, marginBottom: 10 }}>Confidence Determinants</div>
              {[
                ['Signature Match', selectedCand.signature_match_pct],
                ['Structural Validity', selectedCand.structure_validity_pct],
                ['Fragment Continuity', selectedCand.continuity_pct],
                ['Metadata Quality', selectedCand.metadata_quality_pct],
              ].map(([k, v]) => (
                <div key={k as string} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: '#5E6676' }}>{k as string}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 110, height: 5, borderRadius: 99, background: '#EAE5DE', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #FF7E5F, #FEB47B)', width: `${v}%` }} />
                    </div>
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 13, color: '#FF7E5F', minWidth: 32, textAlign: 'right' }}>
                      {v}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {selectedCand.ai_explanation && (
              <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255, 126, 95, 0.08)', border: '1px solid rgba(255, 126, 95, 0.2)', fontSize: 12, color: '#B45309', lineHeight: 1.7, marginBottom: 14 }}>
                {selectedCand.ai_explanation}
              </div>
            )}

            {selectedCand.sha256_hash && (
              <div style={{ padding: '10px 14px', borderRadius: 12, background: '#FAF8F5', border: '1px solid var(--c-border)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Hash size={13} color="#FF7E5F" style={{ flexShrink: 0, marginTop: 2 }} />
                <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#5E6676', wordBreak: 'break-all' }}>
                  SHA-256: {selectedCand.sha256_hash}
                </code>
              </div>
            )}

            <button onClick={() => setSelectedCand(null)} className="ds-btn ds-btn-ghost" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* New Case Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30, 34, 41, 0.6)', backdropFilter: 'blur(6px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ ...S.card, maxWidth: 460, width: '100%', padding: 28, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ ...S.heading, fontSize: 17 }}>Create Forensic Recovery Case</div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ ...S.label, marginBottom: 6, display: 'block' }}>Case Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  placeholder="e.g. Incident Triage 2026-A"
                  style={S.input}
                />
              </div>

              <div>
                <label style={{ ...S.label, marginBottom: 6, display: 'block' }}>Target Storage Device</label>
                <select value={newDeviceId} onChange={(e) => setNewDeviceId(e.target.value)} style={{ ...S.select, width: '100%' }}>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.storage_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ ...S.label, marginBottom: 6, display: 'block' }}>Case Notes</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={3}
                  placeholder="Authorized investigation under SIH26149 guidelines..."
                  style={{ ...S.input, resize: 'none', lineHeight: 1.6 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 6 }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="ds-btn ds-btn-ghost ds-btn-sm">
                  Cancel
                </button>
                <button type="submit" className="ds-btn ds-btn-primary ds-btn-sm">
                  Create Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
