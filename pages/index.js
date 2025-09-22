import { useState, useEffect, useRef } from 'react';
import { database } from '../lib/firebase';
import { ref, push, onValue, serverTimestamp, set, remove, get } from 'firebase/database';
import CustomAlert from '../components/CustomAlert';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const [lastMessageTime, setLastMessageTime] = useState(0);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [systemNotifications, setSystemNotifications] = useState([]);
  const [databaseInfo, setDatabaseInfo] = useState(null);
  const messagesEndRef = useRef(null);

  const [alert, setAlert] = useState({ type: '', message: '' });
  const [confirmData, setConfirmData] = useState(null);

  const MAX_MESSAGE_LENGTH = 70;
  const VIRTEX_LENGTH = 3500;
  const COOLDOWN_SECONDS = 7;

  const showAlert = (type, message) => {
    setAlert({ type, message });
  };

  const showConfirm = (message, onConfirm) => {
    setConfirmData({ message, onConfirm });
  };

  useEffect(() => {
    setIsClient(true);
    console.log("Component mounted on client side");

    const savedUsername = localStorage.getItem('chatUsername');
    if (savedUsername) {
      setUsername(savedUsername);
      console.log("Username loaded from localStorage:", savedUsername);
    } else {
      const name = prompt('Enter your username:');
      if (name) {
        setUsername(name);
        localStorage.setItem('chatUsername', name);
        console.log("New username set:", name);
      }
    }
  }, []);

  useEffect(() => {
    if (!isClient) return;

    console.log("Testing database connection...");

    const testRef = ref(database, '.info/serverTimeOffset');

    get(testRef).then((snapshot) => {
      if (snapshot.exists()) {
        console.log("Database connection test successful");
        setDatabaseInfo({
          status: "connected",
          serverTimeOffset: snapshot.val()
        });
      } else {
        console.error("Database connection test failed: No data returned");
        setDatabaseInfo({
          status: "error",
          message: "No data returned from database"
        });
      }
    }).catch((error) => {
      console.error("Database connection test failed:", error);
      setDatabaseInfo({
        status: "error",
        message: error.message
      });
    });
  }, [isClient, database]);

  useEffect(() => {
    if (cooldownTime > 0) {
      const timer = setTimeout(() => {
        setCooldownTime(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownTime]);

  useEffect(() => {
    if (systemNotifications.length > 0) {
      const timer = setTimeout(() => {
        setSystemNotifications(prev => prev.slice(1));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [systemNotifications]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, systemNotifications]);

  useEffect(() => {
    if (!isClient) return;

    console.log("Setting up Firebase listeners...");

    const connectedRef = ref(database, '.info/connected');
    const unsubscribeConnected = onValue(connectedRef, (snapshot) => {
      const connected = snapshot.val();
      setConnectionStatus(connected ? 'connected' : 'disconnected');
      console.log("Firebase connection status changed:", connected ? "Connected" : "Disconnected");
    });

    const messagesRef = ref(database, 'messages');
    const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
      console.log("Messages data received from Firebase");

      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log("Messages data:", data);

        const messageList = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value
        })).sort((a, b) => {
          const timeA = a.timestamp || 0;
          const timeB = b.timestamp || 0;
          return timeA - timeB;
        });

        setMessages(messageList);
        console.log("Messages updated:", messageList.length, "messages");
      } else {
        console.log("No messages found in database");
        setMessages([]);
      }
    }, (error) => {
      console.error("Error fetching messages:", error);
      showAlert('error', `Error fetching messages: ${error.message}`);
    });

    return () => {
      console.log("Cleaning up Firebase listeners");
      unsubscribeConnected();
      unsubscribeMessages();
    };
  }, [isClient, database]);

  const handleSendMessage = (e) => {
    e.preventDefault();

    if (newMessage.trim() === '' || username.trim() === '') {
      showAlert('warning', "Empty message or username");
      return;
    }

    if (newMessage.length > MAX_MESSAGE_LENGTH) {
      showAlert('error', `Message is too long! Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`);
      return;
    }

    const now = Date.now();
    const timeSinceLastMessage = (now - lastMessageTime) / 1000;

    if (timeSinceLastMessage < COOLDOWN_SECONDS) {
      showAlert('warning', `Please wait ${Math.ceil(COOLDOWN_SECONDS - timeSinceLastMessage)} seconds before sending another message.`);
      return;
    }

    if (newMessage.length > VIRTEX_LENGTH) {
      showAlert('error', `Message too long! Maximum ${VIRTEX_LENGTH} characters allowed to prevent spam.`);
      return;
    }

    console.log("Sending message:", {
      username: username,
      text: newMessage,
      timestamp: serverTimestamp()
    });

    const messagesRef = ref(database, 'messages');

    const newMessageRef = push(messagesRef);

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
      showAlert('error', `Error sending message: ${error.message}`);
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
    showConfirm('Are you sure you want to clear all messages?', () => {
      const messagesRef = ref(database, 'messages');
      set(messagesRef, null)
        .then(() => {
          showAlert('success', "Messages cleared successfully");
          console.log("Messages cleared");
        })
        .catch(error => {
          showAlert('error', `Error clearing messages: ${error.message}`);
          console.error("Error clearing messages:", error);
        });
      setConfirmData(null);
    });
  };

  const deleteMessage = (messageId) => {
    showConfirm('Are you sure you want to delete this message?', () => {
      const messageRef = ref(database, `messages/${messageId}`);
      remove(messageRef)
        .then(() => {
          showAlert('success', "Message deleted successfully");
          console.log("Message deleted");
        })
        .catch(error => {
          showAlert('error', `Error deleting message: ${error.message}`);
          console.error("Error deleting message:", error);
        });
      setConfirmData(null);
    });
  };

  const reportVirtex = (messageId, senderUsername) => {
    showConfirm(`Report ${senderUsername} for sending virtex?`, () => {
      const messageRef = ref(database, `messages/${messageId}`);
      remove(messageRef)
        .then(() => {
          showAlert('warning', `@${senderUsername} has been reported and message deleted.`);
          console.log("Virtex message deleted");

          const notification = {
            id: Date.now(),
            type: 'virtex',
            message: `@${senderUsername} has been reported for sending virtex. The message has been deleted.`,
            timestamp: serverTimestamp()
          };

          const notificationsRef = ref(database, 'notifications');
          push(notificationsRef, notification);

          setSystemNotifications(prev => [...prev, notification]);
        })
        .catch(error => {
          showAlert('error', `Error deleting virtex message: ${error.message}`);
          console.error("Error deleting virtex message:", error);
        });
      setConfirmData(null);
    });
  };

  const testConnection = () => {
    console.log("Manual connection test initiated");
    setConnectionStatus('connecting');

    const testRef = ref(database, '.info/serverTimeOffset');

    get(testRef).then((snapshot) => {
      if (snapshot.exists()) {
        console.log("Manual connection test successful");
        setConnectionStatus('connected');
        setDatabaseInfo({
          status: "connected",
          serverTimeOffset: snapshot.val(),
          lastTest: new Date().toLocaleTimeString()
        });
        showAlert('success', 'Connection test successful');
      } else {
        console.error("Manual connection test failed: No data returned");
        setConnectionStatus('disconnected');
        setDatabaseInfo({
          status: "error",
          message: "No data returned from database",
          lastTest: new Date().toLocaleTimeString()
        });
        showAlert('error', 'Connection test failed: No data returned');
      }
    }).catch((error) => {
      console.error("Manual connection test failed:", error);
      setConnectionStatus('disconnected');
      setDatabaseInfo({
        status: "error",
        message: error.message,
        lastTest: new Date().toLocaleTimeString()
      });
      showAlert('error', `Connection test failed: ${error.message}`);
    });
  };

  const ConfirmModal = () => {
    if (!confirmData) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full shadow-lg">
          <p className="mb-4 text-gray-900 dark:text-gray-100">{confirmData.message}</p>
          <div className="flex justify-end space-x-4">
            <button
              onClick={() => setConfirmData(null)}
              className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded hover:bg-gray-400 dark:hover:bg-gray-600 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => confirmData.onConfirm()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 font-sans">
      {/* Alert Component */}
      <CustomAlert
        type={alert.type}
        message={alert.message}
        onClose={() => setAlert({ type: '', message: '' })}
      />

      {/* Confirmation Modal */}
      <ConfirmModal />

      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Realtime Chat</h1>
            </div>
            
            <div className="flex flex-wrap gap-2 justify-center">
              <div className="flex items-center space-x-2 bg-white/20 px-3 py-1 rounded-full">
                <div className={`w-3 h-3 rounded-full ${connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                <span className="text-sm font-medium capitalize">{connectionStatus}</span>
              </div>
              
              <button
                onClick={testConnection}
                className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-sm transition flex items-center space-x-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Test Connection</span>
              </button>
              
              <button
                onClick={clearMessages}
                className="bg-red-500/80 hover:bg-red-500 px-3 py-1 rounded-full text-sm transition flex items-center space-x-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Clear All</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Username Input */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <label className="block mb-2 text-gray-700 dark:text-gray-300 font-semibold">Your Username:</label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={username}
              onChange={handleUsernameChange}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              placeholder="Enter your username"
            />
            <div className="flex items-center justify-center bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-4 rounded-lg font-medium">
              {username || "Not set"}
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden mb-6">
          {/* Messages Header */}
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              Messages {messages.length > 0 && `(${messages.length})`}
            </h2>
            {cooldownTime > 0 && (
              <div className="text-sm bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-3 py-1 rounded-full font-medium">
                Cooldown: {cooldownTime}s
              </div>
            )}
          </div>

          {/* Messages Area */}
          <div className="h-80 md:h-96 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 py-8">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="text-center">No messages yet. Start a conversation!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.username === username ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs md:max-w-md px-4 py-3 rounded-2xl shadow-sm ${
                        message.username === username
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-br-none'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white rounded-bl-none'
                      } relative`}
                    >
                      {message.username !== username && (
                        <div className="font-semibold text-sm mb-1 opacity-90">{message.username}</div>
                      )}
                      <div className="whitespace-pre-wrap break-words">{message.text}</div>
                      <div
                        className={`text-xs mt-1 ${
                          message.username === username
                            ? 'text-indigo-200'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </div>
                      
                      {/* Message Actions */}
                      <div className="absolute -bottom-5 right-0 flex space-x-2 opacity-0 hover:opacity-100 transition-opacity">
                        {message.username !== username && (
                          <button
                            onClick={() => reportVirtex(message.id, message.username)}
                            className="text-xs bg-red-500 text-white px-2 py-1 rounded-full hover:bg-red-600 transition"
                            title="Report as spam"
                          >
                            Report
                          </button>
                        )}
                        {message.username === username && (
                          <button
                            onClick={() => deleteMessage(message.id)}
                            className="text-xs bg-gray-500 text-white px-2 py-1 rounded-full hover:bg-gray-600 transition"
                            title="Delete message"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <form onSubmit={handleSendMessage}>
              <div className="mb-2 flex justify-between text-sm text-gray-500 dark:text-gray-400">
                <div>
                  {newMessage.length}/{MAX_MESSAGE_LENGTH} characters
                </div>
                <div className={newMessage.length > MAX_MESSAGE_LENGTH * 0.8 ? 'text-orange-500' : ''}>
                  {Math.round((newMessage.length / MAX_MESSAGE_LENGTH) * 100)}%
                </div>
              </div>
              
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <textarea
                    value={newMessage}
                    onChange={handleMessageChange}
                    placeholder="Type your message here..."
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none transition pr-20"
                  />
                  <div className="absolute right-2 bottom-2">
                    <button
                      type="submit"
                      disabled={cooldownTime > 0 || newMessage.trim() === ''}
                      className={`px-4 py-2 rounded-lg font-medium ${
                        cooldownTime > 0 || newMessage.trim() === ''
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition shadow-md'
                      } text-white flex items-center space-x-1`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Info Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Database Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
            <h3 className="font-bold text-lg mb-3 text-gray-700 dark:text-gray-300 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              Database Status
            </h3>
            {databaseInfo ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={databaseInfo.status === 'connected' ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
                    {databaseInfo.status}
                  </span>
                </div>
                {databaseInfo.serverTimeOffset !== undefined && (
                  <div className="flex justify-between">
                    <span>Time Offset:</span>
                    <span>{databaseInfo.serverTimeOffset} ms</span>
                  </div>
                )}
                {databaseInfo.message && (
                  <div className="flex justify-between">
                    <span>Error:</span>
                    <span className="text-red-500 text-xs">{databaseInfo.message}</span>
                  </div>
                )}
                {databaseInfo.lastTest && (
                  <div className="flex justify-between">
                    <span>Last Test:</span>
                    <span>{databaseInfo.lastTest}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">Loading database info...</p>
            )}
          </div>

          {/* Debug Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
            <h3 className="font-bold text-lg mb-3 text-gray-700 dark:text-gray-300 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              Connection Info
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Connection:</span>
                <span className="capitalize">{connectionStatus}</span>
              </div>
              <div className="flex justify-between">
                <span>Messages:</span>
                <span>{messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Username:</span>
                <span className="truncate max-w-[120px]">{username || 'Not set'}</span>
              </div>
              <div className="flex justify-between">
                <span>Last Message:</span>
                <span>{lastMessageTime ? new Date(lastMessageTime).toLocaleTimeString() : 'Never'}</span>
              </div>
              {error && (
                <div className="flex justify-between">
                  <span>Error:</span>
                  <span className="text-red-500 truncate max-w-[150px]">{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-8 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
        <p>Realtime Chat App • Built with React & Firebase</p>
      </footer>
    </div>
  );
                              }
