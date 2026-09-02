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
    <div className="cyber-card p-5 border border-cyan-500/30 bg-[#040814] font-mono text-xs space-y-4">
      {/* Hex Viewer Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-[#0f1b38] text-cyan-400 border border-cyan-500/30">
            <Binary className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-white text-xs flex items-center space-x-2">
              <span>{fileName}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                {detectedFormat} Signature
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              512-Byte Raw Sector Inspector &bull; 16-Byte Row Alignment
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search Hex / ASCII..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#0b1329] border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none w-44"
            />
          </div>

          <button
            onClick={handleCopyHex}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#0f1b38] hover:bg-[#16254c] text-slate-300 hover:text-white border border-slate-700 text-xs transition-colors"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
            <span>{copied ? 'Copied' : 'Copy Dump'}</span>
          </button>
        </div>
      </div>

      {/* Hex Dump Matrix */}
      <div className="overflow-x-auto p-3.5 rounded-xl bg-[#02050e] border border-slate-800 shadow-inner">
        <div className="min-w-[620px] text-[11px] leading-relaxed">
          {/* Column Index Header */}
          <div className="flex text-slate-500 font-bold border-b border-slate-800/80 pb-1 mb-2 select-none">
            <span className="w-24">OFFSET</span>
            <span className="flex-1 tracking-widest">
              00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F
            </span>
            <span className="w-40 pl-4">DECODED ASCII</span>
          </div>

          {/* Rows */}
          <div className="space-y-1">
            {rows.map((row, idx) => {
              const isFirstRow = idx === 0;
              const matchesSearch =
                searchTerm &&
                (row.hex.join('').toLowerCase().includes(searchTerm.toLowerCase()) ||
                  row.ascii.toLowerCase().includes(searchTerm.toLowerCase()));

              return (
                <div
                  key={row.offset}
                  className={`flex items-center hover:bg-[#0d1733] px-1 py-0.5 rounded transition-colors ${
                    matchesSearch ? 'bg-cyan-950/70 text-cyan-300 ring-1 ring-cyan-400' : ''
                  }`}
                >
                  <span className="w-24 text-cyan-500 font-bold select-none">{row.offset}</span>
                  <div className="flex-1 flex space-x-1">
                    {row.hex.map((h, bIdx) => {
                      const isMagicByte = isFirstRow && bIdx < 4;
                      return (
                        <span
                          key={bIdx}
                          className={`inline-block w-5 text-center ${
                            isMagicByte
                              ? 'text-emerald-400 font-black bg-emerald-950/40 rounded px-0.5 border border-emerald-500/40'
                              : h === '00'
                              ? 'text-slate-600'
                              : 'text-slate-300'
                          } ${bIdx === 7 ? 'mr-3' : ''}`}
                          title={`Byte 0x${(initialOffset + idx * 16 + bIdx).toString(16).toUpperCase()}: 0x${h}`}
                        >
                          {h}
                        </span>
                      );
                    })}
                  </div>
                  <span className="w-40 pl-4 text-amber-300/80 select-none border-l border-slate-800">
                    {row.ascii}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded bg-emerald-400"></span>
            <span>Identified Magic-Byte Header</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded bg-slate-700"></span>
            <span>0x00 Null Bytes</span>
          </span>
        </div>
        <span>256 Bytes Rendered</span>
      </div>
    </div>
  );
};
