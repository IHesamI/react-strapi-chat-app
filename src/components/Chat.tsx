import React, { useState, useEffect, useRef } from 'react';
import type { DefaultEventsMap, Socket } from 'socket.io';
import { io } from "socket.io-client";
import CryptoJS from 'crypto-js';
import { useAuth } from '../context/UserContext';

function getUniqueCommutativeHashSync(A:string, B:string) {
  const canonicalString = [A, B].sort().join('\u0001');
  const hash = CryptoJS.SHA256(canonicalString);
  const hashStr = hash.toString(CryptoJS.enc.Hex);
  return hashStr;
}

const BASE_URL = "http://localhost:1337";

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const { user, logout } = useAuth();
  const [targetUser, setTargetUser] = useState('');
  const [allUsers, setAllUsers] = useState<{ username: string }[]>([]);
  const messagesEndRef = useRef(null);
  const socketRef = useRef<Socket<DefaultEventsMap, DefaultEventsMap> | null>(null);

  useEffect(() => {
    const fetcher = async () => {
      const token = localStorage.getItem('jwt');
      const data = await fetch('http://localhost:1337/api/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).then(res => res.json());
      setAllUsers(data);
    }
    if (user) {
      fetcher();
    }
  }, [user]);

  useEffect(() => {
    let ioInstance: Socket<DefaultEventsMap, DefaultEventsMap>;
    if (user && targetUser) {
      const token = localStorage.getItem('jwt');
      ioInstance = io(BASE_URL, {
        auth: {
          token: `Bearer ${token}`
        }
      });
      socketRef.current = ioInstance;

      ioInstance.emit("join", {
        username: user.username,
        target: targetUser,
      }, async () => {
        try {
          const res = await fetch(`${BASE_URL}/api/messages/get-chat-user/${user.username}/${targetUser}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const response = await res.json();
          setMessages([...response]);
        } catch (err) {
          console.error("Error fetching messages:", err.message);
        }
      });

      ioInstance.on(getUniqueCommutativeHashSync(user.username, targetUser), async (data) => {
        const newMessage = {
          user: data.user,
          message: data.message,
          targetUser: targetUser,
        };
        setMessages((prev) => [...prev, newMessage]);
      });

      ioInstance.on("message", async (data) => {
        const newMessage = {
          user: data.user,
          message: data.message,
          targetUser: user.username,
        };
        setMessages((prev) => [...prev, newMessage]);
      });
    }
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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !socketRef.current) return;

    socketRef.current.emit('sendMessage', {
      target: targetUser,
      user: user.username,
      message: messageText
    });

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

  const handleLogout = () => {
    logout();
  };

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
              className="text-black"
            >
              <option value="">Select a user to chat with</option>
              {allUsers.map(item => {
                if (user && item.username === user?.username) return null;
                return <option key={item.username} value={item.username}>{item.username}</option>
              })}
            </select>
          </div>
          <div>
            {user?.username}
            <button onClick={handleLogout} className="ml-4 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length > 0 ? (
            messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.user === user?.username ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-3 rounded-lg max-w-xs md:max-w-md lg:max-w-lg shadow-sm ${
                  msg.user === user?.username
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-gray-200 text-gray-800 rounded-bl-none'
                }`}>
                  <p className="font-semibold text-xs opacity-70 mb-1">
                    {msg.user}
                  </p>
                  <p>{msg.message}</p>
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

        <footer className="p-4 bg-gray-100 rounded-b-lg border-t border-gray-200">
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 p-3 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              disabled={!user || !targetUser}
            />
            <button
              type="submit"
              className="bg-blue-500 text-white p-3 rounded-full hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!user || !targetUser}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-send">
                <path d="m22 2-7 20-4-9-9-4 20-7Z"/>
                <path d="M22 2 11 13"/>
              </svg>
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
};

export default Chat;
