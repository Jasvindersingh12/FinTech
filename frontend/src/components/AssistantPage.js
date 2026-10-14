import React, { useState, useEffect, useRef, useCallback } from "react";
import listenImg from "../assets/listen.png";
import waitImg from "../assets/wait.png";
import { authFetch } from "../utils/api";

const AssistantPage = ({
  activePage,
  onFinanceAction,
  IdleImage,
  ListeningImage,
}) => {
  const [mode, setMode] = useState("study"); // Default to study mode
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoReadAloud, setAutoReadAloud] = useState(false); // OFF by default as requested

  const utteranceRef = useRef(null);

  // Stop all audio playback immediately (client SpeechSynthesis + server fallback)
  const stopAudio = useCallback(() => {
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        console.warn("speechSynthesis cancel error:", e);
      }
    }
    // Also notify server to stop any server-side speech if active
    authFetch("/assistant/stop-speech", { method: "POST" }).catch(() => {});
    setIsSpeaking(false);
    if (utteranceRef.current) {
      utteranceRef.current.onstart = null;
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
    }
  }, []);

  // Speak response using browser Speech Synthesis API with proper event handling
  const speakInBrowser = useCallback(
    (message) => {
      if (!("speechSynthesis" in window) || !message) return;

      // Stop any active or queued speech first to avoid overlapping voices
      stopAudio();

      // Clean markdown symbols for natural speech (remove ###, **, ```, etc.)
      const cleanText = message
        .replace(/```[\s\S]*?```/g, "Code block omitted.")
        .replace(/[*_#`~>]/g, "")
        .replace(/\n+/g, " ")
        .trim();

      if (!cleanText) return;

      try {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
          setIsSpeaking(true);
        };
        utterance.onend = () => {
          setIsSpeaking(false);
          utteranceRef.current = null;
        };
        utterance.onerror = (e) => {
          if (e.error !== "canceled") {
            console.warn("Speech synthesis error:", e);
          }
          setIsSpeaking(false);
          utteranceRef.current = null;
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("Speech synthesis error:", err);
        setIsSpeaking(false);
      }
    },
    [stopAudio]
  );

  // Stop audio whenever the user navigates away from Assistant
  useEffect(() => {
    if (activePage !== "assistant") {
      stopAudio();
    }
  }, [activePage, stopAudio]);

  // Clean up speech on component unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  const getAssistantImage = () => {
    if (listening) return ListeningImage || listenImg;
    if (loading) return waitImg;
    return IdleImage || waitImg;
  };

  const handleModeChange = (newMode) => {
    stopAudio();
    setMode(newMode);
    setReply("");
    setListening(false);
    setLoading(false);
  };

  const sendQuery = async () => {
    const trimmedText = text.trim();
    if (!trimmedText || !mode) return;

    // Immediately stop any active speech when a new query is submitted
    stopAudio();

    setLoading(true);
    setReply("");
    setListening(false);

    try {
      const res = await authFetch("/assistant", {
        method: "POST",
        body: JSON.stringify({ text: trimmedText, mode }),
      });

      if (mode === "finance" && res.ok && onFinanceAction) {
        onFinanceAction();
      }

      const data = await res.json();
      const replyMessage = data.reply || "No response received.";
      setReply(replyMessage);

      // Only read aloud automatically if user explicitly enabled Auto Read-Aloud
      if (autoReadAloud) {
        speakInBrowser(replyMessage);
      }

      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error(err);
      setReply(`Error connecting to server: ${err.message}. Please verify the backend is running.`);
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Speech Recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    // Stop existing audio before voice command begins
    stopAudio();

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    try {
      recognition.start();
      setListening(true);
      setReply("🎙 Listening... Speak now.");
    } catch (e) {
      console.error("Recognition start error:", e);
      setListening(false);
      return;
    }

    recognition.onresult = async (event) => {
      const spokenText = event.results[0][0].transcript;
      setText(spokenText);
      setListening(false);
      setLoading(true);

      try {
        const res = await authFetch("/assistant/voice", {
          method: "POST",
          body: JSON.stringify({ mode, text: spokenText }),
        });

        const data = await res.json();
        const replyMessage = data.reply || "No response received.";
        setReply(replyMessage);

        if (autoReadAloud) {
          speakInBrowser(replyMessage);
        }

        if (mode === "finance" && res.ok && onFinanceAction) {
          onFinanceAction();
        }

        if (data.url) {
          window.open(data.url, "_blank", "noopener,noreferrer");
        }
      } catch (err) {
        console.error(err);
        setReply(`Error connecting to server: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      setReply(`Speech recognition notice: ${event.error}`);
    };

    recognition.onend = () => {
      setListening(false);
    };
  };

  const handleClear = () => {
    stopAudio();
    setText("");
    setReply("");
    setLoading(false);
    setListening(false);
  };

  const getPlaceholder = () => {
    if (mode === "study") {
      return "Ask any study question (e.g. 'Explain compound interest step-by-step', 'How does inflation affect savings?', 'Solve 2x + 5 = 15 with hints')...";
    }
    if (mode === "finance") {
      return "Example commands: 'add expense 50 coffee', 'add income 1200 salary', 'what is my balance?', 'show total expenses'...";
    }
    if (mode === "assistant") {
      return "Example: 'open youtube search React tutorial', 'open google', 'open linkedin'...";
    }
    return "Select a mode above and enter your query...";
  };

  return (
    <div className={`page ${activePage === "assistant" ? "block" : "hidden"} p-6 max-w-2xl mx-auto`}>
      <h1 className="text-3xl font-bold mb-4 text-gray-800 text-center">Smart Buddy Assistant</h1>

      {/* Assistant Avatar */}
      <div className="flex justify-center mb-5">
        <img
          src={getAssistantImage()}
          alt="assistant-state"
          className="w-36 h-36 transition-all duration-300 object-contain drop-shadow-md"
        />
      </div>

      {/* Mode Selector Tabs */}
      <div className="mb-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Select Assistant Mode
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleModeChange("study")}
            className={`py-2.5 px-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center space-x-1.5 ${
              mode === "study"
                ? "bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span>📚</span>
            <span>Study Mode</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange("finance")}
            className={`py-2.5 px-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center space-x-1.5 ${
              mode === "finance"
                ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-400"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span>💰</span>
            <span>Finance Mode</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange("assistant")}
            className={`py-2.5 px-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center space-x-1.5 ${
              mode === "assistant"
                ? "bg-purple-600 text-white shadow-md ring-2 ring-purple-400"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span>💬</span>
            <span>Assistant Mode</span>
          </button>
        </div>
      </div>

      {/* Visual Indication: Study Mode Active / Disabled */}
      {mode === "study" ? (
        <div className="mb-4 p-3.5 bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 border-2 border-indigo-300 rounded-xl shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-600"></span>
              </span>
              <span className="font-bold text-indigo-900 text-sm">Study Mode Active</span>
              <span className="text-xs text-indigo-700 hidden sm:inline font-medium">
                — Learning tutor (Concepts, Steps, Examples & Hints)
              </span>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-600 text-white rounded-full shadow-sm">
              Gemini AI
            </span>
          </div>
        </div>
      ) : (
        <div className="mb-4 p-2.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between text-xs text-gray-600">
          <span className="flex items-center space-x-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400"></span>
            <span>
              Current: <strong>{mode === "finance" ? "💰 Finance Commands" : "💬 General Assistant"}</strong> (Study Mode: Disabled)
            </span>
          </span>
          <button
            type="button"
            onClick={() => handleModeChange("study")}
            className="text-indigo-600 font-semibold hover:text-indigo-800 hover:underline"
          >
            Turn On Study Mode →
          </button>
        </div>
      )}

      {/* Query Input Area */}
      <div className="relative">
        <textarea
          className="w-full p-4 border rounded-xl bg-gray-50 resize-none shadow-inner focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition text-gray-800 text-sm leading-relaxed"
          rows={4}
          placeholder={getPlaceholder()}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendQuery();
            }
          }}
        />
      </div>

      {/* Action Buttons & Audio Options */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
        <div className="flex space-x-2.5 flex-grow">
          <button
            onClick={sendQuery}
            className={`flex-grow py-3 px-4 rounded-xl font-semibold shadow-md transition flex items-center justify-center space-x-1.5 ${
              loading || !mode || !text.trim()
                ? "bg-indigo-300 cursor-not-allowed text-white"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }`}
            disabled={loading || !mode || !text.trim()}
          >
            <span>{loading ? "Thinking..." : "Send Query"}</span>
            {!loading && <span>↵</span>}
          </button>

          <button
            onClick={startListening}
            className={`py-3 px-4 rounded-xl font-semibold shadow-md transition text-white flex items-center space-x-1.5 ${
              loading || !mode
                ? "bg-emerald-300 cursor-not-allowed"
                : listening
                ? "bg-red-500 hover:bg-red-600 animate-pulse"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
            disabled={loading || !mode}
          >
            <span>{listening ? "Listening..." : "🎙 Voice"}</span>
          </button>

          <button
            onClick={handleClear}
            className="py-3 px-4 rounded-xl font-medium shadow-sm bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
            disabled={loading}
          >
            Clear
          </button>
        </div>

        {/* Global Stop Audio Button (always accessible when audio is playing) */}
        {isSpeaking && (
          <button
            type="button"
            onClick={stopAudio}
            className="py-3 px-4 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-lg animate-pulse transition flex items-center justify-center space-x-1.5"
            title="Immediately stop all audio playback"
          >
            <span className="text-base">⏹</span>
            <span>Stop Audio</span>
          </button>
        )}
      </div>

      {/* Auto Read-Aloud Toggle (Option 3: Default OFF) */}
      <div className="flex justify-end items-center mt-2 px-1">
        <label className="inline-flex items-center text-xs text-gray-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoReadAloud}
            onChange={(e) => {
              setAutoReadAloud(e.target.checked);
              if (!e.target.checked) {
                stopAudio();
              }
            }}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-1.5"
          />
          <span>Auto Read Aloud (off by default)</span>
        </label>
      </div>

      {/* Assistant Reply Card */}
      {reply && (
        <div className="mt-5 p-5 bg-white border border-indigo-100 rounded-2xl shadow-lg transition-all">
          <div className="flex justify-between items-center pb-3 mb-3 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-gray-800 text-sm tracking-wide flex items-center space-x-1.5">
                <span>🤖</span>
                <span>
                  {mode === "study"
                    ? "Study Tutor Response"
                    : mode === "finance"
                    ? "Finance Result"
                    : "Assistant Response"}
                </span>
              </span>
            </div>

            {/* Audio Controls inside response box */}
            <div className="flex items-center space-x-2">
              {isSpeaking ? (
                <button
                  type="button"
                  onClick={stopAudio}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5"
                  title="Stop audio speech"
                >
                  <span className="text-sm">⏹</span>
                  <span>Stop Audio</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => speakInBrowser(reply)}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 transition flex items-center space-x-1.5"
                  title="Read response aloud"
                >
                  <span>🔊</span>
                  <span>Read Aloud</span>
                </button>
              )}
            </div>
          </div>

          {/* Response Text Display with Markdown formatting */}
          <div className="text-gray-800 text-sm leading-relaxed max-h-96 overflow-y-auto whitespace-pre-line pr-1">
            {reply}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssistantPage;