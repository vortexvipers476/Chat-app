import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

let socket;

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Initialize socket connection
    socket = io();

    // Listen for messages
    socket.on('chat message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      socket.emit('chat message', inputValue);
      setInputValue('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 p-4 shadow-lg">
        <h1 className="text-2xl font-bold text-center">Real-Time Chat</h1>
      </header>

      {/* Chat Container */}
      <main className="flex-1 overflow-y-auto p-4 max-w-3xl mx-auto w-full">
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className="bg-gray-800 rounded-lg p-4 shadow-md animate-fadeIn"
            >
              <p className="break-words">{msg}</p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Form */}
      <footer className="bg-gray-800 p-4 border-t border-gray-700">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ketik pesan..."
            className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition duration-200"
          >
            Kirim
          </button>
        </form>
      </footer>
    </div>
  );
    }
