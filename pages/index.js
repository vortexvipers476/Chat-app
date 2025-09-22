import { useState, useEffect, useRef } from 'react';
import { database } from '../lib/firebase';
import { ref, push, onValue, serverTimestamp } from 'firebase/database';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const messagesEndRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Get username from localStorage or prompt user
    const savedUsername = localStorage.getItem('chatUsername');
    if (savedUsername) {
      setUsername(savedUsername);
    } else {
      const name = prompt('Enter your username:');
      if (name) {
        setUsername(name);
        localStorage.setItem('chatUsername', name);
      }
    }

    // Fetch messages from Firebase
    const messagesRef = ref(database, 'messages');
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messageList = Object.values(data).sort((a, b) => 
          new Date(a.timestamp) - new Date(b.timestamp)
        );
        setMessages(messageList);
      } else {
        setMessages([]);
      }
    });

    return () => {
      // Cleanup if needed
    };
  }, []);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() === '' || username.trim() === '') return;

    const messagesRef = ref(database, 'messages');
    push(messagesRef, {
      username: username,
      text: newMessage,
      timestamp: serverTimestamp()
    });

    setNewMessage('');
  };

  const handleUsernameChange = (e) => {
    const newUsername = e.target.value;
    setUsername(newUsername);
    localStorage.setItem('chatUsername', newUsername);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 bg-indigo-600 text-white">
          <h1 className="text-2xl font-bold">Realtime Chat</h1>
        </div>
        
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <label className="mr-2 text-gray-700 dark:text-gray-300">Username:</label>
            <input
              type="text"
              value={username}
              onChange={handleUsernameChange}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
        
        <div className="h-96 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No messages yet. Start a conversation!
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div 
                  key={index} 
                  className={`flex ${message.username === username ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg ${
                      message.username === username 
                        ? 'bg-indigo-500 text-white rounded-br-none' 
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-bl-none'
                    }`}
                  >
                    {message.username !== username && (
                      <div className="font-semibold text-sm">{message.username}</div>
                    )}
                    <div>{message.text}</div>
                    <div className={`text-xs mt-1 ${
                      message.username === username 
                        ? 'text-indigo-200' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        
        <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-gray-800">
          <div className="flex">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-r-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
      }
