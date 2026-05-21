import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageCircle, X, Send, User, Headset, 
  ChevronRight, Image as ImageIcon, 
  Mic, Smile, Phone, PhoneOff
} from 'lucide-react';
import { db } from '../services/firebase';
import { useAuth } from '../services/auth';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';

const SUPPORT_CATEGORIES = [
  { id: 'order_status', label: 'Statut de ma commande', icon: '📍' },
  { id: 'rider', label: 'Concernant le livreur', icon: '🛵' },
  { id: 'cancellation', label: 'Annulation de commande', icon: '🚫' },
  { id: 'payment', label: 'Question sur le paiement', icon: '💳' },
];

const EMOJIS = ['🤝', '😊', '👍', '🙏', '❤️', '🚚', '📦', '🍔', '🍕', ' Tunis 🇹🇳'];

const RINGTONE_URL = "https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3";

export default function ChatSupport() {
  const { user: currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [conversation, setConversation] = useState<any>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (conversation?.callState === 'calling') {
      if (!ringtoneRef.current) {
        ringtoneRef.current = new Audio(RINGTONE_URL);
        ringtoneRef.current.loop = true;
      }
      ringtoneRef.current.play().catch(e => console.log("Audio play failed:", e));
    } else {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    }
  }, [conversation?.callState]);

  useEffect(() => {
    if (!currentUser) {
      setMessages([]);
      setConversation(null);
      setConversationId(null);
      return;
    }

    const convId = currentUser.uid;
    setConversationId(convId);

    // Listen for conversation metadata (for calls and status)
    const unsubConv = onSnapshot(doc(db, 'conversations', convId), (docSnap) => {
      if (docSnap.exists()) {
        setConversation(docSnap.data());
      }
    }, (error) => {
      console.error("ChatSupport conversation metadata error:", error);
    });

    // Listen for messages
    const q = query(
      collection(db, 'conversations', convId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    }, (error) => {
      console.error("ChatSupport messages listener error:", error);
    });

    return () => {
      unsubConv();
      unsubMessages();
    };
  }, [currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const ensureConversation = async () => {
    if (!currentUser || !conversationId) return;
    const convRef = doc(db, 'conversations', conversationId);
    const docSnap = await getDoc(convRef);
    if (!docSnap.exists()) {
      await setDoc(convRef, {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Utilisateur',
        userEmail: currentUser.email || '',
        status: 'OPEN',
        callState: 'idle',
        updatedAt: serverTimestamp()
      });
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !currentUser || !conversationId) return;

    const text = inputText;
    setInputText("");
    await ensureConversation();

    try {
      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        text,
        type: 'text',
        sender: 'user',
        timestamp: serverTimestamp()
      });

      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: text,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        type: 'image',
        fileUrl: base64,
        sender: 'user',
        timestamp: serverTimestamp()
      });
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          if (conversationId) {
             await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
                type: 'audio',
                fileUrl: base64,
                sender: 'user',
                timestamp: serverTimestamp()
             });
          }
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Recording failed", err);
    }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setIsRecording(false);
  };

  const selectCategory = async (cat: string) => {
    if (!conversationId) return;
    await ensureConversation();
    await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
      text: `J'ai une question concernant: ${cat}`,
      type: 'text',
      sender: 'user',
      timestamp: serverTimestamp()
    });
    await requestHumanAgent();
  };

  const requestHumanAgent = async () => {
    if (!conversationId) return;
    await ensureConversation();
    await updateDoc(doc(db, 'conversations', conversationId), {
      status: 'WAITING_FOR_AGENT',
      updatedAt: serverTimestamp()
    });
    // System message
    await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
      text: "Un membre de notre équipe support a été notifié. Veuillez patienter un instant...",
      type: 'text',
      sender: 'system',
      timestamp: serverTimestamp()
    });
  };

  const respondCall = async (accept: boolean) => {
     if (!conversationId) return;
     await updateDoc(doc(db, 'conversations', conversationId), {
        callState: accept ? 'active' : 'idle',
        updatedAt: serverTimestamp()
     });
  };

  if (!currentUser) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 rounded-full bg-brand text-white shadow-xl flex items-center justify-center z-50 transition-transform active:scale-90",
          isOpen ? "scale-0" : "scale-100"
        )}
      >
        <MessageCircle size={28} />
      </button>

      <AnimatePresence>
        {/* Calling Overlay */}
        {conversation?.callState === 'calling' && (
           <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/90 z-[100] flex flex-col items-center justify-center text-white"
           >
              <div className="w-24 h-24 bg-brand rounded-full flex items-center justify-center animate-pulse mb-8">
                 <Headset size={48} />
              </div>
              <h2 className="text-2xl font-display font-black mb-2">Appel de FISA3 Support</h2>
              <p className="text-slate-400 mb-12">Un agent souhaite vous parler</p>
              <div className="flex gap-8">
                 <button 
                  onClick={() => respondCall(false)}
                  className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                 >
                    <PhoneOff size={28} />
                 </button>
                 <button 
                  onClick={() => respondCall(true)}
                  className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg animate-bounce active:scale-90 transition-transform"
                 >
                    <Phone size={28} />
                 </button>
              </div>
           </motion.div>
        )}

        {/* Active Call UI */}
        {conversation?.callState === 'active' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="fixed top-6 right-6 w-[320px] bg-slate-900 rounded-[32px] p-6 z-[100] border border-white/10 shadow-2xl"
          >
             <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                   <User size={24} className="text-brand" />
                </div>
                <div>
                   <h4 className="font-bold">Appel en cours...</h4>
                   <p className="text-[10px] text-brand uppercase font-black tracking-widest">Connecté</p>
                </div>
             </div>
             <div className="flex justify-center gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                   <Mic size={18} />
                </div>
                <button 
                  onClick={() => respondCall(false)}
                  className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center"
                >
                   <PhoneOff size={18} />
                </button>
             </div>
          </motion.div>
        )}

        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 w-[90vw] md:w-[400px] h-[600px] max-h-[80vh] bg-white rounded-[32px] shadow-2xl border border-slate-100 flex flex-col z-[60] overflow-hidden"
          >
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center">
                  <Headset size={24} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg leading-none">Support FISA3</h3>
                  <p className="text-[10px] uppercase tracking-widest text-brand font-black mt-1">Équipe support en ligne</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-4 scrollbar-hide bg-slate-50/50">
              {messages.length === 0 && (
                <div className="space-y-4 py-4">
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-6">
                    <h4 className="font-bold text-slate-800 mb-2">Bonjour ! 👋</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">Notre équipe support est là pour vous aider avec vos commandes, les livreurs ou toute autre question.</p>
                  </div>
                  
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">Sujets fréquents</p>
                  <div className="grid grid-cols-1 gap-2">
                    {SUPPORT_CATEGORIES.map(cat => (
                      <button 
                        key={cat.id} 
                        onClick={() => selectCategory(cat.label)}
                        className="flex items-center gap-3 p-4 bg-white border border-slate-100 hover:border-brand/30 hover:bg-brand/5 rounded-2xl text-sm font-semibold transition-all group shadow-sm"
                      >
                        <span className="text-xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                        <span className="flex-grow text-left text-slate-700">{cat.label}</span>
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-brand" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={msg.id || idx} className={cn("flex flex-col max-w-[85%]", msg.sender === 'user' ? "self-end items-end" : "self-start items-start")}>
                  {msg.type === 'text' && (
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-sm shadow-sm", 
                      msg.sender === 'user' 
                        ? "bg-brand text-white rounded-tr-none" 
                        : msg.sender === 'system'
                          ? "bg-slate-200 text-slate-600 italic text-[11px] self-center items-center rounded-lg"
                          : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
                    )}>
                      {msg.text}
                    </div>
                  )}
                  {msg.type === 'image' && (
                     <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-md transform hover:scale-105 transition-transform cursor-pointer">
                        <img src={msg.fileUrl} alt="Message image" className="max-w-full h-auto max-h-48 object-cover" />
                     </div>
                  )}
                  {msg.type === 'audio' && (
                     <div className={cn("px-4 py-3 rounded-2xl flex items-center gap-2 shadow-sm border", msg.sender === 'user' ? "bg-brand text-white border-brand" : "bg-white text-slate-800 border-slate-100")}>
                        <Mic size={14} className={msg.sender === 'user' ? "text-white" : "text-brand"} />
                        <audio src={msg.fileUrl} controls className="w-32 h-8" />
                     </div>
                  )}
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1.5 px-1">
                    {msg.sender === 'user' ? 'Vous' : msg.sender === 'system' ? 'Système' : 'Support FISA3'}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-slate-100">
               <div className="relative">
                  {showEmojis && (
                    <div className="absolute bottom-full left-0 mb-2 bg-white shadow-2xl border border-slate-100 rounded-2xl p-3 flex flex-wrap gap-2 z-10 max-w-[200px]">
                       {EMOJIS.map(e => (
                         <button 
                          key={e} 
                          onClick={() => { setInputText(prev => prev + e); setShowEmojis(false); }} 
                          className="p-1.5 hover:bg-slate-50 rounded-lg text-lg hover:scale-110 transition-transform"
                         >
                           {e}
                         </button>
                       ))}
                    </div>
                  )}
               </div>

               <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                 <input type="file" ref={fileInputRef} onChange={handleImageUpload} hidden accept="image/*" />
                 <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()} 
                  className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-brand hover:bg-brand/5 rounded-xl transition-all"
                 >
                    <ImageIcon size={20} />
                 </button>
                 <div className="flex-grow flex items-center bg-slate-50 rounded-2xl px-3 group focus-within:ring-2 focus-within:ring-brand/20 transition-all">
                   <button type="button" onClick={() => setShowEmojis(!showEmojis)} className="text-slate-400 hover:text-yellow-500 transition-colors"><Smile size={18} /></button>
                   <input 
                    value={inputText} 
                    onChange={(e) => setInputText(e.target.value)} 
                    placeholder="Tapez votre message..." 
                    className="flex-grow bg-transparent border-none py-3 px-2 text-sm outline-none text-slate-700" 
                   />
                 </div>
                 {isRecording ? (
                   <button type="button" onClick={stopRecording} className="w-11 h-11 bg-red-500 text-white rounded-2xl flex items-center justify-center animate-pulse shadow-lg shadow-red-500/20"><X size={18} /></button>
                 ) : inputText.trim() ? (
                   <button type="submit" className="w-11 h-11 bg-brand text-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand/20 hover:bg-brand/90 hover:-translate-y-0.5 transition-all active:scale-95"><Send size={18} /></button>
                 ) : (
                   <button type="button" onClick={startRecording} className="w-11 h-11 bg-slate-100 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-2xl flex items-center justify-center transition-all"><Mic size={18} /></button>
                 )}
               </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
