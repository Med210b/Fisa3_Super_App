import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, Clock, Phone, 
  ChevronLeft, Package,
  Bike, Store as StoreIcon,
  ShieldCheck, Smartphone, Search,
  CheckCircle2, ArrowLeft, MessageSquare, Navigation
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BRAND } from '../constants';
import { cn } from '../lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useGeolocation } from '../hooks/useGeolocation';
import { useAuth } from '../services/auth';
import RiderRating from '../components/RiderRating';

// Fix leaflet icons
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const riderIcon = L.divIcon({
  className: 'custom-rider-icon',
  html: `<div class="relative">
          <div class="absolute inset-0 bg-red-500/20 rounded-full scale-[2.5] animate-ping"></div>
          <div class="relative w-12 h-12 bg-white rounded-full shadow-2xl flex items-center justify-center p-2 border-2 border-red-500 overflow-visible">
             <span class="text-3xl animate-bounce-slight">🛵</span>
             <div class="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
          </div>
       </div>`,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

const userIcon = L.divIcon({
  className: 'custom-user-icon',
  html: `<div class="w-10 h-10 bg-slate-900 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
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
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, auth: any) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function ChangeView({ center, zoom }: { center: [number, number], zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom || map.getZoom());
  }, [center, zoom, map]);
  return null;
}

export default function Tracking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || 'DEMO-123';
  
  const [order, setOrder] = useState<any>(null);
  const [tracking, setTracking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { location: realLocation } = useGeolocation();

  // 1. Subscribe to basic order data
  useEffect(() => {
    const orderPath = `orders/${orderId}`;
    const orderRef = doc(db, orderPath);

    const unsubOrder = onSnapshot(orderRef, (snapshot) => {
      if (snapshot.exists()) {
        setOrder({ id: snapshot.id, ...snapshot.data() });
      } else {
        if (orderId.startsWith('DEMO')) {
          setOrder({
            id: orderId,
            status: 'ON_THE_WAY',
            storeName: 'Burger King',
            riderId: 'R1',
            riderName: 'Ahmed K.',
            riderPhone: '+216 55 555 555',
            total: 28.5,
            items: [{ name: 'Whopper', quantity: 1, price: 18.5 }],
            deliveryLocation: { lat: 36.8580, lng: 10.3100 }
          });
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Order sub failed", error);
    });

    return () => unsubOrder();
  }, [orderId]);

  // 2. Subscribe to order-specific tracking sub-collection (ETA, distance)
  useEffect(() => {
    const trackingPath = `orders/${orderId}/tracking/current`;
    const trackingRef = doc(db, trackingPath);

    const unsubTracking = onSnapshot(trackingRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setTracking(prev => ({
          ...prev,
          ...data
        }));
      } else if (orderId.startsWith('DEMO')) {
        setTracking(prev => prev || ({
          location: { lat: 36.8450, lng: 10.2700 },
          riderName: 'Ahmed K.',
          eta: '12 mins'
        }));
      }
    }, (error) => {
      console.error("Tracking sub failed", error);
    });

    return () => unsubTracking();
  }, [orderId]);

  // 3. Subscribe to rider profile for high-frequency location updates
  useEffect(() => {
    if (!order?.riderId) return;

    const riderRef = doc(db, 'riders', order.riderId);
    const unsubRider = onSnapshot(riderRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.location) {
          setTracking(prev => ({
            ...prev,
            location: data.location,
            riderName: data.name || prev?.riderName,
            riderPhone: data.phone || prev?.riderPhone,
            riderImage: data.image || prev?.riderImage
          }));
        }
      }
    }, (error) => {
      console.error("Rider location sub failed", error);
    });

    return () => unsubRider();
  }, [order?.riderId]);

  // Simulate movement if demo
  useEffect(() => {
    if (orderId.startsWith('DEMO')) {
      const interval = setInterval(() => {
        setTracking(prev => {
          if (!prev) return prev;
          const userPos = order?.deliveryLocation || { lat: 36.8580, lng: 10.3100 };
          return {
            ...prev,
            location: {
              lat: prev.location.lat + (userPos.lat - prev.location.lat) * 0.05,
              lng: prev.location.lng + (userPos.lng - prev.location.lng) * 0.05,
            }
          };
        });
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [orderId, order]);

  const riderPos = tracking?.location || { lat: 36.8450, lng: 10.2700 };
  const userPos = order?.deliveryLocation || { lat: 36.8580, lng: 10.3100 };

  const STEPS = [
    { 
      id: 1, 
      label: 'Confirmation Restaurant', 
      status: order?.status === 'PENDING' ? 'active' : (['CANCELLED'].includes(order?.status) ? 'pending' : 'completed'), 
      description: order?.status === 'PENDING' ? 'Le restaurant examine votre commande.' : 'Commande acceptée par le restaurant.',
      icon: Package 
    },
    { 
      id: 2, 
      label: 'En Préparation', 
      status: ['ACCEPTED_BY_STORE', 'PREPARING'].includes(order?.status) ? 'active' : (['READY_FOR_PICKUP', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED'].includes(order?.status) ? 'completed' : 'pending'), 
      description: 'Le chef prépare votre commande avec soin.',
      icon: StoreIcon 
    },
    { 
      id: 3, 
      label: 'Assignation Livreur', 
      status: order?.status === 'READY_FOR_PICKUP' ? 'active' : (['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED'].includes(order?.status) ? 'completed' : 'pending'), 
      description: 'Nous cherchons le meilleur livreur pour vous.',
      icon: ShieldCheck 
    },
    { 
      id: 4, 
      label: 'En Livraison', 
      status: ['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'].includes(order?.status) ? 'active' : (order?.status === 'DELIVERED' ? 'completed' : 'pending'), 
      description: order?.status === 'ON_THE_WAY' ? 'Le livreur est en chemin vers vous.' : 'Le livreur récupère votre commande.',
      icon: Bike 
    },
    { 
      id: 5, 
      label: 'Livré', 
      status: order?.status === 'DELIVERED' ? 'completed' : 'pending', 
      description: 'Bon appétit ! Profitez de votre commande.',
      icon: CheckCircle2 
    },
  ];

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col lg:flex-row overflow-hidden bg-white dark:bg-slate-950 transition-colors duration-300">
      {/* Map Content */}
      <div className="h-[40vh] lg:h-full lg:flex-grow relative bg-slate-100 dark:bg-slate-900 shrink-0 lg:shrink">
        <MapContainer 
          center={[riderPos.lat, riderPos.lng]} 
          zoom={15} 
          style={{ width: '100%', height: '100%', zIndex: 1 }}
          scrollWheelZoom={true}
        >
          <ChangeView center={[riderPos.lat, riderPos.lng]} />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          
          <Polyline 
            positions={[
              [riderPos.lat, riderPos.lng],
              [userPos.lat, userPos.lng]
            ]}
            color="#FF385C"
            weight={4}
            opacity={0.4}
            dashArray="1, 12"
            lineCap="round"
          />

          <Marker position={[riderPos.lat, riderPos.lng]} icon={riderIcon}>
            <Popup>Livreur: {tracking?.riderName || 'En route'}</Popup>
          </Marker>
          <Marker position={[userPos.lat, userPos.lng]} icon={userIcon}>
            <Popup>Votre destination</Popup>
          </Marker>

          {realLocation && (
            <Marker position={[realLocation.lat, realLocation.lng]}>
              <Popup>Vous êtes ici</Popup>
            </Marker>
          )}
        </MapContainer>

        <button 
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 w-12 h-12 bg-white dark:bg-slate-900 rounded-full shadow-2xl flex items-center justify-center text-slate-900 dark:text-white hover:bg-slate-50 z-20 border border-slate-100 dark:border-slate-800"
        >
          <ChevronLeft size={24} />
        </button>

        {tracking?.eta && (
          <div className="absolute top-6 right-6 p-4 glass rounded-[2rem] shadow-xl z-20 border border-white/50 dark:border-slate-700/50 hidden sm:block">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center text-brand">
                <Clock size={20} />
              </div>
              <div className="text-left">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Arrivée prévue</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">{tracking.eta}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control Panel */}
      <aside className="w-full lg:w-[420px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 z-30 flex flex-col flex-1 lg:h-full overflow-hidden">
        <div className="p-6 md:p-10 flex-grow overflow-y-auto">
          <div className="flex items-center justify-between mb-10">
            <div className="text-left">
              <span className="text-[10px] font-black uppercase text-brand tracking-[0.3em] mb-1 block">Live Tracking</span>
              <h2 className="text-3xl font-display font-black text-slate-900 dark:text-white tracking-tight">#{orderId.slice(-6).toUpperCase()}</h2>
            </div>
            <div className="flex flex-col items-end">
              <span className="bg-brand text-white text-[9px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest animate-pulse shadow-lg shadow-brand/20">
                {order?.status?.replace('_', ' ') || 'LOADING'}
              </span>
            </div>
          </div>

          {/* Live Stats Card */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-brand/5 dark:bg-brand/10 p-5 rounded-[2rem] border border-brand/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white">
                  <Clock size={16} />
                </div>
                <span className="text-[10px] font-black uppercase text-brand tracking-widest leading-none">Arrivée</span>
              </div>
              <p className="text-2xl font-display font-black text-slate-900 dark:text-white leading-none">{tracking?.eta || 'Calcul...'}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900">
                  <MapPin size={16} />
                </div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Distance</span>
              </div>
              <p className="text-2xl font-display font-black text-slate-900 dark:text-white leading-none">~1.2 km</p>
            </div>
          </div>

          {/* Rider Profile */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-800 mb-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img src={tracking?.riderImage || "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&q=80"} alt="Rider" className="w-16 h-16 rounded-full object-cover border-4 border-white dark:border-slate-700 shadow-xl" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white dark:border-slate-700 rounded-full flex items-center justify-center">
                    <ShieldCheck size={10} className="text-white" />
                  </div>
                </div>
                <div className="text-left">
                   <h4 className="font-black text-slate-900 dark:text-white text-lg">{tracking?.riderName || order?.riderName || 'Cherche Livreur...'}</h4>
                   <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Livreur Certifié FISA3</p>
                </div>
              </div>
              <div className="flex gap-2">
                 {(tracking?.riderPhone || order?.riderPhone) && (
                   <a 
                    href={`tel:${tracking?.riderPhone || order?.riderPhone}`}
                    className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center hover:text-brand shadow-sm transition-all active:scale-90"
                   >
                     <Phone size={20} />
                   </a>
                 )}
              </div>
            </div>
          </div>

          {/* Progress Timeline */}
          <div className="space-y-10 relative px-2">
             <div className="absolute top-4 bottom-4 left-[27px] w-1 bg-slate-100 dark:bg-slate-800 rounded-full" />
             
             {STEPS.map((step) => (
                <div key={step.id} className="relative flex items-start gap-8 group">
                   <div className={cn(
                     "relative z-10 w-12 h-12 rounded-[20px] flex items-center justify-center transition-all duration-700",
                     step.status === 'completed' ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : 
                     step.status === 'active' ? "bg-brand text-white shadow-2xl shadow-brand/40 scale-110 ring-4 ring-brand/10" : 
                     "bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600"
                   )}>
                      <step.icon size={22} className={cn(step.status === 'active' && 'animate-pulse')} />
                   </div>
                   
                   <div className="flex-grow pt-2 text-left">
                      <div className="flex justify-between items-center mb-1">
                         <h5 className={cn(
                           "text-sm font-black uppercase tracking-tight",
                           step.status === 'pending' ? "text-slate-400 dark:text-slate-600" : "text-slate-900 dark:text-white"
                         )}>
                           {step.label}
                         </h5>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        {step.description}
                      </p>
                   </div>
                </div>
             ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30">
           {order?.status === 'DELIVERED' ? (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
               <motion.div 
                 initial={{ opacity: 0, scale: 0.9 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="bg-emerald-500/10 border-2 border-emerald-500/20 rounded-[2rem] p-6 text-center"
               >
                 <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-emerald-500/20">
                    <CheckCircle2 size={32} />
                 </div>
                 <h3 className="text-xl font-display font-black text-slate-900 dark:text-white mb-2">Bienvenue ! 🎉</h3>
                 <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Votre commande a été livrée. Nous espérons que vous allez l'adorer !</p>
               </motion.div>

               {!order?.riderRated && (
                 <RiderRating 
                  orderId={order.id}
                  riderId={order.riderId || 'R1'}
                  riderName={order.riderName || 'Ahmed K.'}
                  customerId={user?.uid || ''}
                 />
               )}
               
               <button 
                 onClick={() => navigate('/stores')}
                 className="w-full mt-4 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-brand"
               >
                 Retour à l'accueil
               </button>
             </div>
           ) : (
             <>
               <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center text-xs font-black">
                        COD
                     </div>
                     <div className="text-left leading-none">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Payment</p>
                        <p className="text-xs font-bold dark:text-white">Espèces (Cache)</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total à payer</p>
                     <p className="text-xl font-display font-black text-slate-900 dark:text-white">{order?.total?.toFixed(2) || '0.00'} DT</p>
                  </div>
               </div>
               <button className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
                  <Smartphone size={16} /> Contact Support
               </button>
             </>
           )}
        </div>
      </aside>
    </div>
  );
}
