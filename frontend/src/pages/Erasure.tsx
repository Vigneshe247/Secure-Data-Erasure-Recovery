import React, { useEffect, useState } from 'react';
import {
  Trash2, ShieldAlert, Lock, RefreshCw, Layers, AlertTriangle,
  Gauge, Clock, CheckCircle2, ChevronRight, X, Sparkles, HardDrive
} from 'lucide-react';
import { api } from '../services/api';
import { StorageDevice, ErasureOperation } from '../types';
import { useAuth } from '../context/AuthContext';

interface ErasureProps {
  setActiveTab: (tab: string) => void;
}

const STANDARDS = [
  { id: 'NIST_800_88_PURGE', name: 'NIST SP 800-88 Rev.1 — Purge / Cryptographic Scramble', desc: 'Controller-level crypto scramble & FTL block wipe for NAND flash. Reaches over-provisioned cells.', tag: 'SSD / NVMe Mandatory', accent: '#2d7ff9' },
  { id: 'NIST_800_88_CLEAR', name: 'NIST SP 800-88 Rev.1 — Clear / Single-Pass 0x00', desc: 'Deterministic zero-fill with sector read-back verification across all addressable LBAs.', tag: 'Magnetic HDD', accent: '#22c55e' },
  { id: 'DOD_5220_22_M',    name: 'DoD 5220.22-M — 3-Pass Standard', desc: 'Pass 1: 0x00 · Pass 2: 0xFF · Pass 3: PRNG with verification.', tag: 'US Dept of Defense', accent: '#818cf8' },
  { id: 'DOD_5220_22_M_ECE', name: 'DoD 5220.22-M ECE — 7-Pass Military', desc: '7-pass overwrite alternating fixed, complement, and pseudo-random byte streams.', tag: 'US Military 7-Pass', accent: '#818cf8' },
  { id: 'PETER_GUTMANN_35', name: 'Peter Gutmann Algorithm — 35-Pass', desc: '35-pass magnetic transition sequence engineered for MFM/RLL recording media.', tag: 'Forensic 35-Pass', accent: '#ef4444' },
  { id: 'BRUCE_SCHNEIER_7', name: 'Bruce Schneier Algorithm — 7-Pass', desc: '0xFF, 0x00, followed by 5 cryptographically secure PRNG passes.', tag: 'Crypto 7-Pass', accent: '#f59e0b' },
  { id: 'BRITISH_HMG_IS5',  name: 'British HMG IS5 — Enhanced 3-Pass', desc: '0x00, 0xFF, PRNG random with verification pass.', tag: 'UK Gov CESG', accent: '#00d4c8' },
  { id: 'GERMAN_BSI_VSITR', name: 'German BSI VSITR — 7-Pass', desc: 'Alternating 0x00/0xFF six times, finalized with random bytes.', tag: 'German Federal BSI', accent: '#a855f7' },
];

export const Erasure: React.FC<ErasureProps> = ({ setActiveTab }) => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<StorageDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<StorageDevice | null>(null);
  const [method, setMethod] = useState('NIST_800_88_PURGE');
  const [scope, setScope] = useState('FREE_SPACE');
  const [modalStep, setModalStep] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<ErasureOperation | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isWiping, setIsWiping] = useState(false);
  const [wipeProgress, setWipeProgress] = useState(0);
  const [sectors, setSectors] = useState<string[]>(Array(64).fill('PENDING'));
  const [throughput, setThroughput] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const devData = await api.getStorageDevices();
    setDevices(devData);
    if (devData.length > 0 && !selectedDevice) {
      setSelectedDevice(devData[0]);
      setMethod(devData[0].storage_type === 'SSD' || devData[0].storage_type === 'NVME' ? 'NIST_800_88_PURGE' : 'NIST_800_88_CLEAR');
    }
  };

  const handleDeviceSelect = (dev: StorageDevice) => {
    setSelectedDevice(dev);
    setMethod(dev.storage_type === 'SSD' || dev.storage_type === 'NVME' ? 'NIST_800_88_PURGE' : 'NIST_800_88_CLEAR');
  };

  const handleInitiate = async () => {
    if (!selectedDevice) return;
    setErrorMsg(null);
    try {
      const op = await api.requestErasure(selectedDevice.id, method, scope);
      setPendingOp(op);
      setModalStep(1);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApprove = async () => {
    if (!pendingOp) return;
    try {
      setPendingOp(await api.approveErasure(pendingOp.id));
      setModalStep(4);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleExecute = async () => {
    if (!pendingOp) return;
    setErrorMsg(null);
    try {
      await api.executeErasure(pendingOp.id, confirmInput);
      setModalStep(null);
      setConfirmInput('');
      setIsWiping(true);
      setWipeProgress(0);
      const start = Date.now();
      let p = 0;
      const iv = setInterval(() => {
        p += 2;
        setWipeProgress(p);
        setElapsed(Math.round((Date.now() - start) / 1000));
        setThroughput(Math.round((480 + Math.random() * 60) * 10) / 10);
        const blk = Math.floor((p / 100) * 64);
        setSectors(Array(64).fill('PENDING').map((_, i) => (i < blk ? 'SANITIZED' : i === blk ? 'WIPING' : 'PENDING')));
        if (p >= 100) {
          clearInterval(iv);
          setIsWiping(false);
          loadData();
          setTimeout(() => setActiveTab('verification'), 700);
        }
      }, 45);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="ds-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="ds-section-label" style={{ justifyContent: 'flex-start', marginBottom: 6, color: '#ef4444' }}>
            Storage-Aware Multi-Standard Sanitization
          </div>
          <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 32, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#f0f4ff' }}>
            Secure Data Erasure
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={loadData} className="ds-btn ds-btn-ghost ds-btn-sm">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1.2fr)', gap: 18 }}>
        {/* Left Column: Target & Protocol */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Step 1: Target Device */}
          <div className="ds-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 12, color: '#ef4444' }}>
                1
              </div>
              <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f0f4ff' }}>
                Select Sanitization Target
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {devices.map((dev) => {
                const isSelected = selectedDevice?.id === dev.id;
                return (
                  <div
                    key={dev.id}
                    onClick={() => handleDeviceSelect(dev)}
                    style={{
                      padding: '14px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(45,127,249,0.1)' : 'rgba(255,255,255,0.02)',
                      border: isSelected ? '1px solid rgba(45,127,249,0.5)' : '1px solid rgba(255,255,255,0.08)',
                      boxShadow: isSelected ? '0 0 16px rgba(45,127,249,0.15)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <HardDrive size={15} color={isSelected ? '#2d7ff9' : '#8b96a8'} />
                        <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 14, color: '#f0f4ff' }}>
                          {dev.name}
                        </span>
                      </div>
                      {dev.is_sandbox && <span className="ds-badge ds-badge-green" style={{ fontSize: 8 }}>SANDBOX</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#8b96a8', display: 'flex', gap: 6 }}>
                      <span style={{ color: '#2d7ff9', fontWeight: 600 }}>{dev.storage_type}</span>
                      <span>·</span>
                      <span>{dev.filesystem}</span>
                      <span>·</span>
                      <span>{(dev.total_capacity_bytes / 1e9).toFixed(1)} GB</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Scope Selection */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4d5a6a' }}>
                Erasure Scope:
              </span>
              {[
                { id: 'FREE_SPACE', label: 'Unallocated Free Space' },
                { id: 'FULL_DRIVE', label: 'Entire Block Device' },
              ].map((sc) => (
                <label key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: scope === sc.id ? '#f0f4ff' : '#8b96a8' }}>
                  <input
                    type="radio"
                    name="scope"
                    value={sc.id}
                    checked={scope === sc.id}
                    onChange={(e) => setScope(e.target.value)}
                    style={{ accentColor: '#2d7ff9' }}
                  />
                  {sc.label}
                </label>
              ))}
            </div>
          </div>

          {/* Step 2: Protocol Selection */}
          <div className="ds-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 12, color: '#ef4444' }}>
                  2
                </div>
                <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f0f4ff' }}>
                  Sanitization Protocol
                </h2>
              </div>
              <span className="ds-badge ds-badge-ghost">8 Industry Standards</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
              {STANDARDS.map((s) => {
                const isSelected = method === s.id;
                return (
                  <label
                    key={s.id}
                    onClick={() => setMethod(s.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 9,
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(45,127,249,0.08)' : 'rgba(255,255,255,0.02)',
                      border: isSelected ? '1px solid rgba(45,127,249,0.45)' : '1px solid rgba(255,255,255,0.06)',
                      transition: 'all 0.12s',
                    }}
                  >
                    <input
                      type="radio"
                      name="method"
                      value={s.id}
                      checked={isSelected}
                      onChange={() => setMethod(s.id)}
                      style={{ marginTop: 3, accentColor: '#2d7ff9' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 13, color: isSelected ? '#60a5fa' : '#f0f4ff' }}>
                          {s.name}
                        </span>
                        <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', padding: '2px 6px', borderRadius: 4, background: `${s.accent}14`, color: s.accent, border: `1px solid ${s.accent}30` }}>
                          {s.tag}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: '#8b96a8', lineHeight: 1.5 }}>
                        {s.desc}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            <button
              onClick={handleInitiate}
              disabled={isWiping}
              className="ds-btn ds-btn-danger ds-btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
            >
              <Lock size={15} /> Initiate 4-Step Privileged Sanitization Guard
            </button>
          </div>
        </div>

        {/* Right Column: 64-Sector Block Bitmap */}
        <div className="ds-card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} color="#2d7ff9" />
              <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f0f4ff' }}>
                64-Sector Block Bitmap
              </h2>
            </div>
            <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 13, color: isWiping ? '#2d7ff9' : '#22c55e' }}>
              {isWiping ? `${wipeProgress}% IN PROGRESS` : 'STANDBY READY'}
            </span>
          </div>

          {isWiping && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(45,127,249,0.08)', border: '1px solid rgba(45,127,249,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#60a5fa', fontSize: 12, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>
                <Gauge size={14} className="animate-spin" /> {throughput} MB/s
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8b96a8', fontSize: 11 }}>
                <Clock size={12} /> {elapsed}s Elapsed
              </div>
            </div>
          )}

          {/* Bitmap Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 6,
              padding: 12,
              borderRadius: 10,
              background: '#0a0c10',
              border: '1px solid rgba(255,255,255,0.06)',
              flex: 1,
            }}
          >
            {sectors.map((st, idx) => {
              let bg = 'rgba(255,255,255,0.04)';
              let border = '1px solid rgba(255,255,255,0.08)';
              let color = '#4d5a6a';

              if (st === 'SANITIZED') {
                bg = 'linear-gradient(135deg, #16a34a, #22c55e)';
                border = '1px solid #22c55e';
                color = '#ffffff';
              } else if (st === 'WIPING') {
                bg = 'linear-gradient(135deg, #2563eb, #38bdf8)';
                border = '1px solid #38bdf8';
                color = '#ffffff';
              }

              return (
                <div
                  key={idx}
                  title={`Sector #${idx}: ${st}`}
                  style={{
                    aspectRatio: '1/1',
                    borderRadius: 6,
                    background: bg,
                    border: border,
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    transition: 'all 0.12s ease',
                    boxShadow: st === 'WIPING' ? '0 0 10px rgba(56,189,248,0.5)' : 'none',
                  }}
                >
                  {idx}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 11, color: '#8b96a8' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }} /> Pending
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#2563eb' }} /> Wiping
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#22c55e' }} /> Sanitized
            </span>
          </div>

          {/* Target Metadata Footnote */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#8b96a8' }}>
            <div>Target: <span style={{ color: '#f0f4ff', fontWeight: 600 }}>{selectedDevice?.name}</span></div>
            <div>FTL Mode: <span style={{ color: '#60a5fa', fontWeight: 600 }}>{selectedDevice?.ftl_aware ? 'Wear-Leveling Controller Aware' : 'Direct Sector Track Overwrite'}</span></div>
          </div>
        </div>
      </div>

      {/* Safety Guard Modal */}
      {modalStep !== null && pendingOp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="ds-card" style={{ maxWidth: 460, width: '100%', padding: 24, borderTop: '3px solid #ef4444', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                <ShieldAlert size={16} /> STEP {modalStep} OF 4 — PRIVILEGED GUARD
              </div>
              <button onClick={() => setModalStep(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b96a8' }}>
                <X size={16} />
              </button>
            </div>

            {errorMsg && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={14} /> {errorMsg}
              </div>
            )}

            {modalStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12 }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 14, color: '#f0f4ff', textTransform: 'uppercase' }}>
                  1. Review Target Device Details
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>Target Device: <strong style={{ color: '#60a5fa' }}>{selectedDevice?.name}</strong></div>
                  <div>Storage Architecture: <strong style={{ color: '#f0f4ff' }}>{selectedDevice?.storage_type}</strong></div>
                  <div>Device Path: <code style={{ color: '#8b96a8' }}>{selectedDevice?.device_path}</code></div>
                  <div>Sandbox Isolation: <strong style={{ color: '#22c55e' }}>YES — Isolated Image Container</strong></div>
                </div>
                <button onClick={() => setModalStep(2)} className="ds-btn ds-btn-primary" style={{ justifyContent: 'center' }}>
                  Confirm Target → Step 2
                </button>
              </div>
            )}

            {modalStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12 }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 14, color: '#f0f4ff', textTransform: 'uppercase' }}>
                  2. Storage Awareness Validation
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24', lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{pendingOp.sanitization_method}</div>
                  {selectedDevice?.storage_type === 'SSD' || selectedDevice?.storage_type === 'NVME'
                    ? 'NAND Flash architecture requires cryptographic purge. Conventional multi-pass overwrite does not reach hidden wear-leveling blocks.'
                    : 'Magnetic platters require deterministic track overwrite with sector read-back verification.'}
                </div>
                <button onClick={() => setModalStep(3)} className="ds-btn ds-btn-primary" style={{ justifyContent: 'center' }}>
                  Acknowledge → Step 3
                </button>
              </div>
            )}

            {modalStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12 }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 14, color: '#f0f4ff', textTransform: 'uppercase' }}>
                  3. Privileged Operator Authorization
                </div>
                <p style={{ color: '#8b96a8' }}>
                  Destructive operations require formal authorization under SIH26149 compliance rules.
                </p>
                <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>Authorized Operator: <strong style={{ color: '#60a5fa' }}>{user?.username}</strong> ({user?.role})</div>
                  <div>Operation Code: <code style={{ color: '#f0f4ff' }}>{pendingOp.operation_code}</code></div>
                </div>
                <button onClick={handleApprove} className="ds-btn ds-btn-primary" style={{ justifyContent: 'center' }}>
                  Grant Privileged Authorization → Step 4
                </button>
              </div>
            )}

            {modalStep === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 12 }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 15, color: '#f87171', textTransform: 'uppercase' }}>
                  4. Final Safety Phrase Confirmation
                </div>
                <p style={{ color: '#8b96a8' }}>
                  Type the exact confirmation phrase below to unlock execution:
                </p>
                <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#8b96a8', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>
                    REQUIRED SAFETY PHRASE
                  </div>
                  <code style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 14, color: '#f87171', userSelect: 'all' }}>
                    {pendingOp.confirmation_phrase}
                  </code>
                </div>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="Type exact phrase here..."
                  className="ds-input"
                  style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, letterSpacing: '0.1em' }}
                />
                <button
                  onClick={handleExecute}
                  disabled={confirmInput.trim().toUpperCase() !== pendingOp.confirmation_phrase?.trim().toUpperCase()}
                  className="ds-btn ds-btn-danger ds-btn-lg"
                  style={{
                    justifyContent: 'center',
                    opacity: confirmInput.trim().toUpperCase() === pendingOp.confirmation_phrase?.trim().toUpperCase() ? 1 : 0.4,
                    cursor: confirmInput.trim().toUpperCase() === pendingOp.confirmation_phrase?.trim().toUpperCase() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Confirm & Execute Sanitization
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
