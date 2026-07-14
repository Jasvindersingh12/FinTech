import React, { useState } from "react";
import listenImg from "../assets/listen.png";
import waitImg from "../assets/wait.png";

const AssistantPage = ({ activePage , onFinanceAction }) => {
  const [mode, setMode] = useState("");
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);

  // ---------------- Get correct assistant image ----------------
  const getAssistantImage = () => {
    if (listening) return listenImg;  // listening animation
    if (loading) return waitImg;      // loading animation
    return waitImg;                   // idle state = wait.png
  };

  // ---------------- Send Query via Text ----------------
  const sendQuery = async () => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    setLoading(true);
    setReply("");
    setListening(false);

    try {
      const res = await fetch("http://127.0.0.1:8000/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmedText, mode }),
      });
        if (mode === "finance" && res.ok) {
      if (onFinanceAction) onFinanceAction(); // 🔥 refresh dashboard + transactions
  }
      const data = await res.json();
      setReply(data.reply || "No response from assistant.");
    } catch (err) {
      console.error(err);
      setReply(`Error connecting server: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Voice Command ----------------
  const startListening = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Speech Recognition not supported in this browser.");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.start();
    setListening(true);
    setReply("🎙 Listening...");

    recognition.onresult = async (event) => {
      const spokenText = event.results[0][0].transcript;
      setText(spokenText);

      setListening(false);
      setLoading(true);

      try {
        const res = await fetch("http://127.0.0.1:8000/assistant/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, text: spokenText }),
        });

        const data = await res.json();
        setReply(data.reply || "No response from assistant.");
      } catch (err) {
        console.error(err);
        setReply(`Error connecting server: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      setReply(`Speech recognition error: ${event.error}`);
    };
  };

  const handleClear = () => {
    setText("");
    setReply("");
    setLoading(false);
    setListening(false);
  };

  const getPlaceholder = () => {
    if (mode === "finance") return "Example: add expense 20 drink / show my balance";
    if (mode === "assistant") return "Example: open youtube / open google";
    if (mode === "study") return "Ask any study question...";
    return "Select mode and enter your query...";
  };

  return (
    
    <div className={`page ${activePage === "assistant" ? "block" : "hidden"} p-6 max-w-xl mx-auto`}>
      <h1 className="text-3xl font-bold mb-6 text-gray-800 flex justify-center mb-6 ">       Smart Buddy Assistant</h1>

      {/* Assistant Image */}
      <div className="flex justify-center mb-6">
        <img
          src={getAssistantImage()}
          alt="assistant-state"
          className="w-40 h-40 transition-all duration-300"
        />
      </div>

      

      {/* Mode Selection */}
      <div className="mb-4">
        <label htmlFor="mode-select" className="block font-semibold mb-2 text-gray-700">
          Select Mode
        </label>
       <select
  id="mode-select"
  className="p-3 border rounded-lg w-full bg-white shadow-sm"
  value={mode}
  onChange={(e) => {
    setMode(e.target.value);
    setReply("");

    // 🔥 Show listening robot as soon as mode is selected
    setListening(true);
    setLoading(false);
  }}
>
  <option value="">-- Choose Mode --</option>
  <option value="finance">💰 Finance Mode</option>
  <option value="assistant">💬 Assistant Mode</option>
  <option value="study">📚 Study Mode</option>
</select>

      </div>

      {/* Text Input */}
      <textarea
        className="w-full p-4 border rounded-lg bg-gray-50 resize-none shadow-inner"
        rows={4}
        placeholder={getPlaceholder()}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={loading}
      />

      {/* Buttons */}
      <div className="flex space-x-4 mt-4">
        <button
          onClick={sendQuery}
          className={`flex-grow py-3 rounded-lg shadow-md ${
            loading || !mode || !text.trim()
              ? "bg-blue-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
          disabled={loading || !mode || !text.trim()}
        >
          {loading ? "Processing..." : "Send Query"}
        </button>

        <button
          onClick={startListening}
          className="w-1/2 bg-green-600 text-white py-3 rounded-lg shadow-md hover:bg-green-700"
          disabled={loading || !mode}
        >
          Voice Command
        </button>

        <button
          onClick={handleClear}
          className="w-1/4 bg-gray-200 text-gray-700 py-3 rounded-lg shadow-md hover:bg-gray-300"
          disabled={loading}
        >
          Clear
        </button>
      </div>

      {/* Reply */}
      {reply && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl shadow-lg">
          <h3 className="font-bold text-blue-700 mb-2">Assistant Reply:</h3>
          <p className="whitespace-pre-line text-gray-800">{reply}</p>
        </div>
      )}
    </div>
  );
};

export default AssistantPage;
