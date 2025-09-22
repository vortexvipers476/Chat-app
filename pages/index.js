
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
    <div className="max-w-3xl mx-auto font-sans px-4 py-6">
      {}
      <CustomAlert
        type={alert.type}
        message={alert.message}
        onClose={() => setAlert({ type: '', message: '' })}
      />

      {}
      <ConfirmModal />

      {}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg shadow-lg overflow-hidden mb-6">
        <div className="p-5 flex justify-between items-center">
          <h1 className="text-3xl font-extrabold tracking-wide">Realtime Chat</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-4 h-4 rounded-full ${connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
              <span className="text-sm font-medium capitalize">{connectionStatus}</span>
            </div>
            <button
              onClick={testConnection}
              className="px-4 py-2 bg-blue-500 rounded-md shadow hover:bg-blue-600 transition"
            >
              Test Connection
            </button>
            <button
              onClick={clearMessages}
              className="px-4 py-2 bg-red-500 rounded-md shadow hover:bg-red-600 transition"
            >
              Clear Messages
            </button>
          </div>
        </div>
      </div>

      {}
      <div className="mb-4">
        <label className="block mb-1 text-gray-700 dark:text-gray-300 font-semibold">Username:</label>
        <input
          type="text"
          value={username}
          onChange={handleUsernameChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          placeholder="Enter your username"
        />
      </div>

      {}
      <div className="h-96 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 rounded-lg shadow-inner mb-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8 select-none">
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
                  className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg shadow ${
                    message.username === username
                      ? 'bg-indigo-500 text-white rounded-br-none'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-bl-none'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    {message.username !== username && (
                      <div className="font-semibold text-sm">{message.username}</div>
                    )}
                    <div
                      className={`text-xs ${
                        message.username === username
                          ? 'text-indigo-200'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{message.text}</div>
                  <div className="mt-2 flex justify-end space-x-2">
                    {message.username !== username && (
                      <button
                        onClick={() => reportVirtex(message.id, message.username)}
                        className="text-xs text-red-500 hover:text-red-700 transition"
                      >
                        Report
                      </button>
                    )}
                    {message.username === username && (
                      <button
                        onClick={() => deleteMessage(message.id)}
                        className="text-xs text-gray-500 hover:text-gray-700 transition"
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

      {}
      <form onSubmit={handleSendMessage} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="mb-2 flex justify-between text-sm text-gray-500 dark:text-gray-400">
          <div>
            Characters: {newMessage.length}/{MAX_MESSAGE_LENGTH}
          </div>
          {cooldownTime > 0 && (
            <div className="text-orange-500 font-semibold">
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
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none transition"
          />
          <button
            type="submit"
            disabled={cooldownTime > 0 || newMessage.trim() === ''}
            className={`px-4 py-2 rounded-r-lg ${
              cooldownTime > 0 || newMessage.trim() === ''
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition'
            } text-white`}
          >
            Send
          </button>
        </div>
      </form>

      {}
      <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm shadow-inner">
        <h3 className="font-bold mb-2">Database Info</h3>
        {databaseInfo ? (
          <div>
            <p>
              Status:{' '}
              <span className={databaseInfo.status === 'connected' ? 'text-green-500' : 'text-red-500'}>
                {databaseInfo.status}
              </span>
            </p>
            {databaseInfo.serverTimeOffset !== undefined && (
              <p>Server Time Offset: {databaseInfo.serverTimeOffset} ms</p>
            )}
            {databaseInfo.message && <p>Error: {databaseInfo.message}</p>}
            {databaseInfo.lastTest && <p>Last Test: {databaseInfo.lastTest}</p>}
          </div>
        ) : (
          <p>Loading database info...</p>
        )}
      </div>

      {}
      <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm shadow-inner">
        <h3 className="font-bold mb-2">Debug Info:</h3>
        <p>Connection Status: {connectionStatus}</p>
        <p>Messages Count: {messages.length}</p>
        <p>Username: {username}</p>
        <p>Is Client: {isClient ? 'Yes' : 'No'}</p>
        <p>Last Message Time: {lastMessageTime ? new Date(lastMessageTime).toLocaleTimeString() : 'Never'}</p>
        <p>Cooldown Time: {cooldownTime}s</p>
        {error && <p className="text-red-500">Error: {error}</p>}
      </div>
    </div>
  );
              }
                  
