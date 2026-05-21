import { useState, useEffect } from 'react';
import { 
  Package, MapPin, Clock, ChevronRight, 
  Search, Filter, ShoppingBag, CheckCircle2,
  Bike, Info, AlertCircle, ArrowLeft, X, Phone, User, Star, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../services/auth';
import { db } from '../services/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import RiderRating from '../components/RiderRating';
import OrderProgressBar from '../components/OrderProgressBar';

export default function Orders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [ratingOrder, setRatingOrder] = useState<any | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'orders'),
      where('customerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Orders page error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredOrders = filter === 'all' 
    ? orders 
    : orders.filter(o => {
        if (filter === 'active') return ['PENDING', 'ACCEPTED_BY_STORE', 'PREPARING', 'READY_FOR_PICKUP', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'].includes(o.status);
        if (filter === 'completed') return o.status === 'DELIVERED';
        if (filter === 'cancelled') return o.status === 'CANCELLED';
        return o.status === filter;
      });

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="w-20 h-20 bg-brand/10 border-4 border-brand/20 rounded-3xl flex items-center justify-center text-brand mb-8 animate-bounce">
          <ShoppingBag size={40} />
        </div>
        <h2 className="text-3xl font-display font-black text-slate-900 dark:text-white mb-4">Connectez-vous pour voir vos commandes</h2>
        <button onClick={() => navigate('/auth')} className="btn-primary px-12 py-4 rounded-2xl">Se Connecter</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-24 pb-12 transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <button 
              onClick={() => navigate(-1)} 
              className="flex items-center gap-2 text-slate-400 hover:text-brand font-black text-[10px] uppercase tracking-widest mb-4 transition-colors"
            >
              <ArrowLeft size={14} /> Retour
            </button>
            <h1 className="text-4xl md:text-5xl font-display font-black text-slate-900 dark:text-white tracking-tight">Mes Commandes</h1>
          </div>

          <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar">
            {(['all', 'active', 'completed', 'cancelled'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  filter === t 
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl" 
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                )}
              >
                {t === 'all' ? 'Toutes' : t === 'active' ? 'En Cours' : t === 'completed' ? 'Livrées' : 'Annulées'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-white dark:bg-slate-900 rounded-[2.5rem] animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-16 text-center shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-200 dark:text-slate-700 mx-auto mb-8">
              <ShoppingBag size={48} />
            </div>
            <h3 className="text-2xl font-display font-black text-slate-900 dark:text-white mb-2">Aucune commande pour le moment</h3>
            <p className="text-slate-500 font-bold mb-8">Découvrez nos restaurants et passez votre première commande !</p>
            <button onClick={() => navigate('/stores')} className="btn-primary px-12 py-4 rounded-2xl">Explorer les Magasins</button>
          </div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {filteredOrders.map((order, idx) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:-translate-y-1 transition-all group overflow-hidden relative"
                >
                  {/* Status Banner for Active */}
                  {['PENDING', 'ACCEPTED_BY_STORE', 'PREPARING', 'READY_FOR_PICKUP', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'].includes(order.status) && (
                    <div className="absolute top-0 right-0 px-6 py-2 bg-brand text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-bl-3xl shadow-lg">
                      {order.status === 'PENDING' ? 'En Attente... ⏳' : 
                       order.status === 'ACCEPTED_BY_STORE' ? 'Confirmé ✅' :
                       order.status === 'PREPARING' ? 'En Préparation 🍳' :
                       order.status === 'READY_FOR_PICKUP' ? 'Prêt pour Pick-up 📦' :
                       order.status === 'ASSIGNED' ? 'Livreur Assigné 🛵' :
                       order.status === 'PICKED_UP' ? 'Récupéré par Livreure 🛵' : 
                       'En Livraison 🛵'}
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row gap-8">
                    {/* Store Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-brand">
                          <ShoppingBag size={28} />
                        </div>
                        <div>
                          <h3 className="text-xl font-display font-black text-slate-900 dark:text-white tracking-tight">{order.storeName}</h3>
                          <div className="flex items-center gap-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                            <span>#{order.id.slice(-6).toUpperCase()}</span>
                            <span>•</span>
                            <span>{order.createdAt?.toDate().toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {order.status !== 'CANCELLED' && (
                        <div className="mb-6 bg-slate-50/50 dark:bg-slate-800/20 rounded-3xl p-2 md:p-4 border border-slate-100/50 dark:border-slate-800/50">
                           <OrderProgressBar status={order.status} />
                        </div>
                      )}

                      <div className="space-y-2 mb-6">
                        {order.items?.map((item: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-400">
                             <span className="text-brand">{item.quantity}x</span>
                             <span>{item.name}</span>
                          </div>
                        ))}
                      </div>
                      
                      {(order.notes || order.restaurantRequest) && (
                        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/50 flex items-start gap-3">
                           <MessageSquare size={16} className="text-slate-400 mt-0.5" />
                           <div className="text-left">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ma demande au restaurant</p>
                             <p className="text-xs text-slate-500 italic">"{order.notes || order.restaurantRequest}"</p>
                           </div>
                        </div>
                      )}

                      {order.status === 'ON_THE_WAY' && order.riderName && (
                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                              <User size={20} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-blue-400 dark:text-blue-500 uppercase tracking-widest leading-none mb-1">Livreur Assigné</p>
                              <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{order.riderName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                             <a 
                               href={`tel:+21612345678`}
                               className="p-2 bg-white dark:bg-slate-800 text-blue-500 rounded-xl shadow-sm border border-blue-100 dark:border-blue-900/50 hover:bg-blue-500 hover:text-white transition-all"
                             >
                               <Phone size={16} />
                             </a>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-6 pt-6 border-t border-slate-50 dark:border-slate-800">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total</p>
                          <p className="text-lg font-display font-black text-slate-900 dark:text-white">{order.total?.toFixed(2)} DT</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Paiement</p>
                          <p className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">{order.paymentMethod}</p>
                        </div>
                      </div>
                    </div>

                    {/* Actions & Live Status */}
                    <div className="md:w-64 flex flex-col justify-between items-end gap-6">
                      <div className={cn(
                        "px-4 py-2 rounded-2xl border flex items-center gap-2",
                        order.status === 'DELIVERED' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                        order.status === 'CANCELLED' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                        order.status === 'ON_THE_WAY' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                        "bg-brand/10 text-brand border-brand/20"
                      )}>
                        {order.status === 'DELIVERED' ? <CheckCircle2 size={14} /> : 
                         order.status === 'CANCELLED' ? <X size={14} /> : <Clock size={14} />}
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {order.status === 'DELIVERED' ? 'Livré' : 
                           order.status === 'CANCELLED' ? 'Annulé' :
                           order.status === 'ON_THE_WAY' ? 'En Route' : 
                           order.status === 'PREPARING' ? 'Préparation' : 'En Attente'}
                        </span>
                      </div>

                       {order.status !== 'DELIVERED' ? (
                        <button 
                          onClick={() => navigate(`/tracking?orderId=${order.id}`)}
                          className="w-full btn-primary flex items-center justify-center gap-3 py-4 rounded-2xl group shadow-xl shadow-brand/20"
                        >
                          <Bike size={18} className="group-hover:translate-x-1 transition-transform" />
                          <span className="font-black text-[11px] uppercase tracking-widest">Suivre en Direct</span>
                        </button>
                      ) : (
                        <div className="w-full flex flex-col gap-3">
                           {order.riderName && !order.riderRated && (
                             <button 
                               onClick={() => setRatingOrder(order)}
                               className="w-full py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-400/20 flex items-center justify-center gap-2"
                             >
                               <Star size={16} className="fill-slate-900" />
                               Notez le livreur
                             </button>
                           )}
                           <button 
                             onClick={() => navigate(`/stores`)}
                             className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                           >
                             Commander à nouveau
                           </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Rating Modal */}
      <AnimatePresence>
        {ratingOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRatingOrder(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg z-10"
            >
              <RiderRating 
                orderId={ratingOrder.id}
                riderId={ratingOrder.riderId || 'R1'}
                riderName={ratingOrder.riderName || 'Ahmed K.'}
                customerId={user.uid}
                onClose={() => setRatingOrder(null)}
                onSuccess={() => setRatingOrder(null)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
