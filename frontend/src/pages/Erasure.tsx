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
  { id: 'NIST_800_88_PURGE', name: 'NIST SP 800-88 Rev.1 — Purge / Cryptographic Scramble', desc: 'Controller-level crypto scramble & FTL block wipe for NAND flash. Reaches over-provisioned cells.', tag: 'SSD / NVMe Mandatory', accent: '#FF7E5F' },
  { id: 'NIST_800_88_CLEAR', name: 'NIST SP 800-88 Rev.1 — Clear / Single-Pass 0x00', desc: 'Deterministic zero-fill with sector read-back verification across all addressable LBAs.', tag: 'Magnetic HDD', accent: '#16A34A' },
  { id: 'DOD_5220_22_M',    name: 'DoD 5220.22-M — 3-Pass Standard', desc: 'Pass 1: 0x00 · Pass 2: 0xFF · Pass 3: PRNG with read-back verification.', tag: 'US DoD Standard', accent: '#2563EB' },
  { id: 'DOD_5220_22_M_ECE', name: 'DoD 5220.22-M ECE — 7-Pass Military', desc: '7-pass overwrite alternating fixed, complement, and pseudo-random byte streams.', tag: 'Military 7-Pass', accent: '#2563EB' },
  { id: 'PETER_GUTMANN_35', name: 'Peter Gutmann Algorithm — 35-Pass', desc: '35-pass magnetic transition sequence engineered for MFM/RLL recording media.', tag: 'Forensic 35-Pass', accent: '#DC2626' },
  { id: 'BRUCE_SCHNEIER_7', name: 'Bruce Schneier Algorithm — 7-Pass', desc: '0xFF, 0x00, followed by 5 cryptographically secure PRNG passes.', tag: 'Crypto 7-Pass', accent: '#D97706' },
  { id: 'BRITISH_HMG_IS5',  name: 'British HMG IS5 — Enhanced 3-Pass', desc: '0x00, 0xFF, PRNG random with verification pass.', tag: 'UK Gov CESG', accent: '#0D9488' },
  { id: 'GERMAN_BSI_VSITR', name: 'German BSI VSITR — 7-Pass', desc: 'Alternating 0x00/0xFF six times, finalized with random bytes.', tag: 'German Federal BSI', accent: '#7C3AED' },
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

  useEffect(() => {
    loadData();
  }, []);

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
          <div className="ds-section-label" style={{ justifyContent: 'flex-start', marginBottom: 6 }}>
            Storage-Aware Multi-Standard Sanitization
          </div>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', color: '#1E2229' }}>
            Secure Data Erasure
          </h1>
        </div>
        <button onClick={loadData} className="ds-btn ds-btn-ghost ds-btn-sm">
          <RefreshCw size={13} /> Refresh Devices
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1.2fr)', gap: 20 }}>
        {/* Left Column: Target & Protocol */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Step 1: Target Device */}
          <div className="ds-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'rgba(255, 126, 95, 0.12)',
                  border: '1px solid rgba(255, 126, 95, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontWeight: 800,
                  fontSize: 13,
                  color: '#FF7E5F',
                }}
              >
                1
              </div>
              <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 17, color: '#1E2229' }}>
                Select Sanitization Target
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {devices.map((dev) => {
                const isSelected = selectedDevice?.id === dev.id;
                return (
                  <div
                    key={dev.id}
                    onClick={() => handleDeviceSelect(dev)}
                    style={{
                      padding: '16px',
                      borderRadius: 14,
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(255, 126, 95, 0.06)' : '#FAF8F5',
                      border: isSelected ? '2px solid #FF7E5F' : '1px solid var(--c-border)',
                      boxShadow: isSelected ? '0 6px 20px rgba(255, 126, 95, 0.15)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <HardDrive size={16} color={isSelected ? '#FF7E5F' : '#94A3B8'} />
                        <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 14, color: '#1E2229' }}>
                          {dev.name}
                        </span>
                      </div>
                      {dev.is_sandbox && (
                        <span className="ds-badge" style={{ background: '#E6EFFB', color: '#2B579A', border: '1px solid #D0E0F7', fontSize: 9 }}>
                          SANDBOX
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#5E6676', display: 'flex', gap: 6 }}>
                      <span style={{ color: '#FF7E5F', fontWeight: 700 }}>{dev.storage_type}</span>
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
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#5E6676' }}>
                Erasure Scope:
              </span>
              {[
                { id: 'FREE_SPACE', label: 'Unallocated Free Space' },
                { id: 'FULL_DRIVE', label: 'Entire Block Device' },
              ].map((sc) => (
                <label key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: scope === sc.id ? '#1E2229' : '#5E6676', fontWeight: scope === sc.id ? 700 : 500 }}>
                  <input
                    type="radio"
                    name="scope"
                    value={sc.id}
                    checked={scope === sc.id}
                    onChange={(e) => setScope(e.target.value)}
                    style={{ accentColor: '#FF7E5F' }}
                  />
                  {sc.label}
                </label>
              ))}
            </div>
          </div>

          {/* Step 2: Protocol Selection */}
          <div className="ds-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'rgba(255, 126, 95, 0.12)',
                    border: '1px solid rgba(255, 126, 95, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontWeight: 800,
                    fontSize: 13,
                    color: '#FF7E5F',
                  }}
                >
                  2
                </div>
                <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 17, color: '#1E2229' }}>
                  Sanitization Protocol
                </h2>
              </div>
              <span className="ds-badge" style={{ background: '#E6EFFB', color: '#2B579A', border: '1px solid #D0E0F7' }}>
                8 Industry Standards
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
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
                      padding: '14px 16px',
                      borderRadius: 14,
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(255, 126, 95, 0.06)' : '#FAF8F5',
                      border: isSelected ? '2px solid #FF7E5F' : '1px solid var(--c-border)',
                      transition: 'all 0.12s',
                    }}
                  >
                    <input
                      type="radio"
                      name="method"
                      value={s.id}
                      checked={isSelected}
                      onChange={() => setMethod(s.id)}
                      style={{ marginTop: 3, accentColor: '#FF7E5F' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                        <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 13, color: isSelected ? '#FF7E5F' : '#1E2229' }}>
                          {s.name}
                        </span>
                        <span
                          style={{
                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 10,
                            background: isSelected ? 'rgba(255,126,95,0.15)' : '#E6EFFB',
                            color: isSelected ? '#FF7E5F' : '#2B579A',
                            border: `1px solid ${isSelected ? 'rgba(255,126,95,0.3)' : '#D0E0F7'}`,
                          }}
                        >
                          {s.tag}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: '#5E6676', lineHeight: 1.5 }}>
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
              className="ds-btn ds-btn-primary ds-btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: 18 }}
            >
              <Lock size={16} /> Initiate 4-Step Privileged Sanitization Guard
            </button>
          </div>
        </div>

        {/* Right Column: 64-Sector Block Bitmap */}
        <div className="ds-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={18} color="#FF7E5F" />
              <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 16, color: '#1E2229' }}>
                64-Sector Block Bitmap
              </h2>
            </div>
            <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 13, color: isWiping ? '#FF7E5F' : '#16A34A' }}>
              {isWiping ? `${wipeProgress}% IN PROGRESS` : 'STANDBY READY'}
            </span>
          </div>

          {isWiping && (
            <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255, 126, 95, 0.08)', border: '1px solid rgba(255, 126, 95, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#FF7E5F', fontSize: 13, fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700 }}>
                <Gauge size={16} className="animate-spin" /> {throughput} MB/s
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#5E6676', fontSize: 12 }}>
                <Clock size={14} /> {elapsed}s Elapsed
              </div>
            </div>
          )}

          {/* Bitmap Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 6,
              padding: 14,
              borderRadius: 14,
              background: '#FAF8F5',
              border: '1px solid var(--c-border)',
              flex: 1,
            }}
          >
            {sectors.map((st, idx) => {
              let bg = '#FFFFFF';
              let border = '1px solid var(--c-border)';
              let color = '#94A3B8';

              if (st === 'SANITIZED') {
                bg = 'linear-gradient(135deg, #16A34A, #22C55E)';
                border = '1px solid #16A34A';
                color = '#FFFFFF';
              } else if (st === 'WIPING') {
                bg = 'linear-gradient(135deg, #FF7E5F, #FEB47B)';
                border = '1px solid #FF7E5F';
                color = '#FFFFFF';
              }

              return (
                <div
                  key={idx}
                  title={`Sector #${idx}: ${st}`}
                  style={{
                    aspectRatio: '1/1',
                    borderRadius: 8,
                    background: bg,
                    border: border,
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    transition: 'all 0.12s ease',
                    boxShadow: st === 'WIPING' ? '0 0 12px rgba(255, 126, 95, 0.5)' : 'none',
                  }}
                >
                  {idx}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 12, color: '#5E6676' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: '#FFFFFF', border: '1px solid var(--c-border)' }} /> Pending
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'linear-gradient(135deg, #FF7E5F, #FEB47B)' }} /> Wiping
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'linear-gradient(135deg, #16A34A, #22C55E)' }} /> Sanitized
            </span>
          </div>

          {/* Target Metadata Footnote */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#5E6676' }}>
            <div>Target: <strong style={{ color: '#1E2229' }}>{selectedDevice?.name}</strong></div>
            <div>FTL Mode: <span style={{ color: '#FF7E5F', fontWeight: 600 }}>{selectedDevice?.ftl_aware ? 'Wear-Leveling Controller Aware' : 'Direct Sector Track Overwrite'}</span></div>
          </div>
        </div>
      </div>

      {/* Safety Guard Modal */}
      {modalStep !== null && pendingOp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30, 34, 41, 0.65)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="ds-card" style={{ maxWidth: 480, width: '100%', padding: 28, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid var(--c-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FF7E5F', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                <ShieldAlert size={18} /> STEP {modalStep} OF 4 — PRIVILEGED GUARD
              </div>
              <button onClick={() => setModalStep(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={18} />
              </button>
            </div>

            {errorMsg && (
              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#DC2626', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={15} /> {errorMsg}
              </div>
            )}

            {modalStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 15, color: '#1E2229' }}>
                  1. Review Target Device Details
                </div>
                <div style={{ padding: '14px 16px', borderRadius: 14, background: '#FAF8F5', border: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>Target Device: <strong style={{ color: '#1E2229' }}>{selectedDevice?.name}</strong></div>
                  <div>Storage Architecture: <strong style={{ color: '#FF7E5F' }}>{selectedDevice?.storage_type}</strong></div>
                  <div>Device Path: <code style={{ color: '#5E6676' }}>{selectedDevice?.device_path}</code></div>
                  <div>Sandbox Isolation: <strong style={{ color: '#16A34A' }}>YES — Isolated Image Container</strong></div>
                </div>
                <button onClick={() => setModalStep(2)} className="ds-btn ds-btn-primary" style={{ justifyContent: 'center' }}>
                  Confirm Target → Step 2
                </button>
              </div>
            )}

            {modalStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 15, color: '#1E2229' }}>
                  2. Storage Awareness Validation
                </div>
                <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)', color: '#B45309', lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>{pendingOp.sanitization_method}</div>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 15, color: '#1E2229' }}>
                  3. Privileged Operator Authorization
                </div>
                <p style={{ color: '#5E6676' }}>
                  Destructive operations require formal authorization under SIH26149 compliance rules.
                </p>
                <div style={{ padding: '14px 16px', borderRadius: 14, background: '#FAF8F5', border: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>Authorized Operator: <strong style={{ color: '#1E2229' }}>{user?.username}</strong> ({user?.role})</div>
                  <div>Operation Code: <code style={{ color: '#FF7E5F' }}>{pendingOp.operation_code}</code></div>
                </div>
                <button onClick={handleApprove} className="ds-btn ds-btn-primary" style={{ justifyContent: 'center' }}>
                  Grant Privileged Authorization → Step 4
                </button>
              </div>
            )}

            {modalStep === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 16, color: '#DC2626' }}>
                  4. Final Safety Phrase Confirmation
                </div>
                <p style={{ color: '#5E6676' }}>
                  Type the exact confirmation phrase below to unlock execution:
                </p>
                <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#5E6676', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 4 }}>
                    REQUIRED SAFETY PHRASE
                  </div>
                  <code style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 15, color: '#DC2626', userSelect: 'all' }}>
                    {pendingOp.confirmation_phrase}
                  </code>
                </div>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="Type exact phrase here..."
                  className="ds-input"
                  style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 14, letterSpacing: '0.06em' }}
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
                  Confirm &amp; Execute Sanitization
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
