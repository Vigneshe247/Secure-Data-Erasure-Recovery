import React, { useState } from 'react';
import { Sparkles, Bot, Send, User, ShieldAlert, CheckCircle2, HelpCircle, X } from 'lucide-react';

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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30, 34, 41, 0.65)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div
        className="ds-card"
        style={{
          maxWidth: 680,
          width: '100%',
          padding: 24,
          height: 620,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 16,
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)' }} />

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid var(--c-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#FF7E5F', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 15 }}>
            <Sparkles size={18} />
            <span>DATASHIELD AI CYBERSECURITY COPILOT</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
            <X size={18} />
          </button>
        </div>

        {/* Preset Queries */}
        <div style={{ padding: '12px 0', display: 'flex', flexWrap: 'wrap', gap: 8, borderBottom: '1px solid var(--c-border)' }}>
          {promptPresets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p)}
              style={{
                fontSize: 11,
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 12,
                background: '#E6EFFB',
                color: '#2B579A',
                border: '1px solid #D0E0F7',
                cursor: 'pointer',
                textAlign: 'left',
                maxWidth: 280,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Chat Thread */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, lineHeight: 1.6 }}>
          {messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {m.sender === 'ai' && (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: 'rgba(255, 126, 95, 0.12)',
                    color: '#FF7E5F',
                    border: '1px solid rgba(255, 126, 95, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Bot size={16} />
                </div>
              )}
              <div
                style={{
                  maxWidth: '82%',
                  padding: '12px 16px',
                  borderRadius: 14,
                  background: m.sender === 'user' ? 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)' : '#FAF8F5',
                  color: m.sender === 'user' ? '#FFFFFF' : '#1E2229',
                  border: m.sender === 'user' ? 'none' : '1px solid var(--c-border)',
                  boxShadow: m.sender === 'user' ? '0 4px 14px rgba(255,126,95,0.25)' : 'none',
                }}
              >
                <div style={{ whiteSpace: 'pre-line' }}>{m.text}</div>
                <div style={{ fontSize: 10, color: m.sender === 'user' ? 'rgba(255,255,255,0.8)' : '#94A3B8', marginTop: 6, textAlign: 'right' }}>
                  {m.time}
                </div>
              </div>
              {m.sender === 'user' && (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: '#FAF8F5',
                    color: '#5E6676',
                    border: '1px solid var(--c-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <User size={16} />
                </div>
              )}
            </div>
          ))}
          {thinking && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FF7E5F', fontSize: 12, padding: '8px 0' }}>
              <div style={{ width: 14, height: 14, border: '2px solid #FF7E5F', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span>Synthesizing NIST SP 800-88 Technical Rationale...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div style={{ paddingTop: 14, borderTop: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask AI Copilot regarding storage, FTL wear leveling, or standards..."
            className="ds-input"
            style={{ flex: 1, padding: '10px 16px', fontSize: 13 }}
          />
          <button
            onClick={() => handleSend()}
            className="ds-btn ds-btn-primary"
            style={{ padding: '10px 18px' }}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
