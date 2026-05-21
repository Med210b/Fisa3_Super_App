import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bike, Package, MapPin, Phone, 
  CheckCircle2, Clock, Navigation, 
  AlertCircle, ChevronRight, LogOut,
  User, Settings, X, Save, Wallet
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { useAuth } from '../services/auth';
import { 
  collection, query, where, onSnapshot, 
  doc, updateDoc, serverTimestamp, 
  getDoc, orderBy, setDoc, addDoc
} from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BRAND } from '../constants';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import RiderWallet from '../components/RiderWallet';

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const riderIcon = L.divIcon({
  className: 'custom-rider-icon',
  html: `<div class="relative w-8 h-8 bg-brand rounded-full border-4 border-white shadow-xl flex items-center justify-center">
          <span class="text-white text-xs">🛵</span>
        </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const clientIcon = L.divIcon({
  className: 'custom-client-icon',
  html: `<div class="relative w-8 h-8 bg-slate-900 rounded-full border-4 border-white shadow-xl flex items-center justify-center">
          <span class="text-white text-xs">🏠</span>
        </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function RiderDashboard() {
  const { user, isRider, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [riderLocation, setRiderLocation] = useState<[number, number]>([36.8065, 10.1815]);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'MISSIONS' | 'WALLET'>('MISSIONS');
  const [missionOffer, setMissionOffer] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Load rider details
  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const riderRef = doc(db, 'riders', user.uid);
      const snap = await getDoc(riderRef);
      if (snap.exists()) {
        const data = snap.data();
        setProfileName(data.name || "");
        setProfilePhone(data.phone || "");
        setIsOnline(data.isOnline !== false); // Default to true if not set
      }
    };
    loadProfile();
  }, [user]);

  // Help for distance/time calculation
  const distance = activeOrder?.deliveryLocation ? 
    (Math.sqrt(
      Math.pow(riderLocation[0] - activeOrder.deliveryLocation.lat, 2) + 
      Math.pow(riderLocation[1] - activeOrder.deliveryLocation.lng, 2)
    ) * 111).toFixed(1) : "0.0";
  
  const estimatedMin = Math.ceil(parseFloat(distance) * 4); // Estimé: 4 min per km

  // Security check
  useEffect(() => {
    if (!authLoading && (!user || !isRider)) {
      navigate('/auth');
    }
  }, [user, isRider, authLoading, navigate]);

  // Moniteur location et enregistrement du livreur
  useEffect(() => {
    if (!user || !isOnline) {
      if (user && !isOnline) {
        // Just sync status if offline
        updateDoc(doc(db, 'riders', user.uid), {
          status: 'OFFLINE',
          isOnline: false,
          updatedAt: serverTimestamp()
        }).catch(err => console.error("Error setting offline:", err));
      }
      return;
    }

    let watchId: number;

    const syncRiderData = async (lat: number, lng: number) => {
      const riderRef = doc(db, 'riders', user.uid);
      const riderData = {
        id: user.uid,
        name: profileName || user.displayName || user.email?.split('@')[0] || "Livreur",
        phone: profilePhone || "",
        email: user.email,
        status: activeOrder ? 'BUSY' : 'IDLE',
        isOnline: true,
        location: { lat, lng },
        updatedAt: serverTimestamp(),
      };

      await setDoc(riderRef, riderData, { merge: true });

      // Synchroniser avec le suivi de la commande active pour le client
      if (activeOrder) {
        const trackingRef = doc(db, `orders/${activeOrder.id}/tracking/current`);
        await setDoc(trackingRef, {
          location: { lat, lng },
          riderName: riderData.name,
          eta: activeOrder.status === 'OUT_FOR_DELIVERY' ? `${estimatedMin} min` : "En préparation",
          distance: `${distance} km`,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // Update the order itself with the latest location for easier access
        await updateDoc(doc(db, 'orders', activeOrder.id), {
          lastRiderLocation: { lat, lng },
          estimatedDeliveryTime: activeOrder.status === 'OUT_FOR_DELIVERY' ? `${estimatedMin} min` : activeOrder.estimatedDeliveryTime
        });
      }
    };

    // Initial sync
    syncRiderData(riderLocation[0], riderLocation[1]);

    // Start watching position
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setRiderLocation([latitude, longitude]);
          syncRiderData(latitude, longitude);
        },
        (err) => {
          console.error("Geolocation error:", err);
          if (err.code === 1) {
            setError("Permission GPS refusée. Veuillez activer la localisation.");
          } else {
            setError("Erreur GPS: " + err.message);
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setError("La géolocalisation n'est pas supportée par votre navigateur.");
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [user, isOnline, activeOrder?.id, profileName, profilePhone]);

  // Listen for assigned orders
  useEffect(() => {
    if (!user) return;

    const ordersPath = 'orders';
    const q = query(
      collection(db, ordersPath),
      where('riderId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setOrders(ordersData);
      
      // Auto-select the first active order
      const currentActive = ordersData.find(o => 
        ['ASSIGNED', 'CONFIRMED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(o.status)
      );
      if (currentActive) setActiveOrder(currentActive);
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, ordersPath);
    });

    return () => unsubscribe();
  }, [user]);

  // Listen for notifications (Mission Offers)
  useEffect(() => {
    if (!user) return;

    const notifPath = `riders/${user.uid}/notifications`;
    const q = query(
      collection(db, notifPath),
      where('read', '==', false),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setNotifications(notifs);

      // Look for mission offers
      const mission = notifs.find(n => n.type === 'MISSION_OFFER');
      if (mission && !activeOrder) {
        setMissionOffer(mission);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, notifPath);
    });

    return () => unsubscribe();
  }, [user, activeOrder]);

  const handleAcceptMission = async (offer: any) => {
    try {
      if (!user) return;
      
      const orderRef = doc(db, 'orders', offer.orderId);
      const orderSnap = await getDoc(orderRef);
      
      if (!orderSnap.exists()) {
        setError("Commande introuvable");
        return;
      }
      
      const orderData = orderSnap.data();
      if (orderData.riderId) {
        setError("Cette mission a déjà été acceptée par un autre livreur");
        setMissionOffer(null);
        // Mark as read
        await updateDoc(doc(db, `riders/${user.uid}/notifications`, offer.id), { read: true });
        return;
      }

      // Accept mission
      await updateDoc(orderRef, {
        riderId: user.uid,
        riderName: profileName || user.displayName || "Livreur",
        riderPhone: profilePhone || "",
        status: 'ASSIGNED',
        updatedAt: serverTimestamp()
      });

      // Notify client
      if (orderData.customerId) {
        await addDoc(collection(db, `users/${orderData.customerId}/notifications`), {
          title: "Livreur Trouvé !",
          message: `Un livreur a accepté votre commande et se rend au restaurant.`,
          type: "RIDER_ASSIGNED",
          orderId: offer.orderId,
          createdAt: serverTimestamp(),
          read: false
        });
      }

      // Mark notification as read
      await updateDoc(doc(db, `riders/${user.uid}/notifications`, offer.id), { read: true });
      setMissionOffer(null);
      
    } catch (err: any) {
      setError("Erreur acceptation mission: " + err.message);
    }
  };

  const handleDeclineMission = async (offer: any) => {
    try {
      if (!user) return;
      await updateDoc(doc(db, `riders/${user.uid}/notifications`, offer.id), { read: true });
      setMissionOffer(null);
    } catch (err: any) {
      setError("Erreur refus mission: " + err.message);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const updates: any = { 
        status: newStatus,
        updatedAt: serverTimestamp() 
      };

      // Add specific fields based on status
      if (newStatus === 'CONFIRMED') {
        updates.confirmedAt = serverTimestamp();
        updates.riderPhone = profilePhone || "+216 55 555 555";
        updates.riderName = profileName || user?.displayName || "Rider FISA3";

        // Notify client
        if (activeOrder && activeOrder.customerId) {
          await addDoc(collection(db, `users/${activeOrder.customerId}/notifications`), {
            title: "Livreur Assigné !",
            message: `Votre livreur ${updates.riderName} a accepté votre mission.`,
            type: "RIDER_ASSIGNED",
            orderId: orderId,
            createdAt: serverTimestamp(),
            read: false
          });
        }
      }
      if (newStatus === 'PICKED_UP') {
        updates.pickedUpAt = serverTimestamp();

        // Notify client
        if (activeOrder && activeOrder.customerId) {
          await addDoc(collection(db, `users/${activeOrder.customerId}/notifications`), {
            title: "Commande Récupérée !",
            message: `Votre commande a été récupérée chez le commerçant.`,
            type: "ORDER_PICKED_UP",
            orderId: orderId,
            createdAt: serverTimestamp(),
            read: false
          });
        }
      }
      if (newStatus === 'OUT_FOR_DELIVERY') {
        updates.onTheWayAt = serverTimestamp();
        updates.estimatedDeliveryTime = `${estimatedMin} min`;

        // Notify client
        if (activeOrder && activeOrder.customerId) {
          await addDoc(collection(db, `users/${activeOrder.customerId}/notifications`), {
            title: "Livreur en route !",
            message: `Votre livreur ${profileName || "FISA3"} est en chemin avec votre commande.`,
            type: "OUT_FOR_DELIVERY",
            orderId: orderId,
            createdAt: serverTimestamp(),
            read: false
          });
        }
      }
      if (newStatus === 'DELIVERED') {
        updates.deliveredAt = serverTimestamp();
        
        // Notify client
        if (activeOrder && activeOrder.customerId) {
          await addDoc(collection(db, `users/${activeOrder.customerId}/notifications`), {
            title: "Commande Livrée !",
            message: `Votre commande a été livrée. Bon appétit !`,
            type: "ORDER_DELIVERED",
            orderId: orderId,
            createdAt: serverTimestamp(),
            read: false
          });
        }
        
        // Handle Wallet Payment for Rider
        if (user) {
          const riderRef = doc(db, 'riders', user.uid);
          const riderSnap = await getDoc(riderRef);
          const currentBalance = riderSnap.exists() ? (riderSnap.data().balance || 0) : 0;
          
          // Fixed delivery fee for demonstration, in real app would be dynamic
          const deliveryFee = 5.00; 
          
          // Update balance
          await updateDoc(riderRef, {
            balance: currentBalance + deliveryFee,
            updatedAt: serverTimestamp()
          });

          // Record transaction
          const txRef = doc(collection(db, `riders/${user.uid}/transactions`));
          await setDoc(txRef, {
            id: txRef.id,
            amount: deliveryFee,
            type: 'EARNING',
            status: 'COMPLETED',
            description: `Livraison #${orderId.slice(-6).toUpperCase()}`,
            orderId: orderId,
            createdAt: serverTimestamp()
          });
        }
      }

      await updateDoc(orderRef, updates);
    } catch (err: any) {
      setError("Failed to update status: " + err.message);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingSettings(true);
    try {
      const riderRef = doc(db, 'riders', user.uid);
      await setDoc(riderRef, {
        name: profileName,
        phone: profilePhone,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setIsSettingsOpen(false);
      // Trigger a re-sync if there's an active order
      setError(null);
    } catch (err: any) {
      setError("Erreur lors de la sauvegarde: " + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleOnline = async () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    if (user) {
      try {
        const riderRef = doc(db, 'riders', user.uid);
        await updateDoc(riderRef, {
          isOnline: newStatus,
          status: newStatus ? (activeOrder ? 'BUSY' : 'IDLE') : 'OFFLINE',
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Failed to toggle status:", err);
      }
    }
  };

  const handleLogout = async () => {
    try {
      if (user) {
        const riderRef = doc(db, 'riders', user.uid);
        await updateDoc(riderRef, {
          status: 'OFFLINE',
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.error("Failed to set offline status:", e);
    }
    await logout();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-white">
        <Bike className="w-12 h-12 text-brand animate-bounce mb-4" />
        <p className="font-display font-bold text-xl uppercase tracking-widest">Initialisation Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-brand selection:text-white pb-20">
      {/* Mission Offer Toast */}
      <AnimatePresence>
        {missionOffer && (
          <motion.div
            initial={{ opacity: 0, y: -100, x: '-50%' }}
            animate={{ opacity: 1, y: 32, x: '-50%' }}
            exit={{ opacity: 0, y: -100, x: '-50%' }}
            className="fixed top-0 left-1/2 z-[100] w-[90%] max-w-md"
          >
            <div className="bg-brand text-white p-6 rounded-[2.5rem] shadow-2xl shadow-brand/40 flex flex-col gap-6 border border-white/20">
               <div className="flex items-center gap-6">
                 <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shrink-0">
                   <Navigation className="animate-pulse" size={28} />
                 </div>
                 <div className="flex-1 text-left">
                   <h4 className="font-display font-black text-xl tracking-tight leading-tight uppercase italic">Nouvelle Mission!</h4>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mt-1">Estimation: {missionOffer.fee || '8.5'} DT</p>
                 </div>
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                 <button 
                  onClick={() => handleDeclineMission(missionOffer)}
                  className="py-4 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                 >
                   Refuser
                 </button>
                 <button 
                  onClick={() => handleAcceptMission(missionOffer)}
                  className="py-4 bg-white text-brand rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all"
                 >
                   Accepter
                 </button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="p-6 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/20">
            <Bike className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display font-black text-lg tracking-tight uppercase">Rider Portal</h1>
            <p className={cn(
              "text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
              isOnline ? "text-emerald-400" : "text-slate-500"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-emerald-400 animate-pulse" : "bg-slate-500")} />
              {isOnline ? 'En Ligne' : 'Hors Ligne'} • {orders.length} Missions
            </p>
          </div>
        </div>
        
        {/* Desktop Tab Switcher */}
        <div className="hidden md:flex items-center bg-slate-800/50 p-1 rounded-2xl border border-slate-800">
           <button 
             onClick={() => setActiveTab('MISSIONS')}
             className={cn(
               "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
               activeTab === 'MISSIONS' ? "bg-brand text-white shadow-lg shadow-brand/20" : "text-slate-500 hover:text-slate-300"
             )}
           >
             Missions
           </button>
           <button 
             onClick={() => setActiveTab('WALLET')}
             className={cn(
               "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
               activeTab === 'WALLET' ? "bg-brand text-white shadow-lg shadow-brand/20" : "text-slate-500 hover:text-slate-300"
             )}
           >
             Portefeuille
           </button>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={toggleOnline}
            className={cn(
              "p-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 border-2",
              isOnline 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                : "bg-slate-800 border-slate-700 text-slate-400"
            )}
          >
            {isOnline ? 'Go Offline' : 'Go Online'}
          </button>
          
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95 flex items-center gap-2"
          >
            <Settings size={20} />
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">Paramètres</span>
          </button>
          
          <button 
            onClick={handleLogout}
            className="p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-red-500 transition-all active:scale-95 shadow-lg"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        {activeTab === 'MISSIONS' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Orders List & Active Order Detail */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Active Order Highlight */}
              <AnimatePresence mode="wait">
                {activeOrder ? (
                  <motion.div 
                    key="active-order"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-brand rounded-[32px] p-8 shadow-2xl shadow-brand/30 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                      <Package size={120} />
                    </div>
                    
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6">
                        <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest">En Cours</span>
                        <span className="text-white/60 text-xs font-mono">#{activeOrder.id.slice(-6).toUpperCase()}</span>
                      </div>
                      
                      <h2 className="text-3xl font-display font-black leading-tight mb-2">
                        {activeOrder.customerName || "Nouveau Client"}
                      </h2>
                      <p className="text-white/80 text-sm font-medium mb-4 flex items-center gap-2">
                        <MapPin size={16} />
                        {activeOrder.deliveryAddress}
                      </p>

                      {/* Rider Note */}
                      {activeOrder.riderRequest && (
                        <div className="mb-6 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-start gap-3">
                          <Clock className="text-white shrink-0" size={18} />
                          <div>
                            <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">Instruction au Livreur</p>
                            <p className="text-sm text-white italic font-medium">"{activeOrder.riderRequest}"</p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <a 
                          href={`tel:${activeOrder.customerPhone || '20000000'}`}
                          className="flex items-center justify-center gap-3 bg-white text-brand rounded-2xl py-4 font-bold active:scale-95 transition-all shadow-xl shadow-black/10 flex-grow"
                        >
                          <Phone size={18} />
                          Appeler le Client
                        </a>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="no-order"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-slate-900 rounded-[32px] p-12 border border-slate-800 text-center flex flex-col items-center space-y-4"
                  >
                    <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-600">
                      <Package size={32} />
                    </div>
                    <h3 className="font-display font-bold text-lg">Aucune commande active</h3>
                    <p className="text-slate-500 text-sm">Les nouvelles tâches apparaîtront ici dès qu'un admin vous les assigne.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Steps */}
              {activeOrder && (
                <div className="bg-slate-900 rounded-[32px] p-6 border border-slate-800 space-y-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Clock size={14} /> Étapes de Livraison
                  </h3>
                  
                  <div className="space-y-3">
                    <StatusButton 
                      label="Approuver la commande" 
                      isActive={activeOrder.status === 'ASSIGNED'}
                      isCompleted={['CONFIRMED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED'].includes(activeOrder.status)}
                      onClick={() => updateOrderStatus(activeOrder.id, 'CONFIRMED')}
                    />
                    <StatusButton 
                      label="Récupéré au restaurant" 
                      isActive={activeOrder.status === 'CONFIRMED'}
                      isCompleted={['PICKED_UP', 'ON_THE_WAY', 'DELIVERED'].includes(activeOrder.status)}
                      onClick={() => updateOrderStatus(activeOrder.id, 'PICKED_UP')}
                    />
                    <StatusButton 
                      label="En chemin (Start Navigation)" 
                      isActive={activeOrder.status === 'PICKED_UP'}
                      isCompleted={['OUT_FOR_DELIVERY', 'DELIVERED'].includes(activeOrder.status)}
                      onClick={() => updateOrderStatus(activeOrder.id, 'OUT_FOR_DELIVERY')}
                    />
                    <StatusButton 
                      label="Commande Livrée" 
                      isActive={activeOrder.status === 'OUT_FOR_DELIVERY'}
                      isCompleted={activeOrder.status === 'DELIVERED'}
                      onClick={() => updateOrderStatus(activeOrder.id, 'DELIVERED')}
                    />
                  </div>
                </div>
              )}

              {/* Order History / List */}
              <div className="bg-slate-900 rounded-[32px] p-6 border border-slate-800">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Historique Récent</h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {orders.filter(o => o.id !== activeOrder?.id).map(order => (
                    <div 
                      key={order.id}
                      onClick={() => setActiveOrder(order)}
                      className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl hover:bg-slate-800 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                          order.status === 'DELIVERED' ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-700 text-slate-400"
                        )}>
                          {order.status === 'DELIVERED' ? <CheckCircle2 size={18} /> : <Package size={18} />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold">{order.customerName || "Client"}</h4>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{order.status}</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-600 group-hover:translate-x-1 transition-transform" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Map & Live Navigation */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              <div className="bg-slate-900 rounded-[40px] border border-slate-800 overflow-hidden h-[500px] lg:h-[700px] relative shadow-2xl">
                <MapContainer 
                  center={riderLocation} 
                  zoom={13} 
                  className="w-full h-full"
                  zoomControl={false}
                >
                  <TileLayer 
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
                    attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                  />
                  <MapUpdater center={riderLocation} />
                  
                  <Marker position={riderLocation} icon={riderIcon}>
                    <Popup>
                      <div className="bg-slate-900 text-white p-2 rounded-lg">Ma position</div>
                    </Popup>
                  </Marker>

                  {activeOrder?.deliveryLocation && (
                    <>
                      <Marker 
                        position={[activeOrder.deliveryLocation.lat, activeOrder.deliveryLocation.lng]} 
                        icon={clientIcon}
                      >
                        <Popup>
                          <div className="font-bold">{activeOrder.customerName}</div>
                          <div className="text-xs">{activeOrder.deliveryAddress}</div>
                        </Popup>
                      </Marker>
                      <Polyline 
                        positions={[riderLocation, [activeOrder.deliveryLocation.lat, activeOrder.deliveryLocation.lng]]} 
                        color={BRAND.colors.primary}
                        dashArray="10, 10"
                        weight={4}
                        opacity={0.6}
                      />
                    </>
                  )}
                </MapContainer>

                {/* Float Bottom Details */}
                <AnimatePresence>
                  {activeOrder && (
                    <motion.div 
                      key="order-float"
                      initial={{ y: 100 }}
                      animate={{ y: 0 }}
                      exit={{ y: 100 }}
                      className="absolute bottom-6 left-6 right-6 z-[1000] p-6 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-[32px] shadow-2xl flex flex-wrap items-center justify-between gap-6"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center p-2">
                          <User size={28} className="text-slate-400" />
                        </div>
                        <div>
                          <h4 className="text-xl font-display font-black">{activeOrder.customerName}</h4>
                          <p className="text-slate-400 font-medium">{activeOrder.customerPhone || "+216 -- --- ---"}</p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <button 
                          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${activeOrder.deliveryLocation.lat},${activeOrder.deliveryLocation.lng}`)}
                          className="px-8 py-4 bg-white text-slate-950 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-200 transition-all active:scale-95"
                        >
                          <Navigation size={18} />
                          Google Maps
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
             <RiderWallet riderId={user?.uid || ''} />
          </div>
        )}
      </div>

      {/* Mission Offer Modal */}
      <AnimatePresence>
        {missionOffer && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-sm bg-brand rounded-[40px] p-8 relative shadow-2xl shadow-brand/20 overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 -mr-10 -mt-10">
                <Bike size={160} />
              </div>
              
              <div className="relative z-10 text-center">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-[32px] flex items-center justify-center mx-auto mb-6">
                  <Package size={40} />
                </div>
                
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 mb-2">Nouvelle Mission</p>
                <h2 className="text-3xl font-display font-black mb-1 truncate px-2">{missionOffer.storeName}</h2>
                <div className="flex items-center justify-center gap-2 mb-8">
                  <span className="text-xs font-bold text-white/80">Pour {missionOffer.customerName}</span>
                  <span className="w-1 h-1 bg-white/40 rounded-full" />
                  <span className="text-xs font-black text-white">{missionOffer.total} DT</span>
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={() => handleAcceptMission(missionOffer)}
                    className="w-full py-5 bg-white text-brand rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-black/10 active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    <CheckCircle2 size={20} />
                    Accepter Mission
                  </button>
                  <button 
                    onClick={() => handleDeclineMission(missionOffer)}
                    className="w-full py-4 bg-brand-dark/20 text-white/60 hover:text-white rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Plus tard
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-slate-900/80 backdrop-blur-xl border-t border-slate-800 p-2 z-[2000]">
         <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => setActiveTab('MISSIONS')}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-2xl transition-all",
                activeTab === 'MISSIONS' ? "bg-brand/10 text-brand font-black" : "text-slate-500 font-bold"
              )}
            >
              <Bike size={20} />
              <span className="text-[9px] uppercase tracking-widest">Missions</span>
            </button>
            <button 
              onClick={() => setActiveTab('WALLET')}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-2xl transition-all",
                activeTab === 'WALLET' ? "bg-brand/10 text-brand font-black" : "text-slate-500 font-bold"
              )}
            >
              <Wallet size={20} />
              <span className="text-[9px] uppercase tracking-widest">Portefeuille</span>
            </button>
         </div>
      </div>

      {error && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[2000] w-full max-w-md px-4">
          <div className="bg-red-500 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3">
             <AlertCircle size={20} />
             <span className="font-bold text-sm">{error}</span>
             <button onClick={() => setError(null)} className="ml-auto text-white/50 hover:text-white">✕</button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[3000]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-6 z-[3001]"
            >
              <div className="bg-slate-900 rounded-[32px] border border-slate-800 shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                   <h3 className="text-xl font-display font-black uppercase">Configuration Profil</h3>
                   <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500">
                     <X size={20} />
                   </button>
                </div>
                
                <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nom Complet</label>
                     <div className="relative">
                       <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                       <input 
                         type="text"
                         value={profileName}
                         onChange={(e) => setProfileName(e.target.value)}
                         className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all font-bold"
                         placeholder="Votre nom"
                         required
                       />
                     </div>
                   </div>

                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Numéro de Téléphone</label>
                     <div className="relative">
                       <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                       <input 
                         type="tel"
                         value={profilePhone}
                         onChange={(e) => setProfilePhone(e.target.value)}
                         className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all font-bold font-mono"
                         placeholder="+216 -- --- ---"
                         required
                       />
                     </div>
                   </div>

                   <button 
                     type="submit"
                     disabled={savingSettings}
                     className="w-full py-4 bg-brand text-white rounded-2xl font-black uppercase tracking-widest hover:bg-brand-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                   >
                     {savingSettings ? (
                       <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                     ) : (
                       <><Save size={18} /> Enregistrer le Profil</>
                     )}
                   </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusButton({ label, isActive, isCompleted, onClick }: { label: string, isActive: boolean, isCompleted: boolean, onClick: () => void }) {
  return (
    <button 
      disabled={!isActive || isCompleted}
      onClick={onClick}
      className={cn(
        "w-full p-4 rounded-2xl flex items-center justify-between transition-all group border-2",
        isActive 
          ? "bg-brand/10 border-brand text-brand ring-4 ring-brand/5 shadow-lg shadow-brand/10" 
          : isCompleted
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 opacity-60"
            : "bg-slate-800 border-transparent text-slate-500 opacity-40 grayscale"
      )}
    >
      <div className="flex items-center gap-3">
        {isCompleted ? <CheckCircle2 size={20} /> : <div className={cn("w-5 h-5 rounded-full border-2", isActive ? "border-brand border-t-transparent animate-spin" : "border-slate-500")} />}
        <span className="font-bold text-sm">{label}</span>
      </div>
      {isActive && <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />}
    </button>
  );
}
