import React, { useState } from 'react';
import { Sparkles, Bot, Send, User, ShieldAlert, CheckCircle2, HelpCircle } from 'lucide-react';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; time: string }>>([
    {
      sender: 'ai',
      text: 'Greetings, Operator. I am DataShield AI Copilot. Ask me any questions regarding storage topography, FTL wear leveling, NIST SP 800-88 compliance, or Shannon Entropy calculations.',
      time: new Date().toLocaleTimeString(),
    },
  ]);
  const [thinking, setThinking] = useState(false);

  if (!isOpen) return null;

  const promptPresets = [
    'Why does DoD 5220.22-M fail on NVMe/SSDs?',
    'Explain NIST SP 800-88 Rev. 1 Clear vs Purge vs Destroy',
    'How does Shannon Entropy prove zero residual data?',
    'Explain Flash Translation Layer (FTL) & wear-leveling risks',
  ];

  const handleSend = (textToSend?: string) => {
    const q = textToSend || query;
    if (!q.trim()) return;

    const userMsg = {
      sender: 'user' as const,
      text: q,
      time: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setThinking(true);

    setTimeout(() => {
      let aiReply = '';
      const lower = q.toLowerCase();

      if (lower.includes('dod') || lower.includes('nvme') || lower.includes('ssd')) {
        aiReply =
          '**Storage Architecture Finding (FTL Limitation):**\nTraditional DoD 5220.22-M multi-pass overwrites operate at the Logical Block Address (LBA) level. On SSD/NVMe drives, the Flash Translation Layer (FTL) continuously remaps LBAs to different physical NAND blocks to distribute wear. Consequently, repeated overwrites write to newly allocated flash cells while leaving sensitive data in retired or over-provisioned blocks. **NIST SP 800-88 Purge (Cryptographic Scramble or NVMe Format Sanitize)** is mandatory.';
      } else if (lower.includes('nist') || lower.includes('clear') || lower.includes('purge')) {
        aiReply =
          '**NIST SP 800-88 Rev. 1 Classification Summary:**\n- **Clear (Logical Overwrite):** Applies 0x00 / random patterns to all user-accessible LBAs. Suitable for magnetic HDDs.\n- **Purge (Physical / Controller-Level):** Executes controller cryptographic key eradication, block erase, and firmware sanitize, reaching over-provisioned cells. Mandatory for NVMe/SSD.\n- **Destroy:** Physical shredding, incineration, or degaussing (magnetic media only).';
      } else if (lower.includes('entropy') || lower.includes('shannon')) {
        aiReply =
          '**Shannon Entropy Mathematical Verification:**\nEntropy $H(X) = -\\sum P(x) \\log_2 P(x)$ quantifies randomness per block (0.0 to 8.0 bits/byte).\n- **Zero-Fill Sanitization:** $H \\approx 0.0000$ (indicates pure uniform 0x00 bytes across all sectors).\n- **Cryptographic Purge:** $H \\approx 7.9950$ (indicates pseudo-random high-entropy ciphertext with zero residual plain-text magic-byte structures).';
      } else if (lower.includes('ftl') || lower.includes('wear')) {
        aiReply =
          '**Flash Translation Layer (FTL) Mechanics:**\nFTL acts as an onboard virtualization layer between OS LBA requests and raw NAND flash chips. Because NAND cannot overwrite in-place without erasing an entire block (Block Erase before Page Write), the FTL writes to free pages and marks old pages as stale. Over-provisioned areas (7-28% extra hidden flash) remain inaccessible to standard OS writes until controller-level Purge commands are dispatched.';
      } else {
        aiReply =
          `**DataShield AI Advisory Response:**\nUnder SIH26149 compliance rules, all operational decisions follow the deterministic model: DETECT -> ANALYZE -> RECOVER / ERASE -> VERIFY -> REPORT. Every action is registered with a tamper-evident SHA-256 cryptographic chain checksum.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: aiReply,
          time: new Date().toLocaleTimeString(),
        },
      ]);
      setThinking(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 font-mono">
      <div className="cyber-card max-w-2xl w-full p-6 border border-cyan-500/40 shadow-2xl flex flex-col h-[600px] bg-[#070d1d]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold text-sm">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span>DATASHIELD AI CYBERSECURITY COPILOT</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xs">
            ✕ Close
          </button>
        </div>

        {/* Preset Queries */}
        <div className="py-2.5 flex flex-wrap gap-1.5 border-b border-slate-800">
          {promptPresets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p)}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-[#0b1329] hover:bg-[#142247] text-cyan-300 border border-cyan-500/30 transition-all text-left truncate max-w-[280px]"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Chat Thread */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs leading-relaxed">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start space-x-2.5 ${
                m.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {m.sender === 'ai' && (
                <div className="p-2 rounded-xl bg-[#0f1b38] text-cyan-400 border border-cyan-500/30 flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[80%] p-3.5 rounded-2xl ${
                  m.sender === 'user'
                    ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-950'
                    : 'bg-[#0b1329] border border-slate-800 text-slate-200'
                }`}
              >
                <div className="whitespace-pre-line">{m.text}</div>
                <div className="text-[9px] text-slate-400 mt-1.5 text-right">{m.time}</div>
              </div>
              {m.sender === 'user' && (
                <div className="p-2 rounded-xl bg-[#0f1b38] text-slate-300 border border-slate-700 flex-shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
          {thinking && (
            <div className="flex items-center space-x-2 text-cyan-400 text-xs py-2">
              <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Synthesizing NIST SP 800-88 Technical Rationale...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="pt-3 border-t border-slate-800 flex items-center space-x-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask AI Copilot regarding storage, FTL wear leveling, or standards..."
            className="flex-1 bg-[#030712] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
          />
          <button
            onClick={() => handleSend()}
            className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white transition-all shadow-md shadow-cyan-500/25"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
