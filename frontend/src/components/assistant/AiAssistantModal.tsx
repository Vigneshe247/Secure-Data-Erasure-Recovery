import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Bot, X, Send, RotateCcw, ShieldCheck, ChevronRight,
  HelpCircle, Terminal, HardDrive, FileSearch, Trash2, CheckCircle2
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestions?: string[];
}

const INITIAL_SUGGESTIONS = [
  "Which sanitization standard for NVMe SSD?",
  "How to recover deleted files?",
  "Explain Shannon Entropy verification",
  "Show real-time platform status"
];

const INITIAL_GREETING: Message = {
  id: 'init-1',
  role: 'assistant',
  content: (
    "### 🛡️ Welcome to DataShield AI Copilot\n\n" +
    "I am your dedicated **Cybersecurity & Digital Forensics AI Assistant**.\n\n" +
    "I provide technical guidance on:\n" +
    "* **Storage-Aware Sanitization**: NIST SP 800-88 Rev.1 (Clear vs Purge), DoD 5220.22-M (3-Pass & 7-Pass), Gutmann 35-Pass, ATA/NVMe Crypto Scramble.\n" +
    "* **Deep-Sector File Carving**: Magic-byte carving (JPG, PNG, PDF, DOCX, ZIP, WEBP), raw sector hex inspection, and file restoration.\n" +
    "* **Forensic Verification**: Shannon Entropy mathematical validation (threshold $\\ge 7.98$), FTL wear leveling, and MFT residue checks.\n" +
    "* **Audit & Legal Defense**: GDPR Article 17, SHA-256 cryptographic chain validation, and PDF compliance certificates.\n\n" +
    "Ask any question below or click a suggestion chip to begin!"
  ),
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  suggestions: INITIAL_SUGGESTIONS,
};

// Simple lightweight Markdown formatter for AI messages
const formatMarkdown = (text: string) => {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    // Headers
    if (line.startsWith('### ')) {
      return (
        <h4 key={idx} style={{ margin: '8px 0 4px', fontSize: 13, fontWeight: 800, color: '#1E2229' }}>
          {line.replace('### ', '')}
        </h4>
      );
    }
    if (line.startsWith('#### ')) {
      return (
        <h5 key={idx} style={{ margin: '6px 0 2px', fontSize: 12, fontWeight: 700, color: '#FF7E5F' }}>
          {line.replace('#### ', '')}
        </h5>
      );
    }
    // Bullet points
    if (line.startsWith('* ') || line.startsWith('- ')) {
      const content = line.substring(2);
      return (
        <div key={idx} style={{ display: 'flex', gap: 6, margin: '3px 0', paddingLeft: 6, fontSize: 12, lineHeight: 1.5 }}>
          <span style={{ color: '#FF7E5F', fontWeight: 700 }}>•</span>
          <span>{renderInline(content)}</span>
        </div>
      );
    }
    // Numbered lists
    const numMatch = line.match(/^(\d+)\.\s(.*)/);
    if (numMatch) {
      return (
        <div key={idx} style={{ display: 'flex', gap: 6, margin: '3px 0', paddingLeft: 6, fontSize: 12, lineHeight: 1.5 }}>
          <span style={{ color: '#2563EB', fontWeight: 700, minWidth: 16 }}>{numMatch[1]}.</span>
          <span>{renderInline(numMatch[2])}</span>
        </div>
      );
    }
    // Horizontal divider
    if (line.trim() === '---') {
      return <hr key={idx} style={{ border: 'none', borderTop: '1px solid var(--c-border)', margin: '8px 0' }} />;
    }
    // Empty line
    if (!line.trim()) {
      return <div key={idx} style={{ height: 6 }} />;
    }
    // Normal paragraph
    return (
      <p key={idx} style={{ margin: '3px 0', fontSize: 12, lineHeight: 1.55 }}>
        {renderInline(line)}
      </p>
    );
  });
};

// Render inline formatting: **bold** and `code`
const renderInline = (str: string) => {
  const parts: React.ReactNode[] = [];
  // Split on bold (**text**) and code (`text`)
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(str.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} style={{ fontWeight: 700, color: '#1E2229' }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          style={{
            background: 'rgba(255, 126, 95, 0.08)',
            color: '#FF7E5F',
            padding: '1px 5px',
            borderRadius: 4,
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            border: '1px solid rgba(255, 126, 95, 0.2)',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < str.length) {
    parts.push(str.substring(lastIndex));
  }
  return parts;
};

export const AiAssistantModal: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-ai-assistant', handleOpen);
    return () => window.removeEventListener('open-ai-assistant', handleOpen);
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input.trim();
    if (!textToSend || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInput('');
    setLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : '',
      }));

      const res = await api.askAiAssistant(textToSend, historyPayload);

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: res.suggestions || [],
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Failed to query AI Copilot: ${err.message || 'Network error'}. Please verify backend connection.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: ['Show real-time platform status', 'How to recover deleted files?'],
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([INITIAL_GREETING]);
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 20px',
            borderRadius: 30,
            background: 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)',
            color: '#FFFFFF',
            border: 'none',
            boxShadow: '0 8px 24px rgba(255, 126, 95, 0.45), 0 2px 8px rgba(30, 34, 41, 0.1)',
            cursor: 'pointer',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.02em',
            transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            animation: 'pulseGlow 2.5s infinite',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)';
            e.currentTarget.style.boxShadow = '0 12px 30px rgba(255, 126, 95, 0.55)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 126, 95, 0.45)';
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={15} color="#FFFFFF" />
          </div>
          <span>AI Copilot</span>
        </button>
      )}

      {/* Floating Chat Drawer / Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 440,
            maxWidth: 'calc(100vw - 32px)',
            height: 620,
            maxHeight: 'calc(100vh - 48px)',
            background: '#FFFFFF',
            borderRadius: 20,
            border: '1px solid var(--c-border)',
            boxShadow: '0 20px 50px -10px rgba(30, 34, 41, 0.2), 0 4px 16px rgba(30, 34, 41, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999,
            overflow: 'hidden',
            animation: 'fadeInUp 0.25s ease',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 18px',
              background: 'linear-gradient(135deg, #1E2229 0%, #2A303C 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 10px rgba(255, 126, 95, 0.4)',
                }}
              >
                <Sparkles size={18} color="#FFFFFF" />
              </div>
              <div>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  DataShield AI Copilot
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(22, 163, 74, 0.25)', color: '#4ADE80', fontWeight: 700 }}>
                    ACTIVE
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  Forensic &amp; Sanitization Intelligence
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={handleClearChat}
                title="Clear conversation"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  padding: 6,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close AI Copilot"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  padding: 6,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              background: '#FAF8F5',
            }}
          >
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '100%',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '92%',
                      padding: isUser ? '10px 14px' : '14px 16px',
                      borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: isUser
                        ? 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)'
                        : '#FFFFFF',
                      color: isUser ? '#FFFFFF' : '#1E2229',
                      border: isUser ? 'none' : '1px solid var(--c-border)',
                      boxShadow: isUser
                        ? '0 4px 14px rgba(255, 126, 95, 0.25)'
                        : '0 2px 10px rgba(30, 34, 41, 0.04)',
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: 12,
                      lineHeight: 1.5,
                      wordBreak: 'break-word',
                    }}
                  >
                    {isUser ? m.content : formatMarkdown(m.content)}
                  </div>

                  <span style={{ fontSize: 9, color: '#94A3B8', marginTop: 3, padding: '0 4px' }}>
                    {m.timestamp}
                  </span>

                  {/* Follow-up Suggestion Chips */}
                  {!isUser && m.suggestions && m.suggestions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, maxWidth: '95%' }}>
                      {m.suggestions.map((s, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => handleSend(s)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            borderRadius: 12,
                            background: '#FFFFFF',
                            border: '1px solid #E2DED7',
                            color: '#5E6676',
                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.12s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#FF7E5F';
                            e.currentTarget.style.color = '#FF7E5F';
                            e.currentTarget.style.background = 'rgba(255, 126, 95, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#E2DED7';
                            e.currentTarget.style.color = '#5E6676';
                            e.currentTarget.style.background = '#FFFFFF';
                          }}
                        >
                          <ChevronRight size={10} color="#FF7E5F" />
                          <span>{s}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Typing Indicator */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#FFFFFF', borderRadius: 14, width: 'fit-content', border: '1px solid var(--c-border)' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF7E5F', animation: 'bounce 0.8s infinite 0.1s' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF7E5F', animation: 'bounce 0.8s infinite 0.2s' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF7E5F', animation: 'bounce 0.8s infinite 0.3s' }} />
                </div>
                <span style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600 }}>
                  Analyzing forensic parameters...
                </span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Footer Input */}
          <div
            style={{
              padding: '12px 16px',
              background: '#FFFFFF',
              borderTop: '1px solid var(--c-border)',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask about sanitization, carving, entropy, compliance..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid #E2DED7',
                background: '#FAF8F5',
                color: '#1E2229',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: 12,
                outline: 'none',
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: input.trim() && !loading
                  ? 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)'
                  : '#FAF8F5',
                color: input.trim() && !loading ? '#FFFFFF' : '#94A3B8',
                border: '1px solid var(--c-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
