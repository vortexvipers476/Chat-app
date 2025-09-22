import { useState, useEffect, useRef } from 'react';
import { database } from '../lib/firebase';
import { ref, push, onValue, serverTimestamp, set } from 'firebase/database';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const [lastMessageTime, setLastMessageTime] = useState(0);
  const [cooldownTime, setCooldownTime] = useState(0);
  const messagesEndRef = useRef(null);
  
  // Constants for message limits
  const MAX_MESSAGE_LENGTH = 200;
  const COOLDOWN_SECONDS = 2; // 2 seconds cooldown between messages

  // Set isClient to true when component mounts on client
  useEffect(() => {
    setIsClient(true);
    
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
  }, []);

  // Update cooldown timer
  useEffect(() => {
    if (cooldownTime > 0) {
      const timer = setTimeout(() => {
        setCooldownTime(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownTime]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Only run on client side
    if (!isClient) return;

    // Check connection status
    const connectedRef = ref(database, '.info/connected');
    const unsubscribeConnected = onValue(connectedRef, (snapshot) => {
      const connected = snapshot.val();
      setConnectionStatus(connected ? 'connected' : 'disconnected');
      console.log("Firebase connection status:", connected ? "Connected" : "Disconnected");
    });

    // Create a test connection to verify database access
    const testRef = ref(database, '.info/serverTimeOffset');
    const unsubscribeTest = onValue(testRef, (snapshot) => {
      console.log("Database connection test successful");
    }, (error) => {
      console.error("Database connection test failed:", error);
      setError(`Database connection error: ${error.message}`);
    });

    // Fetch messages from Firebase
    const messagesRef = ref(database, 'messages');
    const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      console.log("Firebase data received:", data);
      
      if (data) {
        // Convert object to array and sort by timestamp
        const messageList = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value
        })).sort((a, b) => {
          // Handle server timestamp
          const timeA = a.timestamp || 0;
          const timeB = b.timestamp || 0;
          return timeA - timeB;
        });
        
        setMessages(messageList);
        console.log("Messages updated:", messageList);
      } else {
        setMessages([]);
        console.log("No messages found");
      }
    }, (error) => {
      console.error("Error fetching messages:", error);
      setError(`Error fetching messages: ${error.message}`);
    });

    return () => {
      // Cleanup subscriptions
      unsubscribeConnected();
      unsubscribeTest();
      unsubscribeMessages();
    };
  }, [isClient]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    // Check if message is empty
    if (newMessage.trim() === '' || username.trim() === '') return;
    
    // Check if message is too long
    if (newMessage.length > MAX_MESSAGE_LENGTH) {
      setError(`Message is too long! Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`);
      return;
    }
    
    // Check cooldown
    const now = Date.now();
    const timeSinceLastMessage = (now - lastMessageTime) / 1000; // in seconds
    
    if (timeSinceLastMessage < COOLDOWN_SECONDS) {
      setError(`Please wait ${Math.ceil(COOLDOWN_SECONDS - timeSinceLastMessage)} seconds before sending another message.`);
      return;
    }
    
    console.log("Sending message:", {
      username: username,
      text: newMessage,
      timestamp: serverTimestamp()
    });

    const messagesRef = ref(database, 'messages');
    
    // Create a unique key for the message
    const newMessageRef = push(messagesRef);
    
    // Set the message data
    set(newMessageRef, {
      username: username,
      text: newMessage,
      timestamp: serverTimestamp()
    }).then(() => {
      console.log("Message sent successfully");
      setNewMessage('');
      setLastMessageTime(now);
      setCooldownTime(COOLDOWN_SECONDS);
      setError(null);
    }).catch(error => {
      console.error("Error sending message:", error);
      setError(`Error sending message: ${error.message}`);
    });
  };

  const handleUsernameChange = (e) => {
    const newUsername = e.target.value;
    setUsername(newUsername);
    if (isClient) {
      localStorage.setItem('chatUsername', newUsername);
    }
  };

  const handleMessageChange = (e) => {
    const text = e.target.value;
    if (text.length <= MAX_MESSAGE_LENGTH) {
      setNewMessage(text);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const clearMessages = () => {
    if (confirm('Are you sure you want to clear all messages?')) {
      const messagesRef = ref(database, 'messages');
      set(messagesRef, null)
        .then(() => console.log("Messages cleared"))
        .catch(error => console.error("Error clearing messages:", error));
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
          <h1 className="text-2xl font-bold">Realtime Chat</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className="text-sm">{connectionStatus}</span>
            </div>
            <button 
              onClick={clearMessages}
              className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
            >
              Clear Messages
            </button>
          </div>
        </div>
        
        {error && (
          <div className="p-3 bg-red-100 text-red-700">
            {error}
          </div>
        )}
        
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
              {messages.map((message) => (
                <div 
                  key={message.id} 
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
          <div className="mb-2 flex justify-between text-sm text-gray-500 dark:text-gray-400">
            <div>
              Characters: {newMessage.length}/{MAX_MESSAGE_LENGTH}
            </div>
            {cooldownTime > 0 && (
              <div className="text-orange-500">
                Please wait {cooldownTime}s before sending another message
              </div>
            )}
          </div>
          <div className="flex">
            <textarea
              value={newMessage}
              onChange={handleMessageChange}
              placeholder="Type a message..."
              rows={2}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
            <button
              type="submit"
              disabled={cooldownTime > 0 || newMessage.trim() === ''}
              className={`px-4 py-2 rounded-r-lg ${
                cooldownTime > 0 || newMessage.trim() === ''
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
              } text-white`}
            >
              Send
            </button>
          </div>
        </form>
      </div>
      
      {/* Debug info - remove in production */}
      <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
        <h3 className="font-bold mb-2">Debug Info:</h3>
        <p>Connection Status: {connectionStatus}</p>
        <p>Messages Count: {messages.length}</p>
        <p>Username: {username}</p>
        <p>Is Client: {isClient ? 'Yes' : 'No'}</p>
        <p>Last Message Time: {new Date(lastMessageTime).toLocaleTimeString()}</p>
        <p>Cooldown Time: {cooldownTime}s</p>
        {error && <p className="text-red-500">Error: {error}</p>}
      </div>
    </div>
  );
               }
