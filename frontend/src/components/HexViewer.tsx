import React, { useState } from 'react';
import { Binary, Search, RefreshCw, Hash, FileCode, CheckCircle2, Copy } from 'lucide-react';

interface HexViewerProps {
  initialOffset?: number;
  dataBytes?: number[];
  fileName?: string;
  detectedFormat?: string;
}

export const HexViewer: React.FC<HexViewerProps> = ({
  initialOffset = 0x0000,
  dataBytes,
  fileName = 'sector_dump_0x0000.bin',
  detectedFormat = 'PDF',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  // Generate 256 or 512 deterministic bytes if not provided
  const bytes = React.useMemo(() => {
    if (dataBytes && dataBytes.length > 0) return dataBytes;

    // Default sample header matching format
    const sample: number[] = [];
    if (detectedFormat === 'PDF') {
      sample.push(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xd3, 0xf4, 0xcc, 0xe1, 0x0a, 0x31);
    } else if (detectedFormat === 'JPG' || detectedFormat === 'JPEG') {
      sample.push(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48);
    } else if (detectedFormat === 'PNG') {
      sample.push(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52);
    } else {
      sample.push(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00, 0x59, 0x78, 0x84, 0x54, 0x00, 0x00);
    }

    // Fill remaining bytes
    for (let i = sample.length; i < 256; i++) {
      sample.push((i * 17 + 43) % 256);
    }
    return sample;
  }, [dataBytes, detectedFormat]);

  // Group into rows of 16 bytes
  const rows: { offset: string; hex: string[]; ascii: string }[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const slice = bytes.slice(i, i + 16);
    const hex = slice.map((b) => b.toString(16).padStart(2, '0').toUpperCase());
    const ascii = slice
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('');
    const offset = (initialOffset + i).toString(16).padStart(8, '0').toUpperCase();
    rows.push({ offset, hex, ascii });
  }

  const handleCopyHex = () => {
    const text = rows
      .map((r) => `${r.offset}  ${r.hex.join(' ')}  |${r.ascii}|`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        padding: 20,
        borderRadius: 14,
        background: '#FFFFFF',
        border: '1px solid var(--c-border)',
        boxShadow: '0 10px 30px -4px rgba(30, 34, 41, 0.05)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Hex Viewer Header Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid var(--c-border)', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              padding: 8,
              borderRadius: 10,
              background: 'rgba(255, 126, 95, 0.12)',
              color: '#FF7E5F',
              border: '1px solid rgba(255, 126, 95, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Binary size={16} />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#1E2229', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{fileName}</span>
              <span className="ds-badge" style={{ background: '#E6EFFB', color: '#2B579A', border: '1px solid #D0E0F7', fontSize: 10 }}>
                {detectedFormat} Signature
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#5E6676', marginTop: 2, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              512-Byte Raw Sector Inspector · 16-Byte Row Alignment
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ color: '#94A3B8', position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search Hex / ASCII..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ds-input"
              style={{ paddingLeft: 32, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 12, width: 180 }}
            />
          </div>

          <button
            onClick={handleCopyHex}
            className="ds-btn ds-btn-ghost ds-btn-sm"
          >
            {copied ? <CheckCircle2 size={13} color="#16A34A" /> : <Copy size={13} color="#FF7E5F" />}
            <span>{copied ? 'Copied' : 'Copy Dump'}</span>
          </button>
        </div>
      </div>

      {/* Hex Dump Matrix */}
      <div
        style={{
          overflowX: 'auto',
          padding: 14,
          borderRadius: 12,
          background: '#FAF8F5',
          border: '1px solid var(--c-border)',
        }}
      >
        <div style={{ minWidth: 620, fontSize: 11, lineHeight: 1.8 }}>
          {/* Column Index Header */}
          <div style={{ display: 'flex', color: '#94A3B8', fontWeight: 700, borderBottom: '1px solid var(--c-border)', paddingBottom: 4, marginBottom: 8, userSelect: 'none' }}>
            <span style={{ width: 90 }}>OFFSET</span>
            <span style={{ flex: 1, letterSpacing: '0.12em' }}>
              00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F
            </span>
            <span style={{ width: 150, paddingLeft: 16 }}>DECODED ASCII</span>
          </div>

          {/* Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {rows.map((row, idx) => {
              const isFirstRow = idx === 0;
              const matchesSearch =
                searchTerm &&
                (row.hex.join('').toLowerCase().includes(searchTerm.toLowerCase()) ||
                  row.ascii.toLowerCase().includes(searchTerm.toLowerCase()));

              return (
                <div
                  key={row.offset}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '2px 4px',
                    borderRadius: 6,
                    background: matchesSearch ? 'rgba(255, 126, 95, 0.15)' : 'transparent',
                    border: matchesSearch ? '1px solid #FF7E5F' : '1px solid transparent',
                  }}
                >
                  <span style={{ width: 90, color: '#FF7E5F', fontWeight: 700, userSelect: 'none' }}>{row.offset}</span>
                  <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                    {row.hex.map((h, bIdx) => {
                      const isMagicByte = isFirstRow && bIdx < 4;
                      return (
                        <span
                          key={bIdx}
                          style={{
                            display: 'inline-block',
                            width: 20,
                            textAlign: 'center',
                            fontWeight: isMagicByte ? 800 : 500,
                            color: isMagicByte ? '#16A34A' : h === '00' ? '#CBD5E1' : '#1E2229',
                            background: isMagicByte ? 'rgba(22,163,74,0.1)' : 'transparent',
                            borderRadius: 4,
                            marginRight: bIdx === 7 ? 10 : 0,
                          }}
                          title={`Byte 0x${(initialOffset + idx * 16 + bIdx).toString(16).toUpperCase()}: 0x${h}`}
                        >
                          {h}
                        </span>
                      );
                    })}
                  </div>
                  <span style={{ width: 150, paddingLeft: 16, color: '#5E6676', userSelect: 'none', borderLeft: '1px solid var(--c-border)' }}>
                    {row.ascii}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#5E6676', paddingTop: 2, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#16A34A' }}></span>
            <span>Identified Magic-Byte Header</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#CBD5E1' }}></span>
            <span>0x00 Null Bytes</span>
          </span>
        </div>
        <span>256 Bytes Rendered</span>
      </div>
    </div>
  );
};
