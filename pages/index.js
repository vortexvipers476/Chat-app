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
  const [spamWarnings, setSpamWarnings] = useState({});
  const [spamCount, setSpamCount] = useState(0);
  const [usernameChangeCount, setUsernameChangeCount] = useState(0);
  const [usernameError, setUsernameError] = useState('');
  const messagesEndRef = useRef(null);
  
  // Constants for message limits
  const MAX_MESSAGE_LENGTH = 200;
  const COOLDOWN_SECONDS = 2; // 2 seconds cooldown between messages
  const SPAM_THRESHOLD = 3; // Number of spam attempts before temporary mute
  const SPAM_PENALTY_SECONDS = 10; // Temporary mute duration in seconds
  const USERNAME_MIN_LENGTH = 4; // Minimum username length
  const USERNAME_MAX_LENGTH = 10; // Maximum username length
  const MAX_USERNAME_CHANGES = 1; // Maximum number of username changes
  
  // List of bad words to filter (add more as needed)
  const BAD_WORDS = [
    'fuck', 'shit', 'asshole', 'bitch', 'bastard', 'damn', 'crap',
    'pussy', 'dick', 'cock', 'whore', 'slut', 'idiot', 'stupid',
    'goblok', 'bego', 'asu', 'anjing', 'bangsat', 'kontol', 'memek',
    'ngentot', 'tolol', 'pantek', 'jancok', 'ngewe'
  ];

  // Function to censor bad words
  const censorBadWords = (text) => {
    let censoredText = text;
    BAD_WORDS.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      censoredText = censoredText.replace(regex, '*'.repeat(word.length));
    });
    return censoredText;
  };

  // Function to validate username
  const validateUsername = (name) => {
    if (name.length < USERNAME_MIN_LENGTH) {
      return `Username must be at least ${USERNAME_MIN_LENGTH} characters long`;
    }
    if (name.length > USERNAME_MAX_LENGTH) {
      return `Username must be no more than ${USERNAME_MAX_LENGTH} characters long`;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    return '';
  };

  // Set isClient to true when component mounts on client
  useEffect(() => {
    setIsClient(true);
    
    // Get username and change count from localStorage
    const savedUsername = localStorage.getItem('chatUsername');
    const savedChangeCount = parseInt(localStorage.getItem('usernameChangeCount') || '0');
    
    setUsernameChangeCount(savedChangeCount);
    
    if (savedUsername) {
      setUsername(savedUsername);
    } else {
      const name = prompt('Enter your username:');
      if (name) {
        const validationError = validateUsername(name);
        if (validationError) {
          setUsernameError(validationError);
          return;
        }
        setUsername(name);
        localStorage.setItem('chatUsername', name);
        localStorage.setItem('usernameChangeCount', '0');
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

  // Update spam warnings timer
  useEffect(() => {
    if (spamCount > 0) {
      const timer = setTimeout(() => {
        setSpamCount(0);
      }, SPAM_PENALTY_SECONDS * 1000);
      return () => clearTimeout(timer);
    }
  }, [spamCount]);

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
    
    // Check if user is muted due to spam
    if (spamCount >= SPAM_THRESHOLD) {
      setError(`You are temporarily muted for spamming. Please wait ${SPAM_PENALTY_SECONDS} seconds.`);
      return;
    }
    
    // Check if message is too long
    if (newMessage.length > MAX_MESSAGE_LENGTH) {
      setError(`Message is too long! Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`);
      return;
    }
    
    // Check cooldown
    const now = Date.now();
    const timeSinceLastMessage = (now - lastMessageTime) / 1000; // in seconds
    
    if (timeSinceLastMessage < COOLDOWN_SECONDS) {
      // Increment spam count
      const newSpamCount = spamCount + 1;
      setSpamCount(newSpamCount);
      
      // Update spam warnings for this user
      setSpamWarnings(prev => ({
        ...prev,
        [username]: (prev[username] || 0) + 1
      }));
      
      if (newSpamCount >= SPAM_THRESHOLD) {
        setError(`Spam detected! You are temporarily muted for ${SPAM_PENALTY_SECONDS} seconds.`);
      } else {
        setError(`Please wait ${Math.ceil(COOLDOWN_SECONDS - timeSinceLastMessage)} seconds before sending another message. Spam warning: ${newSpamCount}/${SPAM_THRESHOLD}`);
      }
      return;
    }
    
    // Censor bad words
    const censoredMessage = censorBadWords(newMessage);
    
    console.log("Sending message:", {
      username: username,
      text: censoredMessage,
      originalText: newMessage !== censoredMessage ? newMessage : null,
      timestamp: serverTimestamp()
    });

    const messagesRef = ref(database, 'messages');
    
    // Create a unique key for the message
    const newMessageRef = push(messagesRef);
    
    // Set the message data
    set(newMessageRef, {
      username: username,
      text: censoredMessage,
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
    
    // Validate username
    const validationError = validateUsername(newUsername);
    setUsernameError(validationError);
    
    if (!validationError) {
      setUsername(newUsername);
    }
  };

  const handleUsernameSubmit = () => {
    if (usernameError || username.trim() === '') return;
    
    // Check if user has already changed username the maximum number of times
    if (usernameChangeCount >= MAX_USERNAME_CHANGES) {
      setUsernameError(`You can only change your username ${MAX_USERNAME_CHANGES} time`);
      return;
    }
    
    // Update username change count
    const newChangeCount = usernameChangeCount + 1;
    setUsernameChangeCount(newChangeCount);
    localStorage.setItem('usernameChangeCount', newChangeCount.toString());
    localStorage.setItem('chatUsername', username);
    
    // Show success message
    setUsernameError('');
    setError('Username updated successfully!');
    
    // Clear error after 3 seconds
    setTimeout(() => {
      setError(null);
    }, 3000);
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

  const clearSpamWarnings = () => {
    setSpamWarnings({});
    setSpamCount(0);
  };

  const resetUsernameChanges = () => {
    if (confirm('Are you sure you want to reset username change limits? This is for admin use only.')) {
      setUsernameChangeCount(0);
      localStorage.setItem('usernameChangeCount', '0');
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
          <div className={`p-3 ${spamCount >= SPAM_THRESHOLD ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {error}
          </div>
        )}
        
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center">
              <label className="mr-2 text-gray-700 dark:text-gray-300">Username:</label>
              <input
                type="text"
                value={username}
                onChange={handleUsernameChange}
                disabled={usernameChangeCount >= MAX_USERNAME_CHANGES}
                className={`px-3 py-1 border rounded-md ${
                  usernameError 
                    ? 'border-red-500' 
                    : usernameChangeCount >= MAX_USERNAME_CHANGES 
                      ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              />
              <button
                onClick={handleUsernameSubmit}
                disabled={usernameChangeCount >= MAX_USERNAME_CHANGES || !!usernameError || username.trim() === ''}
                className={`ml-2 px-3 py-1 rounded-md ${
                  usernameChangeCount >= MAX_USERNAME_CHANGES || !!usernameError || username.trim() === ''
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {usernameChangeCount === 0 ? 'Set' : 'Change'}
              </button>
            </div>
            <div className="flex justify-between text-sm">
              {usernameError && (
                <span className="text-red-500">{usernameError}</span>
              )}
              <span className="text-gray-500 dark:text-gray-400">
                Changes left: {MAX_USERNAME_CHANGES - usernameChangeCount}/{MAX_USERNAME_CHANGES}
              </span>
            </div>
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
                    <div className="flex justify-between items-start">
                      {message.username !== username && (
                        <div className="font-semibold text-sm flex items-center">
                          {message.username}
                          {spamWarnings[message.username] >= SPAM_THRESHOLD && (
                            <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                              SPAM
                            </span>
                          )}
                        </div>
                      )}
                      <div className={`text-xs ${
                        message.username === username 
                          ? 'text-indigo-200' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {formatTime(message.timestamp)}
                      </div>
                    </div>
                    <div className="mt-1">{message.text}</div>
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
            {spamCount > 0 && spamCount < SPAM_THRESHOLD && (
              <div className="text-yellow-500">
                Spam warning: {spamCount}/{SPAM_THRESHOLD}
              </div>
            )}
            {spamCount >= SPAM_THRESHOLD && (
              <div className="text-red-500">
                You are temporarily muted for spamming
              </div>
            )}
          </div>
          <div className="flex">
            <textarea
              value={newMessage}
              onChange={handleMessageChange}
              placeholder="Type a message..."
              rows={2}
              disabled={spamCount >= SPAM_THRESHOLD}
              className={`flex-1 px-4 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none ${
                spamCount >= SPAM_THRESHOLD 
                  ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
              }`}
            />
            <button
              type="submit"
              disabled={cooldownTime > 0 || newMessage.trim() === '' || spamCount >= SPAM_THRESHOLD}
              className={`px-4 py-2 rounded-r-lg ${
                cooldownTime > 0 || newMessage.trim() === '' || spamCount >= SPAM_THRESHOLD
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
              } text-white`}
            >
              Send
            </button>
          </div>
        </form>
      </div>
      
      {/* Admin Panel - remove in production */}
      <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
        <h3 className="font-bold mb-2">Admin Panel</h3>
        <div className="flex space-x-2 mb-2">
          <button 
            onClick={clearSpamWarnings}
            className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Clear Spam Warnings
          </button>
          <button 
            onClick={resetUsernameChanges}
            className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Reset Username Changes
          </button>
        </div>
        <div>
          <h4 className="font-semibold mb-1">Spam Warnings:</h4>
          {Object.keys(spamWarnings).length === 0 ? (
            <p>No spam warnings</p>
          ) : (
            <ul className="list-disc pl-5">
              {Object.entries(spamWarnings).map(([user, count]) => (
                <li key={user} className="flex justify-between">
                  <span>{user}: {count} warnings</span>
                  {count >= SPAM_THRESHOLD && (
                    <span className="text-red-500">MUTED</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      
      {/* Debug info - remove in production */}
      <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
        <h3 className="font-bold mb-2">Debug Info:</h3>
        <p>Connection Status: {connectionStatus}</p>
        <p>Messages Count: {messages.length}</p>
        <p>Username: {username}</p>
        <p>Username Changes: {usernameChangeCount}/{MAX_USERNAME_CHANGES}</p>
        <p>Is Client: {isClient ? 'Yes' : 'No'}</p>
        <p>Last Message Time: {new Date(lastMessageTime).toLocaleTimeString()}</p>
        <p>Cooldown Time: {cooldownTime}s</p>
        <p>Spam Count: {spamCount}/{SPAM_THRESHOLD}</p>
        {error && <p className="text-red-500">Error: {error}</p>}
        {usernameError && <p className="text-red-500">Username Error: {usernameError}</p>}
      </div>
    </div>
  );
}
