import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, Star, Clock, MapPin, 
  Plus, Minus, ShoppingBag, X,
  Info, ShieldCheck, CreditCard, Banknote, Edit3
} from 'lucide-react';
import { MOCK_STORES, MOCK_PRODUCTS_LIST } from '../constants';
import { cn } from '../lib/utils';
import { useAuth } from '../services/auth';
import { db, auth } from '../services/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import LocationPicker from '../components/LocationPicker';

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

export default function StoreDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const store = MOCK_STORES.find(s => s.id === id);
  const products = MOCK_PRODUCTS_LIST.filter(p => p.storeId === id);
  
  const [cart, setCart] = useState<any[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderStatus, setOrderStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS'>('IDLE');
  const [deliveryLocation, setDeliveryLocation] = useState({ lat: 36.8580, lng: 10.3100 });
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [riderRequest, setRiderRequest] = useState('');

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === productId);
      if (existing.quantity === 1) {
        return prev.filter(item => item.id !== productId);
      }
      return prev.map(item => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item);
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = store?.deliveryFee || 3.5;

  const handlePlaceOrder = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setOrderStatus('LOADING');
    try {
      const orderData = {
        customerId: user.uid,
        customerName: user.displayName || user.email?.split('@')[0],
        storeId: store?.id,
        storeName: store?.name,
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        total: cartTotal + deliveryFee,
        status: 'PENDING',
        paymentMethod: 'CASH',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        deliveryLocation: deliveryLocation,
        notes: notes,
        riderRequest: riderRequest,
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      setOrderStatus('SUCCESS');
      setTimeout(() => {
        navigate(`/tracking?orderId=${docRef.id}`);
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders', auth);
    }
  };

  if (!store) return <div className="p-20 text-center">Store not found</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32 transition-colors duration-300">
      {/* Header Image */}
      <div className="h-64 md:h-80 relative overflow-hidden bg-white">
        <img src={store.image} className="w-full h-full object-contain" alt={store.name} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent pointer-events-none" />
        
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 hover:bg-white/40 transition-all z-10"
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      {/* Store Info Card */}
      <div className="max-w-4xl mx-auto px-4 -mt-20 relative z-10">
        <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 md:p-8 shadow-2xl border border-slate-100 dark:border-slate-800">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="text-left">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-brand/10 text-brand text-[10px] font-black rounded uppercase tracking-widest">{store.type}</span>
                <div className="flex items-center gap-1 text-amber-500 font-bold text-xs">
                  <Star size={14} fill="currentColor" /> {store.rating}
                </div>
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-black text-slate-900 dark:text-white tracking-tight">{store.name}</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 flex items-center gap-2">
                <MapPin size={14} /> {store.address}
              </p>
            </div>
            
            <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-6 md:pt-0 md:pl-8">
              <div className="text-left">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Livraison</p>
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                  <Clock size={16} className="text-brand" /> {store.deliveryTime}
                </div>
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Frais</p>
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                  <CreditCard size={16} className="text-brand" /> {store.deliveryFee} DT
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product List */}
      <div className="max-w-4xl mx-auto px-4 mt-12 text-left">
        <h2 className="text-xl font-display font-black text-slate-900 dark:text-white mb-8 border-l-4 border-brand pl-4">Populaire</h2>
        
        <div className="grid gap-4">
          {products.length > 0 ? products.map((product) => (
            <div 
              key={product.id}
              className="bg-white dark:bg-slate-900 rounded-3xl p-4 md:p-5 flex items-center gap-4 md:gap-6 border border-slate-100 dark:border-slate-800 hover:shadow-xl transition-all group"
            >
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden shrink-0">
                <img src={product.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={product.name} />
              </div>
              
              <div className="flex-1 text-left">
                <h3 className="font-bold text-slate-900 dark:text-white mb-1 group-hover:text-brand transition-colors">{product.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">Délicieuse option fraîchement préparée pour vous.</p>
                <p className="text-sm font-black text-slate-900 dark:text-white mt-2">{product.price} DT</p>
              </div>
              
              <div className="flex flex-col items-center gap-2">
                {cart.find(item => item.id === product.id) ? (
                  <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                    <button 
                      onClick={() => removeFromCart(product.id)}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-900 dark:text-white shadow-sm"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="font-bold text-sm w-4 text-center dark:text-white">{cart.find(item => item.id === product.id).quantity}</span>
                    <button 
                      onClick={() => addToCart(product)}
                      className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center shadow-md"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => addToCart(product)}
                    className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-brand hover:text-white transition-all flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:border-brand"
                  >
                    <Plus size={20} />
                  </button>
                )}
              </div>
            </div>
          )) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 font-medium">
              Aucun produit disponible pour le moment.
            </div>
          )}
        </div>
      </div>

      {/* Sticky Cart Button */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50"
          >
            <button 
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-[2rem] shadow-2xl flex items-center justify-between px-8 hover:scale-[1.02] transition-transform active:scale-95 group"
            >
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center text-white rotate-[-10deg] group-hover:rotate-0 transition-transform">
                    <ShoppingBag size={20} />
                 </div>
                 <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{store.deliveryTime} • {cart.length} articles</p>
                    <p className="text-lg font-display font-black leading-none">Checkout</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-xl font-display font-black">{cartTotal.toFixed(2)} DT</p>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checkout Sidebar/Modal */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsCheckoutOpen(false)} 
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ x: '100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '100%' }} 
              className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col p-8 overflow-hidden transition-colors"
            >
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-3xl font-display font-black text-slate-900 dark:text-white tracking-tight">Votre Panier</h3>
                <button onClick={() => setIsCheckoutOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors dark:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pr-2 scrollbar-hide">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100">
                        <img src={item.image} className="w-full h-full object-cover" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-slate-900 dark:text-white">{item.name}</p>
                        <p className="text-xs text-slate-500 font-medium">{item.price} DT</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center dark:text-white">
                        <Minus size={14} />
                      </button>
                      <span className="font-bold dark:text-white">{item.quantity}</span>
                      <button onClick={() => addToCart(item)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center dark:text-white">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 space-y-4">
                 <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Temps estimé</span>
                    <span className="font-bold dark:text-white flex items-center gap-1">
                      <Clock size={12} className="text-slate-400" /> {store.deliveryTime}
                    </span>
                 </div>
                 <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Sous-total</span>
                    <span className="font-bold dark:text-white">{cartTotal.toFixed(2)} DT</span>
                 </div>
                 <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Livraison</span>
                    <span className="font-bold dark:text-white">{deliveryFee.toFixed(2)} DT</span>
                 </div>
                 <div className="flex justify-between text-xl pt-2">
                    <span className="font-display font-black text-slate-900 dark:text-white">Total</span>
                    <span className="font-display font-black text-brand">{(cartTotal + deliveryFee).toFixed(2)} DT</span>
                 </div>

                 {/* Delivery Address Section */}
                 <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                       <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Adresse de livraison</p>
                       <button 
                        onClick={() => setIsPickerOpen(true)}
                        className="text-[9px] font-black text-brand flex items-center gap-1 hover:underline"
                       >
                         <Edit3 size={10} /> 
                         MODIFIER
                       </button>
                    </div>
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center text-brand shadow-sm">
                          <MapPin size={24} />
                       </div>
                       <div className="text-left">
                          <p className="font-bold text-slate-900 dark:text-white text-xs">GPS: {deliveryLocation.lat.toFixed(4)}, {deliveryLocation.lng.toFixed(4)}</p>
                          <p className="text-[10px] text-slate-400 font-medium">Position sur la carte confirmée.</p>
                       </div>
                    </div>
                 </div>

                 {/* Payment Method - Only Cash */}
                 <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                       <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Payment Method</p>
                       <span className="text-[8px] bg-green-500 text-white px-2 py-0.5 rounded-full font-black">DEFAULT</span>
                    </div>
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center text-green-500 shadow-sm">
                          <Banknote size={24} />
                       </div>
                       <div className="text-left">
                          <p className="font-bold text-slate-900 dark:text-white">Cash on Delivery</p>
                          <p className="text-[10px] text-slate-400 font-medium">Payez à la livraison de votre commande.</p>
                       </div>
                    </div>
                  </div>

                  {/* Special Requests */}
                  <div className="mt-4 space-y-4">
                     <div className="bg-slate-50 dark:bg-slate-800 rounded-3xl p-5 border border-slate-100 dark:border-slate-700">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Notes pour le Restaurant</label>
                        <textarea 
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Ex: Pas d'oignons, bien cuit, sauce à part..."
                          className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-medium dark:text-white placeholder:text-slate-400 focus:outline-none resize-none"
                          rows={2}
                        />
                     </div>
                     <div className="bg-slate-50 dark:bg-slate-800 rounded-3xl p-5 border border-slate-100 dark:border-slate-700">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Note au Livreur</label>
                        <textarea 
                          value={riderRequest}
                          onChange={(e) => setRiderRequest(e.target.value)}
                          placeholder="Ex: Code porte 1234, sonner en bas..."
                          className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-medium dark:text-white placeholder:text-slate-400 focus:outline-none resize-none"
                          rows={2}
                        />
                     </div>
                  </div>

                  <button 
                  onClick={handlePlaceOrder}
                  disabled={orderStatus === 'LOADING' || orderStatus === 'SUCCESS'}
                  className={cn(
                    "w-full py-5 rounded-2xl font-display font-black text-sm uppercase tracking-[0.2em] shadow-xl transition-all mt-6",
                    orderStatus === 'SUCCESS' ? "bg-green-500 text-white" : "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                  )}
                 >
                    {orderStatus === 'LOADING' ? 'Processing...' : 
                     orderStatus === 'SUCCESS' ? 'Order Placed!' : 'Commander Maintenant'}
                 </button>
                 
                 <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                    <ShieldCheck size={14} className="text-green-500" />
                    Paiement sécurisé par FISA3
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Location Picker Overlay */}
      <AnimatePresence>
        {isPickerOpen && (
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPickerOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 100 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 100 }}
              className="relative w-full max-w-2xl h-[80vh] sm:h-[600px] bg-white dark:bg-slate-900 shadow-2xl z-10 sm:rounded-[3rem] overflow-hidden"
            >
              <LocationPicker 
                initialLocation={deliveryLocation}
                onClose={() => setIsPickerOpen(false)}
                onSelect={(loc) => {
                  setDeliveryLocation(loc);
                  setIsPickerOpen(false);
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
