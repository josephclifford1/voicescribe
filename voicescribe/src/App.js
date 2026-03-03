import { useState, useEffect, useRef, useCallback } from "react";

const QUICK_PROMPTS = [
  { icon: "✦", label: "Summarize", msg: "Please summarize the transcript concisely." },
  { icon: "✦", label: "Key Points", msg: "List the key points from the transcript as bullet points." },
  { icon: "✦", label: "Clean Up", msg: "Fix any grammar issues and clean up the transcript text, then show the improved version." },
  { icon: "✦", label: "Topics", msg: "What main topics are discussed in the transcript?" },
  { icon: "✦", label: "Action Items", msg: "Extract any action items or tasks mentioned in the transcript." },
];

const LANGUAGES = [
  { value: "en-US", label: "🇺🇸 English (US)" },
  { value: "en-GB", label: "🇬🇧 English (UK)" },
  { value: "fr-FR", label: "🇫🇷 Français" },
  { value: "es-ES", label: "🇪🇸 Español" },
  { value: "de-DE", label: "🇩🇪 Deutsch" },
  { value: "ar-SA", label: "🇸🇦 Arabic" },
  { value: "zh-CN", label: "🇨🇳 中文" },
  { value: "pt-BR", label: "🇧🇷 Português" },
  { value: "ru-RU", label: "🇷🇺 Русский" },
  { value: "ja-JP", label: "🇯🇵 日本語" },
];

function WaveBar({ active, delay, height }) {
  return (
    <div style={{
      width: 3,
      height: active ? undefined : height,
      background: "var(--accent)",
      borderRadius: 2,
      opacity: active ? 1 : 0.25,
      animationName: active ? "wave" : "none",
      animationDuration: "0.7s",
      animationDelay: delay,
      animationIterationCount: "infinite",
      animationTimingFunction: "ease-in-out",
      animationDirection: "alternate",
    }} />
  );
}

function ThinkingDots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "4px 0" }}>
      {[0, 0.2, 0.4].map((d, i) => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "var(--accent)",
          animationName: "think",
          animationDuration: "1.2s",
          animationDelay: `${d}s`,
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-in-out",
        }} />
      ))}
    </div>
  );
}

function ChatMessage({ role, text }) {
  if (role === "thinking") return (
    <div style={{
      alignSelf: "flex-start",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "12px 12px 12px 3px",
      padding: "10px 14px",
      animation: "msgIn 0.2s ease",
    }}>
      <ThinkingDots />
    </div>
  );

  const isUser = role === "user";
  return (
    <div style={{
      alignSelf: isUser ? "flex-end" : "flex-start",
      maxWidth: "88%",
      padding: "10px 14px",
      borderRadius: isUser ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
      background: isUser
        ? "linear-gradient(135deg, var(--accent), #9c6aff)"
        : "var(--surface)",
      border: isUser ? "none" : "1px solid var(--border)",
      color: isUser ? "white" : "var(--text)",
      fontSize: "0.85rem",
      lineHeight: 1.65,
      animation: "msgIn 0.2s ease",
    }}>
      {!isUser && (
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 10,
          fontWeight: 700,
          color: "var(--accent)",
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 5,
        }}>VoiceScribe AI</div>
      )}
      <div dangerouslySetInnerHTML={{ __html: formatText(text) }} />
    </div>
  );
}

function formatText(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, `<code style="background:rgba(124,106,255,0.18);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.85em">$1</code>`)
    .replace(/\n/g, "<br>");
}

export default function VoiceScribeAI() {
  const [isRecording, setIsRecording] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [duration, setDuration] = useState("00:00");
  const [lang, setLang] = useState("en-US");
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hi! I'm your AI assistant. Start recording and I'll help you analyze your transcript — summaries, key points, Q&A, improvements, and more. You can also ask me anything general!" }
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const chatEndRef = useRef(null);
  const finalTextRef = useRef("");
  const isRecordingRef = useRef(false);

  // Keep ref in sync
  useEffect(() => { finalTextRef.current = finalText; }, [finalText]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        // Use highest-confidence alternative
        const best = [...Array(e.results[i].length)]
          .map((_, j) => e.results[i][j])
          .sort((a, b) => b.confidence - a.confidence)[0];
        const t = best.transcript;
        if (e.results[i].isFinal) {
          setFinalText(prev => {
            const updated = prev + (prev && !prev.endsWith(" ") ? " " : "") + t.trim();
            finalTextRef.current = updated;
            return updated;
          });
          setInterimText("");
        } else {
          interim += t;
          setInterimText(interim);
        }
      }
    };

    rec.onerror = (e) => {
      if (e.error === "not-allowed") {
        setMessages(m => [...m, { role: "ai", text: "⚠️ Microphone access was denied. Please allow microphone permissions in your browser and try again." }]);
        setIsRecording(false);
      }
      if (e.error !== "no-speech") console.warn("Speech error:", e.error);
    };

    rec.onend = () => {
      if (isRecordingRef.current) {
        try { rec.start(); } catch (_) {}
      }
    };

    recognitionRef.current = rec;
    return () => { try { rec.stop(); } catch (_) {} };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startRecording = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.lang = lang;
    try {
      recognitionRef.current.start();
      setIsRecording(true);
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const e = Date.now() - startTimeRef.current;
        const m = String(Math.floor(e / 60000)).padStart(2, "0");
        const s = String(Math.floor((e % 60000) / 1000)).padStart(2, "0");
        setDuration(`${m}:${s}`);
      }, 500);
    } catch (err) {
      console.error(err);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    clearInterval(timerRef.current);
    setInterimText("");
    try { recognitionRef.current?.stop(); } catch (_) {}
  };

  const wordCount = finalText.trim() ? finalText.trim().split(/\s+/).length : 0;

  const sendMessage = useCallback(async (customMsg) => {
    const userMsg = (customMsg || input).trim();
    if (!userMsg || isThinking) return;
    setInput("");

    const transcript = finalTextRef.current.trim();
    const transcriptBlock = transcript
      ? `\n\n[CURRENT TRANSCRIPT]:\n"${transcript}"\n\nUse the transcript above if relevant to my question.`
      : "";

    const fullMsg = userMsg + transcriptBlock;
    const newHistory = [...chatHistory, { role: "user", content: fullMsg }];
    setChatHistory(newHistory);
    setMessages(m => [...m, { role: "user", text: userMsg }]);
    setIsThinking(true);

    try {
      const res = await fetch("https://voicescribe-api.onrender.com/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: "You are VoiceScribe AI, an intelligent assistant embedded inside a speech-to-text app. Help users analyze, summarize, clean up, and understand their transcripts. Also answer general questions helpfully. Be concise and friendly. Use markdown-style bold (**text**) for emphasis when useful.",
          messages: newHistory,
        }),
      });

      const data = await res.json();
      const reply = data?.content?.map(b => b.text || "").join("") || "Sorry, I couldn't get a response.";
      setChatHistory(h => [...h, { role: "assistant", content: reply }]);
      setMessages(m => [...m, { role: "ai", text: reply }]);
    } catch (err) {
      setMessages(m => [...m, { role: "ai", text: "⚠️ Something went wrong. Please try again." }]);
      setChatHistory(h => h.slice(0, -1));
    }
    setIsThinking(false);
  }, [input, isThinking, chatHistory]);

  const waveHeights = [8, 16, 6, 24, 10, 28, 8, 18, 12, 32, 6, 22, 10, 14, 4, 20, 8, 26, 12, 16];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:ital,wght@0,300;0,400;1,300&family=DM+Sans:wght@300;400;500&display=swap');
        :root {
          --bg: #090910;
          --surface: #0f0f18;
          --card: #13131e;
          --border: #222233;
          --accent: #7c6aff;
          --accent2: #ff6a9a;
          --accent3: #5fffc0;
          --text: #e2e2ef;
          --muted: #7a7a90;
          --glow: rgba(124,106,255,0.12);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); font-family: 'DM Sans', sans-serif; }
        @keyframes wave {
          from { height: 4px; }
          to { height: 34px; }
        }
        @keyframes think {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.75); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes msgIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseBtn {
          0%, 100% { box-shadow: 0 4px 20px rgba(255,68,68,0.3); }
          50% { box-shadow: 0 4px 40px rgba(255,68,68,0.6); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "var(--bg)",
        backgroundImage: "linear-gradient(rgba(124,106,255,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(124,106,255,0.035) 1px,transparent 1px)",
        backgroundSize: "48px 48px",
        color: "var(--text)",
        padding: "20px 16px",
      }}>
        <div style={{ maxWidth: 1360, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid var(--border)" }}>
            <div style={{
              width: 42, height: 42, borderRadius: 11,
              background: "linear-gradient(135deg, var(--accent), var(--accent2))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, boxShadow: "0 0 24px rgba(124,106,255,0.45)",
            }}>🎙</div>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "1.5rem", letterSpacing: -0.5 }}>
                Voice<span style={{ color: "var(--accent)" }}>Scribe</span> AI
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>Real-time Speech-to-Text · Embedded Intelligence</div>
            </div>
            <div style={{
              marginLeft: "auto",
              background: "linear-gradient(135deg,rgba(124,106,255,0.18),rgba(255,106,154,0.18))",
              border: "1px solid rgba(124,106,255,0.3)",
              color: "var(--accent)", padding: "4px 12px", borderRadius: 100,
              fontSize: 10, fontFamily: "'DM Mono',monospace", letterSpacing: 1, textTransform: "uppercase",
            }}>Powered by Claude</div>
          </div>

          {!supported && (
            <div style={{
              background: "rgba(255,106,154,0.1)", border: "1px solid rgba(255,106,154,0.3)",
              borderRadius: 10, padding: "12px 16px", color: "var(--accent2)", fontSize: "0.85rem", marginBottom: 16,
            }}>
              ⚠️ Speech recognition is not supported in this browser. Please use <strong>Chrome</strong> or <strong>Edge</strong>.
            </div>
          )}

          {/* Layout */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 16, alignItems: "start" }}>

            {/* LEFT */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Recording Card */}
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }} />
                  <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "0.88rem" }}>Recording</span>
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
                    padding: "3px 10px", borderRadius: 100, fontSize: 10, fontFamily: "'DM Mono',monospace",
                    background: isRecording ? "rgba(255,68,68,0.12)" : "rgba(120,120,140,0.1)",
                    color: isRecording ? "#ff6464" : "var(--muted)",
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: isRecording ? "#ff4444" : "var(--muted)",
                      animationName: isRecording ? "blink" : "none",
                      animationDuration: "1s", animationIterationCount: "infinite",
                    }} />
                    {isRecording ? "LIVE" : "IDLE"}
                  </div>
                </div>

                <div style={{ padding: "18px 18px 0" }}>
                  {/* Waveform */}
                  <div style={{
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 10, height: 60, display: "flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "0 12px",
                  }}>
                    {waveHeights.map((h, i) => (
                      <WaveBar key={i} active={isRecording} delay={`${(i % 5) * 0.12}s`} height={h} />
                    ))}
                  </div>

                  {/* Record Button */}
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={!supported}
                    style={{
                      width: "100%", marginTop: 14, padding: "14px",
                      border: "none", borderRadius: 11,
                      fontFamily: "'Syne',sans-serif", fontSize: "0.97rem", fontWeight: 700,
                      cursor: supported ? "pointer" : "not-allowed",
                      color: "white", letterSpacing: 0.4,
                      background: isRecording
                        ? "linear-gradient(135deg,#ff4040,#ff6a9a)"
                        : "linear-gradient(135deg,var(--accent),#9c6aff)",
                      boxShadow: isRecording
                        ? "0 4px 20px rgba(255,64,64,0.35)"
                        : "0 4px 20px rgba(124,106,255,0.35)",
                      animationName: isRecording ? "pulseBtn" : "none",
                      animationDuration: "1.6s", animationIterationCount: "infinite",
                      transition: "transform 0.15s",
                    }}
                  >
                    {isRecording ? "⏹  Stop Recording" : "🎙  Start Recording"}
                  </button>

                  {/* Stats */}
                  <div style={{ display: "flex", gap: 10, margin: "14px 0 18px" }}>
                    {[["Duration", duration], ["Words", wordCount], ["Chars", finalText.length]].map(([label, val]) => (
                      <div key={label} style={{
                        flex: 1, background: "var(--surface)", border: "1px solid var(--border)",
                        borderRadius: 9, padding: "9px 12px",
                      }}>
                        <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "1.05rem", color: "var(--accent)", marginTop: 2 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transcript Card */}
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent2)", boxShadow: "0 0 8px var(--accent2)" }} />
                  <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "0.88rem" }}>Live Transcript</span>
                </div>

                <div style={{
                  minHeight: 260, maxHeight: 380, overflowY: "auto",
                  padding: 18, fontFamily: "'DM Mono',monospace", fontSize: "0.87rem",
                  lineHeight: 1.85, color: "var(--text)",
                }}>
                  {finalText || interimText ? (
                    <>
                      <span>{finalText}</span>
                      {interimText && <span style={{ color: "var(--muted)", fontStyle: "italic" }}>{(finalText ? " " : "") + interimText}</span>}
                    </>
                  ) : (
                    <span style={{ color: "var(--muted)", fontStyle: "italic" }}>
                      Your transcript will appear here in real-time as you speak...
                    </span>
                  )}
                </div>

                <div style={{ padding: "11px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center" }}>
                  {[
                    ["📋 Copy", () => navigator.clipboard.writeText(finalText)],
                    ["⬇️ Export", () => {
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(new Blob([finalText], { type: "text/plain" }));
                      a.download = "transcript.txt"; a.click();
                    }],
                    ["🗑 Clear", () => { setFinalText(""); setInterimText(""); setDuration("00:00"); }],
                  ].map(([label, fn]) => (
                    <button key={label} onClick={fn} style={{
                      padding: "6px 13px", borderRadius: 8,
                      border: "1px solid var(--border)", background: "transparent",
                      color: "var(--muted)", fontSize: 12, cursor: "pointer",
                      fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s",
                    }}
                      onMouseEnter={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.color = "var(--accent)"; }}
                      onMouseLeave={e => { e.target.style.borderColor = "var(--border)"; e.target.style.color = "var(--muted)"; }}
                    >{label}</button>
                  ))}
                  <select
                    value={lang}
                    onChange={e => setLang(e.target.value)}
                    style={{
                      marginLeft: "auto", background: "var(--surface)",
                      border: "1px solid var(--border)", color: "var(--text)",
                      borderRadius: 8, padding: "6px 10px", fontSize: 12,
                      fontFamily: "'DM Mono',monospace", cursor: "pointer", outline: "none",
                    }}
                  >
                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* RIGHT — AI Chat */}
            <div style={{
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
              display: "flex", flexDirection: "column", height: 640,
            }}>
              <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent3)", boxShadow: "0 0 8px var(--accent3)" }} />
                <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "0.88rem" }}>AI Assistant</span>
                <div style={{ marginLeft: "auto", fontSize: 10, color: "var(--muted)", fontFamily: "'DM Mono',monospace" }}>Claude</div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 11 }}>
                {messages.map((m, i) => <ChatMessage key={i} role={m.role} text={m.text} />)}
                {isThinking && <ChatMessage role="thinking" />}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Prompts */}
              <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border)", display: "flex", gap: 6, flexWrap: "wrap" }}>
                {QUICK_PROMPTS.map(p => (
                  <button key={p.label} onClick={() => sendMessage(p.msg)} style={{
                    padding: "4px 10px", background: "var(--surface)",
                    border: "1px solid var(--border)", borderRadius: 100,
                    color: "var(--muted)", fontSize: 11, cursor: "pointer",
                    transition: "all 0.15s", whiteSpace: "nowrap",
                  }}
                    onMouseEnter={e => { e.target.style.borderColor = "var(--accent3)"; e.target.style.color = "var(--accent3)"; }}
                    onMouseLeave={e => { e.target.style.borderColor = "var(--border)"; e.target.style.color = "var(--muted)"; }}
                  >{p.icon} {p.label}</button>
                ))}
              </div>

              {/* Input */}
              <div style={{ padding: "11px 14px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Ask about the transcript or anything..."
                  rows={1}
                  style={{
                    flex: 1, background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 10, padding: "9px 13px", color: "var(--text)",
                    fontFamily: "'DM Sans',sans-serif", fontSize: "0.87rem",
                    resize: "none", outline: "none", maxHeight: 100, overflowY: "auto", lineHeight: 1.5,
                  }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={isThinking || !input.trim()}
                  style={{
                    width: 38, height: 38, borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg,var(--accent),#9c6aff)",
                    color: "white", fontSize: 15, cursor: isThinking || !input.trim() ? "default" : "pointer",
                    opacity: isThinking || !input.trim() ? 0.4 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s", flexShrink: 0,
                  }}
                >➤</button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
