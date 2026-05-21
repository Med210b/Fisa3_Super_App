import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, User, Headset, ChevronRight, 
  Search, Clock, MessageSquare, CheckCircle2,
  Image as ImageIcon, Mic, Phone, PhoneOff
} from 'lucide-react';
import { db } from '../services/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useAuth } from '../services/auth';

export default function AdminSupport() {
  const { user, isAdmin } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Setup ringtone
    ringtoneRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3');
    ringtoneRef.current.loop = true;
    
    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current = null;
      }
    };
  }, []);

  const selectedConv = conversations.find(c => c.id === selectedConvId);

  useEffect(() => {
    if (!user || !isAdmin) return;
    const q = query(collection(db, 'conversations'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setConversations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Conversations listener failed:", error);
    });
    return () => unsubscribe();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!selectedConvId || !user || !isAdmin) return;
    const q = query(
      collection(db, 'conversations', selectedConvId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Messages listener failed:", error);
    });
    return () => unsubscribe();
  }, [selectedConvId, user, isAdmin]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedConv?.callState === 'calling') {
      ringtoneRef.current?.play().catch(e => console.log("Audio play blocked", e));
    } else {
      ringtoneRef.current?.pause();
      if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
    }
  }, [selectedConv?.callState]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !selectedConvId) return;

    const text = inputText;
    setInputText("");

    try {
      await addDoc(collection(db, 'conversations', selectedConvId, 'messages'), {
        text,
        type: 'text',
        sender: 'admin',
        timestamp: serverTimestamp()
      });

      await updateDoc(doc(db, 'conversations', selectedConvId), {
        lastMessage: text,
        status: 'OPEN',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConvId) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      await addDoc(collection(db, 'conversations', selectedConvId, 'messages'), {
        type: 'image',
        fileUrl: base64,
        sender: 'admin',
        timestamp: serverTimestamp()
      });
    };
    reader.readAsDataURL(file);
  };

  const closeConversation = async (convId: string) => {
    try {
      await updateDoc(doc(db, 'conversations', convId), {
        status: 'CLOSED',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error closing conversation:", error);
    }
  };

  const initiateCall = async () => {
    if (!selectedConvId) return;
    await updateDoc(doc(db, 'conversations', selectedConvId), {
      callState: 'calling',
      updatedAt: serverTimestamp()
    });
  };

  const endCall = async () => {
    if (!selectedConvId) return;
    await updateDoc(doc(db, 'conversations', selectedConvId), {
      callState: 'idle',
      updatedAt: serverTimestamp()
    });
  };


  return (
    <div className="flex h-[750px] bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden relative">
      {/* conversations List Sidebar */}
      <div className="w-80 border-r border-slate-50 dark:border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800">
          <h3 className="text-lg font-display font-black text-slate-900 dark:text-white">Support FISA3</h3>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input placeholder="Filtrer..." className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-9 pr-4 py-2 text-xs outline-none" />
          </div>
        </div>
        <div className="flex-grow overflow-y-auto scrollbar-hide">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConvId(conv.id)}
              className={cn(
                "w-full p-4 flex gap-3 text-left border-b border-slate-50 dark:border-slate-800 transition-colors",
                selectedConvId === conv.id ? "bg-brand/5 dark:bg-brand/10 border-l-4 border-l-brand" : "hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <User size={18} className="text-slate-400" />
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">{conv.userName}</h4>
                  {conv.status === 'WAITING_FOR_AGENT' && <span className="w-2 h-2 bg-brand rounded-full animate-ping" />}
                </div>
                <p className="text-[10px] text-slate-500 truncate">{conv.lastMessage || 'Nouvelle demande'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {(selectedConv?.callState === 'active' || selectedConv?.callState === 'calling') && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center text-white">
             <div className="w-32 h-32 bg-brand rounded-full flex items-center justify-center animate-pulse mb-8 relative">
                <Headset size={64} />
                <div className={cn(
                  "absolute -bottom-2 right-0 w-8 h-8 rounded-full border-4 border-slate-900 flex items-center justify-center",
                  selectedConv.callState === 'active' ? "bg-green-500" : "bg-amber-500"
                )}>
                   <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
                </div>
             </div>
             <h2 className="text-3xl font-display font-black mb-2">{selectedConv.userName}</h2>
             <p className="text-brand font-black uppercase tracking-[0.2em] mb-12">
               {selectedConv.callState === 'active' ? 'Appel en cours...' : 'Appel vers le client...'}
             </p>
             <div className="flex gap-10">
                <button className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20"><Mic size={28} /></button>
                <button onClick={endCall} className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"><PhoneOff size={32} /></button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <div className="flex-grow flex flex-col bg-slate-50/50 dark:bg-slate-950/20">
        {selectedConvId ? (
          <>
            <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><User size={20} className="text-slate-400" /></div>
                <div>
                  <h3 className="font-display font-black text-slate-900 dark:text-white leading-none">{selectedConv?.userName}</h3>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">{selectedConv?.userEmail}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => initiateCall()} 
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                >
                  <Phone size={14} />
                  Appeler
                </button>
                <button 
                  onClick={() => closeConversation(selectedConvId)} 
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-[10px] font-black rounded-xl text-slate-600 dark:text-slate-400 uppercase tracking-widest hover:bg-slate-200"
                >
                  <CheckCircle2 size={14} /> 
                  Fermer
                </button>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto p-8 flex flex-col gap-6 scrollbar-hide">
              {messages.map((msg, idx) => (
                <div key={msg.id || idx} className={cn("flex flex-col max-w-[70%]", msg.sender === 'admin' ? "self-end items-end" : "self-start items-start")}>
                  {msg.type === 'text' && (
                    <div className={cn("px-5 py-3 rounded-2xl text-sm shadow-sm", msg.sender === 'admin' ? "bg-slate-900 text-white rounded-tr-none" : "bg-white text-slate-800 rounded-tl-none border border-slate-100")}>
                      {msg.text}
                    </div>
                  )}
                  {msg.type === 'image' && (
                    <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm max-w-[300px]">
                      <img src={msg.fileUrl} alt="Received image" className="w-full h-auto" />
                    </div>
                  )}
                  {msg.type === 'audio' && (
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center"><Mic size={14} /></div>
                       <audio src={msg.fileUrl} controls className="w-48 h-10" />
                    </div>
                  )}
                  <span className="text-[9px] font-black text-slate-400 uppercase mt-2">{msg.sender === 'admin' ? 'Agent (Moi)' : 'Utilisateur'}</span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-50 dark:border-slate-800">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} hidden accept="image/*" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-brand transition-all"><ImageIcon size={20} /></button>
                <input value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Message..." className="flex-grow bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 text-sm outline-none" />
                <button type="submit" className="w-14 h-14 bg-brand text-white rounded-2xl flex items-center justify-center shadow-xl shadow-brand/20 active:scale-95"><Send size={20} /></button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center text-slate-400">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <p className="text-sm font-medium">Sélectionnez un client pour démarrer le support</p>
          </div>
        )}
      </div>
    </div>
  );
}
