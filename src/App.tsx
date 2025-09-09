import React, { useState, useEffect, useRef } from 'react';
import type { DefaultEventsMap, Socket } from 'socket.io';
import { io } from "socket.io-client";
import CryptoJS from 'crypto-js';

function getUniqueCommutativeHashSync(A:string, B:string) {
  const canonicalString = [A, B].sort().join('\u0001');
  const hash = CryptoJS.SHA256(canonicalString);
  const hashStr = hash.toString(CryptoJS.enc.Hex);
  console.error(hashStr);
  return hashStr;
}


const BASE_URL = "http://localhost:1337";
const App = () => {
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [user, setUser] = useState<{ username: string }>(null);
  const [showAuthModal, setShowAuthModal] = useState(true);
  const [targetUser, setTargetUser] = useState('');
  const [allUsers, setAllUsers] = useState<{ username: string }[]>([]);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const [socket, setSocket] = useState<Socket<DefaultEventsMap, DefaultEventsMap>>(null); // Store socket instance

  
  useEffect(() => {
    const fetcher = async () => {
      const data = await fetch('http://localhost:1337/api/users', {
        method: 'GET',
      }).then(res => res.json());
      setAllUsers(data);
    }
    fetcher();
  }, []);

  useEffect(() => {
    let ioInstance;
    console.error(targetUser, user)
    const initialSocket = () => {
      ioInstance = io(BASE_URL);
      socketRef.current = ioInstance;
      setSocket(ioInstance);

      ioInstance.emit("join", {
        username: user.username,
        target: targetUser,
      }, async (val) => {
        try {
          const res = await fetch(`${BASE_URL}/api/messages/get-chat-user/${user.username}/${targetUser}`);
          const response = await res.json();
          console.error(response)
          setMessages([...response]);
        } catch (err) {
          console.error("Error fetching messages:", err.message);
        }
      });

      console.error(getUniqueCommutativeHashSync(user.username, targetUser))
      ioInstance.on(getUniqueCommutativeHashSync(user.username, targetUser), async (data) => {
        console.error(data)
        const newMessage = {
          user: data.user,
          message: data.message,
          targetUser: targetUser,
        };
        setMessages((prev) => [...prev, newMessage]);
      });

      ioInstance.on("message", async (data) => {
        console.error(data)
        const newMessage = {
          user: data.user,
          message: data.message,
          targetUser: user.username,
        };
        setMessages((prev) => [...prev, newMessage]);
      });

    }
    if (user && targetUser)
      initialSocket();
    return () => {
      if (ioInstance)
        ioInstance.disconnect();
      socketRef.current = null;
    };
  }, [user, targetUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    console.error(socketRef.current.emit, socketRef.current, messageText)
    if (!messageText.trim()) return;
    if (!socketRef.current) return;

    socketRef.current.emit('sendMessage', {
      target: targetUser,
      user: user.username,
      message: messageText
    }, (err) => {
      console.error(err)
    })

    const userMessage = {
      id: Date.now(),
      message: messageText,
      user: user.username,
      timestamp: new Date(),
      targetUser: targetUser,
    };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setMessageText('');
  };


  const handleLogin = async (e) => {
    e.preventDefault();
    if (userEmail.trim()) {
      const form = new FormData();
      form.append('email', userEmail);
      const result = await fetch('http://localhost:1337/api/user/login-user/', {
        method: 'post',
        body: form
      }).then(res => res.json());
      setUser(result);
      setShowAuthModal(false);
    }
  };

console.error(messages)

  return (
    <div className="bg-gray-100 min-h-screen flex items-center justify-center font-sans p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col h-[90vh]">
        
        <header className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-circle-code">
              <path d="M7.9 20A16.9 16.9 0 0 1 5 17c-2.7-2.7-2.7-7.2 0-9.9S10.3 4.4 13 7c2.7 2.7 2.7 7.2 0 9.9-1.9 1.8-4.3 2.6-6 3.1Z"/><path d="m15.5 8.5-2 3 2 3"/><path d="M21 15c-1.5 1.9-3.9 2.6-6 3.1"/><path d="M12.9 21.1c1.9-.3 3.3-1.4 4.1-2.2"/><path d="m20.5 7.5-2-3 2-3"/>
            </svg>
            <h1 className="text-xl font-bold">Simple Chat App</h1>
            <select
              onChange={(e) => setTargetUser(e.target.value)}
            >
              <option>{' '}</option>
              {allUsers.map(item => {
                if (user && item.username == user?.username) return <></>
                return <option key={item.username} className='text-black' value={item.username}>{item.username}</option>
              })}
            </select>
          </div>
          {user?.username}
        </header>

        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length > 0 ? (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.user === user.username ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-3 rounded-lg max-w-xs md:max-w-md lg:max-w-lg shadow-sm ${
                  msg.user === user.username
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-gray-200 text-gray-800 rounded-bl-none'
                }`}>
                  <p className="font-semibold text-xs opacity-70 mb-1">
                    {msg.user}
                  <p>{msg.message}</p>
                  </p>
                </div>  
              </div>
            ))
          ) : (
            <div className="flex justify-center items-center h-full text-gray-500">
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </main>

        {/* Message Input Form */}
        <footer className="p-4 bg-gray-100 rounded-b-lg border-t border-gray-200">
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 p-3 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              disabled={showAuthModal}
            />
            <button
              type="submit"
              className="bg-blue-500 text-white p-3 rounded-full hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={showAuthModal}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-send">
                <path d="m22 2-7 20-4-9-9-4 20-7Z"/>
                <path d="M22 2 11 13"/>
              </svg>
            </button>
          </form>
        </footer>
      </div>

      {showAuthModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-center">Join the Chat</h2>
            <form onSubmit={handleLogin} className="flex flex-col space-y-4">
              <input
                type="email"
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="Enter your email"
                // defaultValue={'wtf@gmail.com'}
                className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="submit"
                className="bg-blue-500 text-white p-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
              >
                Start Chatting
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
