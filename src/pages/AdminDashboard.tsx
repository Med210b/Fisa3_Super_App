import { useState, useEffect, useMemo, FormEvent } from 'react';
import { 
  Users, ShoppingCart, TrendingUp, Store, 
  Map as MapIcon, Plus, MoreVertical, 
  Search, Filter, ChevronRight, Bell, 
  Settings, LogOut, CheckCircle2, Clock, 
  X, Trash2, Edit3, Bike, Package,
  Smartphone, ShieldCheck, MapPin, Navigation,
  ChevronLeft, Trash, Headset, Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BRAND, CATEGORIES, MOCK_STORES } from '../constants';
import { cn } from '../lib/utils';
import { auth, db } from '../services/firebase';
import { useAuth } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import AdminSupport from '../components/AdminSupport';
import { 
  collection, query, onSnapshot, 
  doc, updateDoc, setDoc, 
  orderBy, limit, Timestamp,
  deleteDoc, getDocs, addDoc
} from 'firebase/firestore';

// Fix leaflet icons
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const createRiderIcon = (rider: any) => {
  const status = rider.status || 'OFFLINE';
  const colors = {
    IDLE: { core: 'bg-emerald-500', pulse: 'bg-emerald-500/20', border: 'border-emerald-500' },
    BUSY: { core: 'bg-brand', pulse: 'bg-brand/20', border: 'border-brand' },
    OFFLINE: { core: 'bg-slate-400', pulse: 'bg-slate-400/10', border: 'border-slate-400' },
  };
  
  const color = colors[status as keyof typeof colors] || colors.OFFLINE;
  const isPulsing = status === 'BUSY' || status === 'IDLE';
  const initial = rider.name ? rider.name.charAt(0).toUpperCase() : '?';

  return L.divIcon({
    className: 'custom-rider-icon',
    html: `<div class="relative flex flex-col items-center group">
            <div class="absolute -top-10 px-2 py-1 bg-slate-900/80 backdrop-blur-md rounded-lg text-[10px] whitespace-nowrap font-black text-white border border-white/10 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-[100]">
              ${rider.name}
            </div>
            <div class="relative">
              ${isPulsing ? `<div class="absolute inset-0 ${color.pulse} rounded-full scale-[2.5] animate-ping"></div>` : ''}
              <div class="relative w-12 h-12 bg-white rounded-full shadow-2xl flex flex-col items-center justify-center p-1 border-2 ${color.border} z-10">
                 <span class="text-sm font-black text-slate-900">${initial}</span>
                 <span class="text-[10px]">${status === 'OFFLINE' ? '💤' : '🛵'}</span>
              </div>
              <div class="absolute -top-1 -right-1 w-4 h-4 ${color.core} border-2 border-white rounded-full z-20 shadow-sm"></div>
            </div>
          </div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
};

const orderIcon = L.divIcon({
  className: 'custom-order-icon',
  html: `<div class="relative group">
          <div class="absolute inset-0 bg-slate-900/20 rounded-lg scale-[2] animate-pulse"></div>
          <div class="relative w-10 h-10 bg-slate-900 rounded-xl border-2 border-white shadow-xl flex items-center justify-center text-white transition-transform group-hover:scale-110">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </div>
        </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    isAdmin?: boolean;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, auth: any, isAdmin: boolean) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      isAdmin, // Track client-side admin status
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error Details:', errInfo);
}

const INITIAL_RIDERS = [
  { id: 'R1', name: 'Ahmed K.', status: 'IDLE', location: { lat: 36.8450, lng: 10.2700 } },
  { id: 'R2', name: 'Sami B.', status: 'IDLE', location: { lat: 36.8500, lng: 10.2800 } },
  { id: 'R3', name: 'Yassine M.', status: 'BUSY', location: { lat: 36.8350, lng: 10.2600 } },
  { id: 'R4', name: 'Mehdi S.', status: 'OFFLINE', location: { lat: 36.8400, lng: 10.2750 } },
];

function MapEvents({ riders }: { riders: any[] }) {
  const map = useMap();
  useEffect(() => {
    if (riders.length > 0) {
      const bounds = L.latLngBounds(riders.map(r => [r.location.lat, r.location.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [riders, map]);
  return null;
}

export default function AdminDashboard() {
  const { user, isAdmin, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'riders' | 'stores' | 'support'>('overview');
  const [orders, setOrders] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>(INITIAL_RIDERS);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [showSendNotificationModal, setShowSendNotificationModal] = useState(false);
  const [notifEmail, setNotifEmail] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [isSendingNotif, setIsSendingNotif] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifSuccess, setNotifSuccess] = useState(false);

  const ORDER_STATUSES = [
    'PENDING', 
    'ACCEPTED_BY_STORE', 
    'PREPARING', 
    'READY_FOR_PICKUP', 
    'ASSIGNED', 
    'PICKED_UP', 
    'ON_THE_WAY', 
    'DELIVERED', 
    'CANCELLED'
  ];

  // Auth Guard
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/auth');
    }
  }, [user, isAdmin, authLoading, navigate]);

  // Subscribe to real orders
  useEffect(() => {
    if (!user || !isAdmin) return;
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const newOrder = change.doc.data();
          if (newOrder.status === 'PENDING') {
            setNotifications(prev => [{
               id: change.doc.id,
               title: 'Nouvelle Commande',
               message: `Commande #${change.doc.id.slice(-6)} de ${newOrder.customerName}`,
               time: 'À l\'instant'
            }, ...prev]);
            
            // Notification sound
            try {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
              audio.volume = 0.2;
              audio.play();
            } catch (e) {}
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders', auth, isAdmin);
    });
    return () => unsubscribe();
  }, [user, isAdmin]);

  // Subscribe to Waiting Support Conversations
  useEffect(() => {
    if (!user || !isAdmin) return;
    const q = query(collection(db, 'conversations'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const conv = change.doc.data();
          if (conv.status === 'WAITING_FOR_AGENT') {
            setNotifications(prev => [{
               id: change.doc.id,
               title: 'Support Urgent',
               message: `${conv.userName} demande un agent humain`,
               time: 'À l\'instant'
            }, ...prev]);
            
            try {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
              audio.volume = 0.3;
              audio.play();
            } catch (e) {}
          }
        }
      });
    }, (error) => {
      console.error("Support sub failed", error);
    });
    return () => unsubscribe();
  }, [user, isAdmin]);

  // Subscribe to live riders from Firestore
  useEffect(() => {
    if (!user || !isAdmin) return;
    const q = collection(db, 'riders');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ridersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (ridersData.length === 0) {
        // Seed initial riders if none exist
        INITIAL_RIDERS.forEach(async (rider) => {
          await setDoc(doc(db, 'riders', rider.id), {
            ...rider,
            updatedAt: Timestamp.now()
          });
        });
      } else {
        setRiders(ridersData);
      }
    }, (error) => {
      console.error("Riders sub failed", error);
    });
    return () => unsubscribe();
  }, [user, isAdmin]);

  // Simulation logic for active deliveries (Rider movement)
  // This simulation now updates the global Firestore 'riders' collection
  useEffect(() => {
    const interval = setInterval(async () => {
      const activeOrders = orders.filter(o => o.status === 'ON_THE_WAY');
      for (const order of activeOrders) {
        const trackingPath = `orders/${order.id}/tracking/current`;
        const currentTrackingRef = doc(db, trackingPath);
        const riderId = order.riderId || 'R1';
        const rider = riders.find(r => r.id === riderId);
        
        if (!rider) continue;
        
        const dest = order.deliveryLocation || { lat: 36.8580, lng: 10.3100 };
        
        // Movement calculation
        const latDelta = (dest.lat - rider.location.lat) * 0.05;
        const lngDelta = (dest.lng - rider.location.lng) * 0.05;
        
        const newLat = rider.location.lat + latDelta;
        const newLng = rider.location.lng + lngDelta;
        
        try {
          // Update Order Tracking (for client)
          await setDoc(currentTrackingRef, {
            location: { lat: newLat, lng: newLng },
            riderName: rider.name,
            eta: '5 mins',
            updatedAt: Timestamp.now()
          }, { merge: true });

          // Update Rider Global Pos (for dashboard live view)
          await updateDoc(doc(db, 'riders', riderId), {
            location: { lat: newLat, lng: newLng },
            updatedAt: Timestamp.now(),
            status: 'BUSY',
            currentOrderId: order.id
          });
          
          // If very close, mark as delivered
          if (Math.abs(latDelta) < 0.0001 && Math.abs(lngDelta) < 0.0001) {
             await updateDoc(doc(db, `orders/${order.id}`), {
               status: 'DELIVERED',
               updatedAt: Timestamp.now()
             });
             
             // Free up rider globally
             await updateDoc(doc(db, 'riders', riderId), {
               status: 'IDLE',
               currentOrderId: null,
               updatedAt: Timestamp.now()
             });
          }
        } catch (error) {
          console.error("Simulation update failed", error);
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [orders, riders]);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    const path = `orders/${orderId}`;
    const orderRef = doc(db, path);
    try {
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path, auth, isAdmin);
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    const path = `orders/${orderId}`;
    const orderRef = doc(db, path);
    try {
      await updateDoc(orderRef, {
        status: 'PREPARING',
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path, auth, isAdmin);
    }
  };

  const handleAssignRider = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status !== 'READY_FOR_PICKUP') {
      alert("La commande doit être prête pour livraison avant l'assignation.");
      return;
    }
    const rider = riders.find(r => r.status === 'IDLE') || riders[0];
    const path = `orders/${orderId}`;
    const orderRef = doc(db, path);
    
    try {
      await updateDoc(orderRef, {
        status: 'ASSIGNED',
        riderId: rider.id,
        riderName: rider.name,
        updatedAt: Timestamp.now()
      });
      
      // Update global rider status in Firestore
      await updateDoc(doc(db, 'riders', rider.id), {
        status: 'BUSY',
        currentOrderId: orderId,
        updatedAt: Timestamp.now()
      });

      // Send notification to rider
      await addDoc(collection(db, `riders/${rider.id}/notifications`), {
        title: 'Nouvelle Livraison',
        message: `Vous avez été assigné à la commande #${orderId.slice(-6).toUpperCase()}`,
        orderId: orderId,
        type: 'NEW_ORDER',
        createdAt: Timestamp.now(),
        read: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path, auth, isAdmin);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (confirm('Supprimer cette commande ?')) {
      const path = `orders/${id}`;
       try {
         await deleteDoc(doc(db, path));
       } catch (error) {
         handleFirestoreError(error, OperationType.DELETE, path, auth, isAdmin);
       }
    }
  };

  const handleSendTargetedNotification = async (e: FormEvent) => {
    e.preventDefault();
    setIsSendingNotif(true);
    setNotifError(null);
    setNotifSuccess(false);

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('email'), limit(100)); // We'll filter client side for simplicity if no specific index, or rely on email search
      const querySnapshot = await getDocs(query(usersRef, orderBy('email')));
      
      const targetUserDoc = querySnapshot.docs.find(doc => doc.data().email?.toLowerCase() === notifEmail.toLowerCase());

      if (!targetUserDoc) {
        throw new Error("Utilisateur non trouvé avec cet email.");
      }

      const targetUserId = targetUserDoc.data().uid || targetUserDoc.id;

      await addDoc(collection(db, `users/${targetUserId}/notifications`), {
        title: notifTitle,
        message: notifMessage,
        type: 'ADMIN_CUSTOM',
        createdAt: Timestamp.now(),
        read: false
      });

      setNotifSuccess(true);
      setNotifEmail('');
      setNotifTitle('');
      setNotifMessage('');
      setTimeout(() => setShowSendNotificationModal(false), 2000);
    } catch (err: any) {
      setNotifError(err.message || "Échec de l'envoi de la notification.");
    } finally {
      setIsSendingNotif(false);
    }
  };

  if (authLoading || !user) {
    return <div className="h-screen flex items-center justify-center bg-slate-50">Chargement...</div>;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 overflow-hidden font-sans">
      {/* Sidebar - Made it dynamic for mobile */}
      <aside className="fixed bottom-0 md:relative md:h-screen w-full md:w-20 lg:w-64 bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-row md:flex-col z-[100] transition-all">
        <div className="hidden md:flex p-6 md:p-4 lg:p-6 items-center justify-center lg:justify-start gap-4">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center text-white shadow-xl shadow-brand/20 shrink-0">
            <Bike size={24} />
          </div>
          <span className="hidden lg:block font-display font-black text-xl tracking-tight text-slate-900 dark:text-white">SUPER ADMIN</span>
        </div>

        <nav className="flex-1 flex md:flex-col items-center justify-around md:justify-start md:mt-10 px-2 md:px-4 space-y-0 md:space-y-2 w-full">
          {(['overview', 'orders', 'riders', 'stores', 'support'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 md:w-full flex flex-col md:flex-row items-center justify-center lg:justify-start gap-1 md:gap-3 p-2 md:p-4 rounded-xl md:rounded-2xl transition-all duration-300",
                activeTab === tab 
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl" 
                  : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {tab === 'overview' && <TrendingUp size={20} />}
              {tab === 'orders' && <ShoppingCart size={20} />}
              {tab === 'riders' && <Bike size={20} />}
              {tab === 'stores' && <Store size={20} />}
              {tab === 'support' && <Headset size={20} />}
              <span className="text-[8px] md:text-sm lg:block capitalize font-bold md:hidden">{tab}</span>
              <span className="hidden lg:block capitalize font-bold text-sm">{tab}</span>
            </button>
          ))}
          <button
            onClick={() => { logout(); navigate('/auth'); }}
            className="flex-1 md:hidden flex flex-col items-center justify-center gap-1 p-2 text-red-400 hover:text-red-500"
          >
            <LogOut size={20} />
            <span className="text-[8px] font-bold uppercase">Sortir</span>
          </button>
        </nav>

        <div className="hidden md:block p-4 mt-auto space-y-2">
          <button onClick={() => navigate('/')} className="w-full flex items-center justify-center lg:justify-start gap-3 p-4 text-slate-400 hover:text-brand rounded-2xl transition-all">
            <ChevronLeft size={20} />
            <span className="hidden lg:block font-bold text-sm">Retour</span>
          </button>
          <button 
            onClick={() => { logout(); navigate('/auth'); }} 
            className="w-full flex items-center justify-center lg:justify-start gap-3 p-4 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-all"
          >
            <LogOut size={20} />
            <span className="hidden lg:block font-bold text-sm">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header */}
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 h-16 md:h-20 flex items-center justify-between px-4 md:px-8 z-40 transition-colors">
          <div className="flex items-center gap-4">
             <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white capitalize tracking-tight">{activeTab}</h2>
          </div>
          
          <div className="flex items-center gap-2 md:gap-6">
            <div className="relative group hidden lg:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Rechercher..." 
                className="pl-12 pr-6 py-2 md:py-2.5 bg-slate-100 dark:bg-slate-800 rounded-full w-48 md:w-64 border-none focus:ring-2 focus:ring-brand transition-all text-sm font-medium"
              />
            </div>

            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 relative transition-all"
              >
                <Bell size={18} md:size={20} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 md:top-2 md:right-2 w-3.5 h-3.5 md:w-4 md:h-4 bg-brand rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center text-[7px] md:text-[8px] text-white font-black">
                    {notifications.length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                   <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-4 w-80 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 z-[100]"
                   >
                      <div className="flex items-center justify-between mb-4">
                         <h4 className="font-black text-slate-900 dark:text-white text-sm">Notifications</h4>
                         <div className="flex gap-2">
                           <button onClick={() => { setShowNotifications(false); setShowSendNotificationModal(true); }} className="text-[10px] font-black text-brand uppercase tracking-widest hover:underline">Envoyer</button>
                           <button onClick={() => setNotifications([])} className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Effacer</button>
                         </div>
                      </div>
                      <div className="space-y-4 max-h-64 overflow-y-auto pr-2 scrollbar-hide">
                         {notifications.length > 0 ? notifications.map(n => (
                            <div key={n.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                               <p className="text-xs font-black text-slate-900 dark:text-white">{n.title}</p>
                               <p className="text-[10px] text-slate-500 mt-1">{n.message}</p>
                               <p className="text-[9px] text-brand font-bold mt-2 uppercase">{n.time}</p>
                            </div>
                         )) : (
                           <p className="text-center text-slate-400 py-6 text-xs italic">Aucune notification</p>
                         )}
                      </div>
                   </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-3 pl-2 md:pl-4 border-l border-slate-100 dark:border-slate-800">
               <div className="flex flex-col items-end hidden sm:flex">
                 <p className="text-xs font-black text-slate-900 dark:text-white leading-none">Super Admin</p>
                 <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Directeur</p>
               </div>
               <div className="relative group">
                 <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-brand/20 p-0.5 cursor-pointer">
                    <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&q=80" className="w-full h-full rounded-full object-cover" alt="Profile" />
                 </div>
                 {/* Logout Tooltip/Menu on Hover/Click */}
                 <button 
                  onClick={() => { logout(); navigate('/auth'); }}
                  className="absolute top-full right-0 mt-2 p-3 bg-red-500 text-white rounded-xl shadow-xl flex items-center gap-2 scale-0 group-hover:scale-100 transition-all origin-top-right z-50 text-[10px] font-black uppercase tracking-widest"
                 >
                   <LogOut size={14} />
                   Déconnexion
                 </button>
               </div>
            </div>
          </div>
        </header>

        {/* Action Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 space-y-8 md:space-y-12 pb-24 md:pb-8">
          {activeTab === 'overview' && (
            <>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  {[
                    { label: 'Revenu Total', val: `${orders.reduce((acc, o) => acc + (o.status === 'DELIVERED' ? o.total : 0), 0).toFixed(0)} DT`, icon: TrendingUp, color: 'text-brand bg-brand/10' },
                    { label: 'Commandes Actives', val: orders.filter(o => o.status !== 'DELIVERED').length, icon: ShoppingCart, color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
                    { label: 'Livreurs', val: riders.length, icon: Bike, color: 'text-green-500 bg-green-50 dark:bg-green-500/10' },
                    { label: 'Clients', val: '1,240', icon: Users, color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
                  ].map((stat, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col group hover:shadow-xl transition-all"
                    >
                       <div className={cn("w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center mb-4 md:mb-6 transition-transform group-hover:scale-110", stat.color)}>
                          <stat.icon size={20} md:size={24} />
                       </div>
                       <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{stat.label}</p>
                       <h3 className="text-xl md:text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight">{stat.val}</h3>
                    </motion.div>
                  ))}
               </div>

               <div className="flex gap-4">
                  <button 
                    onClick={async () => {
                      const mockOrder = {
                        customerId: user?.uid || 'simulated',
                        customerName: 'Client Simulation',
                        customerPhone: '+216 22 123 456',
                        customerEmail: 'client@example.com',
                        storeId: 's1',
                        storeName: 'Burger King',
                        category: 'Restauration Rapide',
                        items: [
                          { name: 'Double Whopper Menu', quantity: 1, price: 18.5 },
                          { name: 'Coca Cola 33cl', quantity: 2, price: 2.5 }
                        ],
                        total: 23.5,
                        status: 'PENDING',
                        paymentMethod: 'CASH',
                        deliveryAddress: '123 Avenue Habib Bourguiba, Tunis 1000, Tunisie',
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now(),
                        deliveryLocation: { lat: 36.8580, lng: 10.3100 },
                      };
                      try {
                        await addDoc(collection(db, 'orders'), mockOrder);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'orders', auth, isAdmin);
      }
                    }}
                    className="flex-1 md:flex-none px-6 py-4 bg-brand text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-brand/20 hover:scale-[1.02] transition-all"
                  >
                    Simuler Commande (TEST)
                  </button>
               </div>

               <div className="space-y-6">
                  <div className="flex items-center justify-between">
                     <h2 className="text-xl md:text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight">Suivi Live</h2>
                     <span className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-500 text-[8px] md:text-[10px] font-black rounded-full uppercase tracking-widest border border-green-500/20">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Live
                     </span>
                  </div>
                  
                  <div className="h-[300px] md:h-[500px] bg-white dark:bg-slate-900 rounded-3xl md:rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden relative">
                    <MapContainer 
                      center={[36.8500, 10.2800]} 
                      zoom={13} 
                      style={{ width: '100%', height: '100%', zIndex: 1 }}
                      scrollWheelZoom={false}
                    >
                      <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                      />
                      <MapEvents riders={riders} />
                      {riders.map(r => (
                        <Marker 
                          key={r.id} 
                          position={[r.location.lat, r.location.lng]} 
                          icon={createRiderIcon(r)}
                        >
                          <Popup>
                            <div className="font-bold">{r.name}</div>
                            <div className="text-xs text-slate-500">{r.status}</div>
                          </Popup>
                        </Marker>
                      ))}
                      {orders.filter(o => o.status === 'ON_THE_WAY' && o.deliveryLocation).map(o => (
                        <Marker 
                          key={o.id} 
                          position={[o.deliveryLocation.lat, o.deliveryLocation.lng]} 
                          icon={orderIcon}
                        >
                          <Popup>
                             <div className="font-bold">Commande #{o.id.slice(-6).toUpperCase()}</div>
                             <div className="text-xs text-slate-500">Destination de {o.customerName}</div>
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>
               </div>

               {/* Active Orders List */}
               <div className="bg-white dark:bg-slate-900 rounded-3xl md:rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="p-5 md:p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                     <h3 className="text-base md:text-xl font-display font-black text-slate-900 dark:text-white tracking-tight uppercase">Flux Actif</h3>
                     <span className="text-[8px] md:text-[10px] font-black px-2 py-1 bg-brand/10 text-brand rounded-full">{orders.filter(o => ['PENDING', 'PREPARING'].includes(o.status)).length} En attente</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[600px] md:min-w-0">
                      <thead>
                        <tr className="border-b border-slate-50 dark:border-slate-800">
                          <th className="px-4 md:px-8 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
                          <th className="px-4 md:px-8 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
                          <th className="px-4 md:px-8 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                          <th className="px-4 md:px-8 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                          <th className="px-4 md:px-8 py-4 md:py-5 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.filter(o => ['PENDING', 'ACCEPTED_BY_STORE', 'PREPARING', 'READY_FOR_PICKUP'].includes(o.status)).map((order) => (
                          <tr key={order.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 md:px-8 py-4 md:py-5 font-black text-[10px] md:text-xs text-slate-900 dark:text-white">#{order.id.slice(-6).toUpperCase()}</td>
                            <td className="px-4 md:px-8 py-4 md:py-5 font-bold text-[10px] md:text-xs text-slate-600 dark:text-slate-400 truncate max-w-[100px] md:max-w-none">{order.customerName}</td>
                            <td className="px-4 md:px-8 py-4 md:py-5">
                               <select 
                                 value={order.status}
                                 onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                                 className={cn(
                                   "px-2 md:px-3 py-1 rounded-full text-[7px] md:text-[8px] font-black uppercase tracking-widest border-none focus:ring-2 focus:ring-brand cursor-pointer transition-all",
                                   order.status === 'PENDING' ? "bg-amber-500/10 text-amber-500" : 
                                   order.status === 'ACCEPTED_BY_STORE' ? "bg-emerald-500/10 text-emerald-500" :
                                   order.status === 'PREPARING' ? "bg-blue-500/10 text-blue-500" :
                                   order.status === 'DELIVERED' ? "bg-green-500/10 text-green-500" :
                                   order.status === 'CANCELLED' ? "bg-red-500/10 text-red-500" :
                                   "bg-brand/10 text-brand"
                                 )}
                               >
                                 {ORDER_STATUSES.map(s => (
                                   <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{s.replace(/_/g, ' ')}</option>
                                 ))}
                               </select>
                            </td>
                            <td className="px-4 md:px-8 py-4 md:py-5 font-black text-[10px] md:text-xs text-slate-900 dark:text-white">{order.total} DT</td>
                            <td className="px-4 md:px-8 py-4 md:py-5 text-right">
                               <button 
                                 onClick={() => setActiveOrder(order)}
                                 className="px-3 md:px-6 py-2 md:py-2.5 bg-brand/10 text-brand text-[8px] md:text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-brand hover:text-white transition-all"
                               >
                                 Détails
                               </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {orders.filter(o => ['PENDING', 'PREPARING'].includes(o.status)).length === 0 && (
                      <div className="py-20 text-center text-slate-400 font-medium italic">Tout est à jour !</div>
                    )}
                  </div>
               </div>
            </>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-6">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                  <h2 className="text-3xl font-display font-black text-slate-900 dark:text-white tracking-tight">Historique des Commandes</h2>
                  <div className="flex flex-wrap gap-2">
                    {['ALL', 'PENDING', 'PREPARING', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setOrderStatusFilter(s)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                          orderStatusFilter === s 
                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg" 
                            : "bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-800 hover:text-slate-600"
                        )}
                      >
                        {s.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 md:gap-4">
                  {orders
                    .filter(o => orderStatusFilter === 'ALL' || o.status === orderStatusFilter)
                    .map(order => (
                    <motion.div 
                      key={order.id}
                      layout
                      className="group bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-md"
                    >
                       <div className="flex items-center gap-4 md:gap-6">
                          <div className={cn(
                            "w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-colors shrink-0",
                            order.status === 'DELIVERED' ? "bg-green-500/10 text-green-500" : "bg-brand/10 text-brand"
                          )}>
                             {order.status === 'DELIVERED' ? <CheckCircle2 size={20} md:size={24} /> : <Package size={20} md:size={24} />}
                          </div>
                          <div className="text-left min-w-0">
                             <h4 className="font-black text-slate-900 dark:text-white truncate">#{order.id.slice(-6).toUpperCase()}</h4>
                             <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest truncate">{order.customerName} • {order.total} DT</p>
                          </div>
                       </div>
                       <div className="flex items-center justify-between sm:justify-end gap-2 md:gap-4 border-t sm:border-t-0 pt-3 sm:pt-0">
                          <select 
                            value={order.status}
                            onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                            className={cn(
                              "px-3 md:px-4 py-1 md:py-1.5 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest border focus:ring-2 focus:ring-brand cursor-pointer",
                              order.status === 'DELIVERED' ? "bg-green-500/10 text-green-500 border-green-500/20" : 
                              order.status === 'CANCELLED' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                              order.status === 'ON_THE_WAY' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                              "bg-brand/10 text-brand border-brand/20"
                            )}
                          >
                            {ORDER_STATUSES.map(s => (
                              <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{s.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <button onClick={() => handleDeleteOrder(order.id)} className="w-8 h-8 md:w-10 md:h-10 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-500 rounded-lg md:rounded-xl flex items-center justify-center transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shadow-sm leading-none">
                               <Trash2 size={16} md:size={18} />
                            </button>
                            <button onClick={() => setActiveOrder(order)} className="w-8 h-8 md:w-10 md:h-10 bg-brand text-white rounded-lg md:rounded-xl flex items-center justify-center transition-all shadow-lg shadow-brand/20 leading-none">
                               <ChevronRight size={16} md:size={18} />
                            </button>
                          </div>
                       </div>
                    </motion.div>
                  ))}
               </div>
            </div>
          )}

          {activeTab === 'riders' && (
            <div className="space-y-6">
               <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-display font-black text-slate-900 dark:text-white tracking-tight">Gestion des Livreurs</h2>
                  <div className="flex gap-4">
                    <button className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm">Filter</button>
                    <button className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">+ Ajouter</button>
                  </div>
               </div>
               
               <div className="bg-white dark:bg-slate-900 rounded-3xl md:rounded-[3rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                 <div className="overflow-x-auto">
                   <table className="w-full text-left min-w-[700px] lg:min-w-0">
                     <thead>
                       <tr className="border-b border-slate-50 dark:border-slate-800">
                         <th className="px-4 md:px-8 py-4 md:py-6 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Livreur</th>
                         <th className="px-4 md:px-8 py-4 md:py-6 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                         <th className="px-4 md:px-8 py-4 md:py-6 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Order</th>
                         <th className="px-4 md:px-8 py-4 md:py-6 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Position</th>
                         <th className="px-4 md:px-8 py-4 md:py-6 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                       </tr>
                     </thead>
                     <tbody>
                       {riders.map((rider) => {
                         const activeRiderOrder = orders.find(o => o.riderId === rider.id && o.status === 'ON_THE_WAY');
                         return (
                           <tr key={rider.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                             <td className="px-4 md:px-8 py-4 md:py-6">
                               <div className="flex items-center gap-3 md:gap-4">
                                 <div className="w-9 h-9 md:w-10 md:h-10 bg-brand/10 dark:bg-brand/20 rounded-xl flex items-center justify-center font-black text-sm text-brand shrink-0">
                                   {rider.name ? rider.name.charAt(0).toUpperCase() : '?'}
                                 </div>
                                 <div>
                                   <p className="font-black text-slate-900 dark:text-white text-xs md:text-sm">{rider.name}</p>
                                   <p className="text-[9px] md:text-[10px] font-bold text-slate-400">
                                     {rider.rating ? `${Number(rider.rating).toFixed(1)}⭐ (${rider.totalRatings || 0})` : 'Nouveau 🆕'}
                                   </p>
                                 </div>
                               </div>
                             </td>
                              <td className="px-4 md:px-8 py-4 md:py-6">
                                <span className={cn(
                                  "px-2 md:px-3 py-1 rounded-full text-[7px] md:text-[8px] font-black uppercase tracking-widest border",
                                  rider.status === 'IDLE' ? "bg-green-500/10 text-green-500 border-green-500/20" : 
                                  rider.status === 'BUSY' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                  "bg-slate-500/10 text-slate-500 border-slate-500/20"
                                )}>
                                  {rider.status === 'IDLE' ? 'Disponible' : 
                                   rider.status === 'BUSY' ? 'En Livraison' : 'Hors Ligne'}
                                </span>
                              </td>
                             <td className="px-4 md:px-8 py-4 md:py-6">
                               {activeRiderOrder ? (
                                 <p className="text-[10px] md:text-xs font-black text-slate-900 dark:text-white">#{activeRiderOrder.id.slice(-6).toUpperCase()}</p>
                               ) : (
                                 <p className="text-[10px] md:text-xs font-medium text-slate-400 italic">Aucune</p>
                               )}
                             </td>
                             <td className="px-4 md:px-8 py-4 md:py-6">
                               <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-slate-500">
                                 <MapPin size={12} className="text-brand" />
                                 {rider.location.lat.toFixed(3)}, {rider.location.lng.toFixed(3)}
                               </div>
                             </td>
                             <td className="px-4 md:px-8 py-4 md:py-6 text-right">
                               <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                                 <MoreVertical size={16} />
                               </button>
                             </td>
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'stores' && (
            <div className="p-20 text-center bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 font-medium">
                Gestion des magasins en cours de développement.
            </div>
          )}

          {activeTab === 'support' && (
            <AdminSupport />
          )}
        </div>
      </main>

      {/* Order Details Side Panel */}
      <AnimatePresence>
        {activeOrder && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setActiveOrder(null)} 
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ x: '100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg md:max-w-xl h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-100 dark:border-slate-800"
            >
               {/* Header */}
               <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest",
                        activeOrder.status === 'DELIVERED' ? "bg-green-500/10 text-green-500" : "bg-brand/10 text-brand"
                      )}>
                        {activeOrder.status?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-400 text-[10px] font-bold">
                        {activeOrder.createdAt?.seconds ? new Date(activeOrder.createdAt.seconds * 1000).toLocaleString() : 'Date inconnue'}
                      </span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight">Commande #{activeOrder.id.slice(-6).toUpperCase()}</h3>
                  </div>
                  <button 
                    onClick={() => setActiveOrder(null)} 
                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full dark:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
               </div>
               
               {/* Content */}
               <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scrollbar-hide">
                  
                  {/* Progress / Status Header */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total</p>
                      <p className="text-2xl font-display font-black text-brand">{activeOrder.total?.toFixed(2)} DT</p>
                    </div>
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Paiement</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        {activeOrder.paymentMethod === 'CASH' ? '💵 Espèces' : '💳 Carte'}
                      </p>
                    </div>
                  </div>

                  {/* Customer Information */}
                  <section>
                    <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-white">
                      <Users size={18} className="text-brand" />
                      <h4 className="text-sm font-black uppercase tracking-widest">Client</h4>
                    </div>
                    <div className="p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-xl">👤</div>
                        <div>
                          <p className="text-sm font-black dark:text-white">{activeOrder.customerName}</p>
                          <p className="text-[10px] text-slate-400 font-bold">UID: {activeOrder.customerId?.slice(0, 8)}...</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500"><Phone size={14} /></div>
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{activeOrder.customerPhone || 'Non renseigné'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-500"><Smartphone size={14} /></div>
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{activeOrder.customerEmail || 'Aucun email'}</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Store & Delivery */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <section>
                      <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-white">
                        <Store size={18} className="text-brand" />
                        <h4 className="text-sm font-black uppercase tracking-widest">Magasin</h4>
                      </div>
                      <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm h-full">
                        <p className="text-sm font-black dark:text-white mb-1">{activeOrder.storeName}</p>
                        <p className="text-[10px] text-slate-400 font-bold mb-4">{activeOrder.category || 'Restauration'}</p>
                        <div className="text-[10px] text-slate-500 leading-relaxed italic">
                          ID: {activeOrder.storeId}
                        </div>
                      </div>
                    </section>

                    <section>
                      <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-white">
                        <MapPin size={18} className="text-brand" />
                        <h4 className="text-sm font-black uppercase tracking-widest">Destination</h4>
                      </div>
                      <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm h-full">
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                          {activeOrder.deliveryAddress || 'Adresse non spécifiée'}
                        </p>
                        {activeOrder.deliveryLocation && (
                          <div className="mt-3 flex items-center gap-2 text-[8px] font-black text-brand uppercase tracking-tighter">
                            <Navigation size={10} />
                            {activeOrder.deliveryLocation.lat.toFixed(4)}, {activeOrder.deliveryLocation.lng.toFixed(4)}
                          </div>
                        )}
                      </div>
                    </section>
                  </div>

                  {/* Items Breakdown */}
                  <section>
                    <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-white">
                      <Package size={18} className="text-brand" />
                      <h4 className="text-sm font-black uppercase tracking-widest">Articles</h4>
                    </div>
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/80 rounded-3xl border border-slate-100 dark:border-slate-700">
                       <div className="space-y-4">
                          {activeOrder.items?.map((item: any, i: number) => (
                             <div key={i} className="flex justify-between items-center group">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-xl border border-slate-100 dark:border-slate-600 flex items-center justify-center text-xs font-black">
                                    {item.quantity}
                                  </div>
                                  <div>
                                    <p className="text-sm font-black dark:text-white">{item.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">{item.price} DT / unité</p>
                                  </div>
                                </div>
                                <span className="text-sm font-black text-slate-900 dark:text-white">{(item.price * item.quantity).toFixed(2)} DT</span>
                             </div>
                          ))}
                       </div>
                       
                       <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 space-y-3">
                         <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           <span>Sous-total</span>
                           <span>{activeOrder.total?.toFixed(2)} DT</span>
                         </div>
                         <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           <span>Frais de livraison</span>
                           <span className="text-emerald-500">GRATUIT</span>
                         </div>
                         <div className="flex justify-between items-center pt-3 text-xl font-display font-black dark:text-white">
                            <span>TOTAL</span>
                            <span className="text-brand">{activeOrder.total?.toFixed(2)} DT</span>
                         </div>
                       </div>
                    </div>
                  </section>

                  {/* Rider In Charge */}
                  {activeOrder.riderName && (
                    <section>
                      <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-white">
                        <Bike size={18} className="text-brand" />
                        <h4 className="text-sm font-black uppercase tracking-widest">Livreur Assigné</h4>
                      </div>
                      <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-brand/10 text-brand rounded-full flex items-center justify-center text-sm">🛵</div>
                           <div>
                             <p className="text-sm font-black dark:text-white">{activeOrder.riderName}</p>
                             <p className="text-[10px] text-slate-400 font-bold">ID: {activeOrder.riderId}</p>
                           </div>
                        </div>
                        <button className="p-2 text-slate-400 hover:text-brand transition-colors"><ChevronRight size={20} /></button>
                      </div>
                    </section>
                  )}
               </div>

               {/* Footer Actions */}
               <div className="p-6 md:p-8 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky bottom-0 flex gap-3">
                  <button 
                    onClick={() => {
                      if (activeOrder.customerId) {
                        setActiveTab('support');
                        setActiveOrder(null);
                      }
                    }}
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/10 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    <Phone size={18} /> Support Client
                  </button>
                  <button className="flex-1 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                      Imprimer BL
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Target Notification Modal */}
      <AnimatePresence>
        {showSendNotificationModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSendNotificationModal(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl md:rounded-[2.5rem] shadow-2xl p-6 md:p-8 border border-slate-100 dark:border-slate-800"
            >
              <div className="flex items-center justify-between mb-6 md:mb-8">
                <div>
                  <h3 className="text-xl md:text-2xl font-display font-black text-slate-900 dark:text-white">Notification</h3>
                  <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-1">Ciblez un utilisateur spécifique par email.</p>
                </div>
                <button onClick={() => setShowSendNotificationModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full dark:text-white"><X size={18} md:size={20} /></button>
              </div>

              <form onSubmit={handleSendTargetedNotification} className="space-y-4 md:space-y-5">
                <div className="space-y-1 md:space-y-2 text-left">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                  <input 
                    required
                    type="email"
                    value={notifEmail}
                    onChange={(e) => setNotifEmail(e.target.value)}
                    placeholder="exemple@email.com"
                    className="w-full px-4 md:px-5 py-2.5 md:py-3 bg-slate-50 dark:bg-slate-800 rounded-xl md:rounded-2xl border-none focus:ring-2 focus:ring-brand transition-all text-sm font-medium"
                  />
                </div>

                <div className="space-y-1 md:space-y-2 text-left">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Titre</label>
                  <input 
                    required
                    type="text"
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    placeholder="Titre..."
                    className="w-full px-4 md:px-5 py-2.5 md:py-3 bg-slate-50 dark:bg-slate-800 rounded-xl md:rounded-2xl border-none focus:ring-2 focus:ring-brand transition-all text-sm font-medium"
                  />
                </div>

                <div className="space-y-1 md:space-y-2 text-left">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Message</label>
                  <textarea 
                    required
                    rows={3}
                    value={notifMessage}
                    onChange={(e) => setNotifMessage(e.target.value)}
                    placeholder="Tapez votre message ici..."
                    className="w-full px-4 md:px-5 py-2.5 md:py-3 bg-slate-50 dark:bg-slate-800 rounded-xl md:rounded-2xl border-none focus:ring-2 focus:ring-brand transition-all text-sm font-medium resize-none text-left"
                  />
                </div>

                {notifError && (
                  <p className="p-3 bg-red-50 text-red-500 rounded-xl text-[10px] font-bold">{notifError}</p>
                )}

                {notifSuccess && (
                  <p className="p-3 bg-emerald-50 text-emerald-500 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 text-center">
                    <CheckCircle2 size={14} /> Envoyée !
                  </p>
                )}

                <button 
                  disabled={isSendingNotif || notifSuccess}
                  type="submit"
                  className={cn(
                    "w-full py-3.5 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest shadow-xl transition-all shadow-brand/20 mt-2",
                    isSendingNotif || notifSuccess ? "bg-slate-100 text-slate-400" : "bg-brand text-white hover:scale-[1.02] active:scale-95"
                  )}
                >
                  {isSendingNotif ? 'Envoi...' : notifSuccess ? 'Envoyé !' : 'Envoyer'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
