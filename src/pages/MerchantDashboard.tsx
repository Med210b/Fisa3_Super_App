import React, { useState, useEffect } from 'react';
import { 
  Store, ShoppingCart, Package, 
  MapPin, Bell, Settings, LogOut, 
  CheckCircle2, Clock, X, AlertCircle,
  Plus, Trash2, Edit3, Save, ChevronRight,
  TrendingUp, Utensils, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { useAuth } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { 
  collection, query, where, onSnapshot, 
  doc, updateDoc, Timestamp, orderBy,
  getDocs, setDoc, deleteDoc, addDoc
} from 'firebase/firestore';
import { cn } from '../lib/utils';
import { BRAND, MOCK_STORES, MOCK_PRODUCTS_LIST } from '../constants';

export default function MerchantDashboard() {
  const { user, isMerchant, logout } = useAuth();
  const navigate = useNavigate();
  const [store, setStore] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'settings'>('orders');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [newOrderAlert, setNewOrderAlert] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  // Product Management Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    category: 'Burgers',
    image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&q=80',
    description: ''
  });

  // Auth Guard
  useEffect(() => {
    if (!loading && (!user || !isMerchant)) {
      navigate('/auth');
    }
  }, [user, isMerchant, loading, navigate]);

  // Load Merchant Store & Products
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        // 1. Get Store
        const storesRef = collection(db, 'stores');
        const qStore = query(storesRef, where('merchantId', '==', user.uid));
        const storeSnap = await getDocs(qStore);
        
        let merchantStore;
        if (storeSnap.empty) {
          // For demo: If no store, assign the first mock store to this merchant
          const mockStore = MOCK_STORES[0];
          await setDoc(doc(db, 'stores', mockStore.id), {
            ...mockStore,
            merchantId: user.uid,
            merchantEmail: user.email,
            createdAt: Timestamp.now()
          });
          merchantStore = { ...mockStore, id: mockStore.id };
        } else {
          merchantStore = { id: storeSnap.docs[0].id, ...storeSnap.docs[0].data() };
        }
        setStore(merchantStore);

        // 2. Get Products
        const productsRef = collection(db, 'products');
        const qProducts = query(productsRef, where('storeId', '==', merchantStore.id));
        const productsSnap = await getDocs(qProducts);
        
        if (productsSnap.empty) {
          // Seed mock products if empty
          const mockProds = MOCK_PRODUCTS_LIST.filter(p => p.storeId === 's1'); // Use s1's products for testing
          for (const p of mockProds) {
            await setDoc(doc(db, 'products', p.id), {
              ...p,
              storeId: merchantStore.id,
              status: 'AVAILABLE'
            });
          }
          setProducts(mockProds.map(p => ({ ...p, storeId: merchantStore.id })));
        } else {
          setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }

        setLoading(false);
      } catch (err: any) {
        console.error("Error loading merchant data:", err);
        setError("Failed to load store data");
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Listen for Orders
  useEffect(() => {
    if (!store) return;

    const path = 'orders';
    const q = query(
      collection(db, path), 
      where('storeId', '==', store.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" && change.doc.data().status === 'PENDING') {
          // New Order Notification
          const newOrder = change.doc.data();
          const orderId = change.doc.id;
          
          // Check if it's very recent to avoid toast on first load
          const createdAt = newOrder.createdAt?.toMillis() || 0;
          if (Date.now() - createdAt < 30000) { // last 30 seconds
            setNewOrderAlert({ id: orderId, ...newOrder });
            setTimeout(() => setNewOrderAlert(null), 10000);

            try {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
              audio.volume = 0.5;
              audio.play();
            } catch (e) {}
          }

          setNotifications(prev => [{
            id: orderId,
            title: 'Nouvelle Commande!',
            message: `De ${newOrder.customerName} - ${newOrder.total} DT`,
            time: 'Maintenant',
            orderId: orderId
          }, ...prev]);
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [store]);

  const handleAcceptOrder = async (orderId: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = orders.find(o => o.id === orderId);
      
      await updateDoc(orderRef, {
        status: 'ACCEPTED_BY_STORE',
        acceptedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Send notification to customer
      if (orderSnap && orderSnap.customerId) {
        await addDoc(collection(db, `users/${orderSnap.customerId}/notifications`), {
          title: "Commande Confirmée",
          message: `Le restaurant ${store.name} a commencé à préparer votre commande.`,
          type: "ORDER_ACCEPTED",
          orderId: orderId,
          createdAt: Timestamp.now(),
          read: false
        });
      }
      
      // Auto-transition to preparing after a short delay for UX
      setTimeout(async () => {
        await updateDoc(orderRef, {
          status: 'PREPARING',
          updatedAt: Timestamp.now()
        });
      }, 2000);

    } catch (err: any) {
      setError("Erreur d'acceptation: " + err.message);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    
    try {
      const productData = {
        ...productForm,
        price: parseFloat(productForm.price),
        storeId: store.id,
        status: 'AVAILABLE',
        updatedAt: Timestamp.now()
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...productData } : p));
      } else {
        const docRef = await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: Timestamp.now()
        });
        setProducts(prev => [{ id: docRef.id, ...productData }, ...prev]);
      }

      setIsModalOpen(false);
      setEditingProduct(null);
      setProductForm({ name: '', price: '', category: 'Burgers', image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&q=80', description: '' });
    } catch (err: any) {
      setError("Erreur lors de l'enregistrement: " + err.message);
    }
  };

  const handleDeleteProduct = (product: any) => {
    setProductToDelete(product);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await deleteDoc(doc(db, 'products', productToDelete.id));
      setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
      setProductToDelete(null);
    } catch (err) {
      setError("Erreur lors de la suppression");
      setProductToDelete(null);
    }
  };

  const handleToggleProduct = async (productId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
      await updateDoc(doc(db, 'products', productId), {
        status: newStatus
      });
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, status: newStatus } : p));
    } catch (err) {
      setError("Erreur mise à jour produit");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  if (loading || !store) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
        <p className="text-slate-400 font-display font-black uppercase tracking-[0.3em] animate-pulse">Initialisation Partner Portal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-brand selection:text-white">
      {/* New Order Alert Toast */}
      <AnimatePresence>
        {newOrderAlert && (
          <motion.div
            initial={{ opacity: 0, y: -100, x: '-50%' }}
            animate={{ opacity: 1, y: 32, x: '-50%' }}
            exit={{ opacity: 0, y: -100, x: '-50%' }}
            className="fixed top-0 left-1/2 z-[100] w-[90%] max-w-md"
          >
            <div 
              onClick={() => {
                setActiveTab('orders');
                setNewOrderAlert(null);
              }}
              className="bg-brand text-white p-6 rounded-[2rem] shadow-2xl shadow-brand/40 flex items-center gap-6 cursor-pointer hover:scale-[1.02] transition-transform border border-white/20"
            >
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shrink-0">
                <Bell className="animate-bounce" size={24} />
              </div>
              <div className="flex-1 text-left">
                <h4 className="font-display font-black text-lg tracking-tight leading-tight uppercase">Nouvelle Commande!</h4>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mt-1">De {newOrderAlert.customerName} • {newOrderAlert.total} DT</p>
              </div>
              <div className="h-10 w-10 flex items-center justify-center bg-black/10 rounded-full">
                <ChevronRight size={20} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar / Navigation - Hidden on mobile, Bottom nav on mobile */}
      <nav className="fixed left-0 top-0 bottom-0 w-24 bg-slate-900 border-r border-slate-800 hidden md:flex flex-col items-center py-10 z-[60]">
        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-emerald-500/20 mb-12">
          <Utensils size={24} />
        </div>

        <div className="flex-1 flex flex-col gap-8">
          {[
            { id: 'orders', icon: ShoppingCart, label: 'Orders' },
            { id: 'menu', icon: Package, label: 'Disponibilité' },
            { id: 'settings', icon: Settings, label: 'Paramètres' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "p-4 rounded-2xl transition-all duration-300 relative group",
                activeTab === item.id ? "bg-white text-slate-950" : "text-slate-500 hover:text-white hover:bg-slate-800"
              )}
            >
              <item.icon size={22} />
              <span className="absolute left-full ml-4 px-3 py-1 bg-white text-slate-900 text-[10px] font-black rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl">
                {item.label}
              </span>
            </button>
          ))}
        </div>

        <button 
          onClick={handleLogout}
          className="p-4 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all"
        >
          <LogOut size={22} />
        </button>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 p-2 flex items-center justify-around md:hidden z-[60] pb-safe-offset-2">
        {[
          { id: 'orders', icon: ShoppingCart, label: 'Orders' },
          { id: 'menu', icon: Package, label: 'Menu' },
          { id: 'settings', icon: Settings, label: 'Settings' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={cn(
              "flex flex-col items-center gap-1 p-3 rounded-2xl transition-all",
              activeTab === item.id ? "text-brand bg-brand/10 font-bold" : "text-slate-500"
            )}
          >
            <item.icon size={20} />
            <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
        <button 
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 p-3 text-slate-500"
        >
          <LogOut size={20} />
          <span className="text-[9px] font-black uppercase tracking-widest">Sortir</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <div className="md:pl-24 p-4 md:p-10 max-w-7xl mx-auto min-h-screen flex flex-col gap-6 md:gap-10 pb-24 md:pb-10">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="text-left">
            <h1 className="text-2xl md:text-4xl font-display font-black tracking-tighter text-white uppercase">{store.name}</h1>
            <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Restaurant Ouvert
              </span>
              <span className="text-slate-500 text-[10px] md:text-xs font-medium md:border-l md:border-slate-800 md:pl-4">{store.address}</span>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
             <div className="bg-slate-900 px-4 py-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-800 flex items-center gap-4 md:gap-6 flex-1 md:flex-none">
                <div className="text-left md:text-right">
                  <p className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">Revenu (J)</p>
                  <p className="text-lg md:text-xl font-display font-black">{orders.reduce((acc, o) => acc + (o.status === 'DELIVERED' ? o.total : 0), 0).toFixed(0)} DT</p>
                </div>
                <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
                  <TrendingUp size={16} md:size={20} />
                </div>
             </div>
             <button className="p-3 md:p-4 bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 md:hidden">
               <Bell size={20} />
             </button>
          </div>
        </header>

        {/* Tab Content */}
        <div className="flex-1">
          {activeTab === 'orders' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
              {/* Active Orders List */}
              <div className="lg:col-span-8 space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-display font-black uppercase text-white tracking-widest">Commandes en Cours</h2>
                  <span className="bg-brand text-white px-3 py-1 rounded-full text-[10px] font-black">{orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length} ACTIVES</span>
                </div>

                <div className="space-y-4">
                  {orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').map(order => (
                    <motion.div 
                      layoutId={order.id}
                      key={order.id} 
                      className="bg-slate-900 rounded-[32px] border border-slate-800 p-6 hover:border-brand/40 transition-all group"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0",
                            order.status === 'PENDING' ? "bg-amber-500 shadow-amber-500/20" : "bg-emerald-500 shadow-emerald-500/20"
                          )}>
                            <Package size={20} />
                          </div>
                          <div className="text-left overflow-hidden">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Commande #{order.id.slice(-6).toUpperCase()}</p>
                            <p className="text-base md:text-lg font-bold text-white uppercase truncate">{order.customerName}</p>
                            {order.riderName && (
                              <p className="text-[10px] font-medium text-brand mt-0.5">Livreur: {order.riderName}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1">
                          <p className="text-xl md:text-2xl font-display font-black text-white">{order.total} DT</p>
                          <div className={cn(
                             "flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider",
                             order.status === 'PENDING' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : 
                             order.status === 'ACCEPTED_BY_STORE' || order.status === 'PREPARING' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                             order.status === 'READY_FOR_PICKUP' ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                             "bg-purple-500/10 text-purple-500 border border-purple-500/20"
                          )}>
                            {(order.status === 'PREPARING' || order.status === 'OUT_FOR_DELIVERY') && (
                              <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse shrink-0" />
                            )}
                            {order.status === 'PENDING' ? 'Nouvelle Commande' : 
                             order.status === 'ACCEPTED_BY_STORE' ? 'Confirmée' :
                             order.status === 'PREPARING' ? 'En Cuisine' :
                             order.status === 'READY_FOR_PICKUP' ? 'Prêt / Attend Livreur' :
                             order.status === 'ASSIGNED' ? 'Livreur Assigné' :
                             order.status === 'CONFIRMED' ? 'Livreur en Chemin' :
                             order.status === 'PICKED_UP' ? 'Récupérée' :
                             order.status === 'OUT_FOR_DELIVERY' ? 'En Livraison' :
                             order.status === 'DELIVERED' ? 'Livrée' : order.status}
                          </div>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="bg-slate-950/50 rounded-2xl p-4 space-y-3 mb-6">
                        {order.items?.map((item: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-slate-300"><span className="font-black text-brand mr-2">{item.quantity}x</span> {item.name}</span>
                            <span className="text-slate-500 font-medium">{item.price} DT</span>
                          </div>
                        ))}
                      </div>

                  {/* Special Request / Notes */}
                      {(order.notes || order.restaurantRequest) && (
                        <div className="mb-6 bg-amber-500/10 border border-amber-500/20 p-5 rounded-[24px] flex items-start gap-4">
                           <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500 shrink-0">
                              <MessageSquare size={20} />
                           </div>
                           <div className="text-left">
                             <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Instruction Spéciale du Client</p>
                             <p className="text-sm text-slate-200 font-medium italic leading-relaxed">
                               "{order.notes || order.restaurantRequest}"
                             </p>
                           </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        {order.status === 'PENDING' && (
                          <button 
                            onClick={() => handleAcceptOrder(order.id)}
                            className="flex-1 py-4 bg-white text-slate-950 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 size={18} />
                            Confirmer la commande
                          </button>
                        )}
                        {order.status === 'ACCEPTED_BY_STORE' && (
                          <div className="w-full py-4 bg-emerald-500/10 text-emerald-500 rounded-2xl text-center font-black uppercase tracking-widest border border-emerald-500/20 flex items-center justify-center gap-3">
                             <div className="w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                             Préparation confirmée...
                          </div>
                        )}
                        {order.status === 'PREPARING' && (
                           <button 
                             onClick={async () => {
                               try {
                                 await updateDoc(doc(db, 'orders', order.id), { 
                                   status: 'READY_FOR_PICKUP',
                                   updatedAt: Timestamp.now()
                                 });

                                 // Notify available riders
                                 const ridersRef = collection(db, 'riders');
                                 const qRiders = query(ridersRef, where('isOnline', '==', true), where('status', '==', 'IDLE'));
                                 const ridersSnap = await getDocs(qRiders);
                                 
                                 const notificationData = {
                                   title: "Nouvelle Mission Disponible!",
                                   message: `Récupération chez ${store.name} pour ${order.customerName}`,
                                   type: "MISSION_OFFER",
                                   orderId: order.id,
                                   storeName: store.name,
                                   customerName: order.customerName,
                                   total: order.total,
                                   createdAt: Timestamp.now(),
                                   read: false
                                 };

                                 for (const riderDoc of ridersSnap.docs) {
                                   await addDoc(collection(db, `riders/${riderDoc.id}/notifications`), notificationData);
                                 }

                                 // Notify customer
                                 if (order.customerId) {
                                   await addDoc(collection(db, `users/${order.customerId}/notifications`), {
                                     title: "Commande Prête !",
                                     message: `Votre commande chez ${store.name} est prête et un livreur va la récupérer.`,
                                     type: "ORDER_READY",
                                     orderId: order.id,
                                     createdAt: Timestamp.now(),
                                     read: false
                                   });
                                 }
                               } catch (err: any) {
                                 setError("Erreur ready for pickup: " + err.message);
                               }
                             }}
                             className="flex-1 py-4 bg-brand text-white rounded-2xl font-black uppercase tracking-widest hover:bg-brand/80 transition-all flex items-center justify-center gap-2"
                           >
                             <CheckCircle2 size={18} />
                              Prêt pour Livraison
                           </button>
                        )}
                        <button 
                          onClick={() => setSelectedOrder(order)}
                          className="p-4 bg-slate-800 text-slate-400 rounded-2xl hover:text-white hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                        >
                          <ChevronRight size={20} />
                          <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Détails</span>
                        </button>
                        <button className="p-4 bg-slate-800 text-slate-400 rounded-2xl hover:text-white hover:bg-slate-700 transition-all">
                          <AlertCircle size={20} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  {orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length === 0 && (
                    <div className="p-12 text-center bg-slate-900/50 rounded-[40px] border border-dashed border-slate-800">
                      <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-600 mx-auto mb-4">
                        <ShoppingCart size={32} />
                      </div>
                      <p className="text-slate-500 font-bold">Aucune commande active actuellement.</p>
                      <p className="text-slate-600 text-xs mt-1">Les nouvelles commandes apparaîtront ici.</p>
                    </div>
                  )}

                  {/* Completed Orders History */}
                  {orders.filter(o => o.status === 'DELIVERED' || o.status === 'CANCELLED').length > 0 && (
                    <div className="mt-12 space-y-6">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-display font-black uppercase text-slate-500 tracking-widest">Historique Récent</h2>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{orders.filter(o => o.status === 'DELIVERED' || o.status === 'CANCELLED').length} TERMINÉES</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {orders.filter(o => o.status === 'DELIVERED' || o.status === 'CANCELLED').slice(0, 4).map(order => (
                          <div 
                            key={order.id}
                            className="bg-slate-900/40 border border-slate-800/50 rounded-3xl p-5 flex items-center justify-between group hover:bg-slate-900 transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center text-white",
                                order.status === 'DELIVERED' ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
                              )}>
                                <CheckCircle2 size={18} />
                              </div>
                              <div className="text-left">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">#{order.id.slice(-6).toUpperCase()}</p>
                                <p className="text-sm font-bold text-white line-clamp-1">{order.customerName}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black">{order.total} DT</p>
                              <p className={cn(
                                "text-[9px] font-black uppercase tracking-widest mt-1",
                                order.status === 'DELIVERED' ? "text-emerald-500" : "text-red-500"
                              )}>
                                {order.status === 'DELIVERED' ? 'LIVRÉ' : 'ANNULÉ'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar: Notifications & Stats */}
              <div className="lg:col-span-4 space-y-8">
                 <div className="bg-white rounded-[40px] p-8 text-slate-950 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand/10 rounded-full -mr-16 -mt-16 blur-3xl transition-all group-hover:scale-150" />
                    <h3 className="text-2xl font-display font-black mb-1">Résumé</h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8">Dernières 24 heures</p>
                    
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                         <span className="text-sm font-bold text-slate-500">Commandes</span>
                         <span className="text-xl font-display font-black">{orders.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-sm font-bold text-slate-500">Taux d'acceptation</span>
                         <span className="text-xl font-display font-black text-emerald-600">100%</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-sm font-bold text-slate-500">Temps moyen prép.</span>
                         <span className="text-xl font-display font-black">12 min</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setActiveTab('menu')}
                      className="w-full mt-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-brand transition-all flex items-center justify-center gap-2"
                    >
                      <Package size={18} /> Gérer le Menu
                    </button>
                 </div>

                 <div className="bg-slate-900 rounded-[40px] p-6 md:p-8 border border-slate-800">
                    <h3 className="text-lg font-display font-black uppercase mb-6">Notifications</h3>
                    <div className="space-y-4">
                      {notifications.length > 0 ? notifications.map(notif => (
                        <div key={notif.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl relative overflow-hidden">
                           <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand" />
                           <p className="text-xs font-black text-white">{notif.title}</p>
                           <p className="text-[10px] text-slate-500 mt-1">{notif.message}</p>
                           <p className="text-[9px] text-brand font-bold mt-2 uppercase">{notif.time}</p>
                        </div>
                      )) : (
                        <p className="text-center text-slate-600 py-4 text-xs italic">Pas de nouvelles alertes</p>
                      )}
                    </div>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'menu' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-display font-black uppercase">Gestion du Menu</h2>
                    <p className="text-slate-500 text-sm mt-1">Mettez à jour la disponibilité de vos plats en temps réel.</p>
                  </div>
                  <button className="bg-brand text-white px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase tracking-widest hover:bg-brand/80 transition-all flex items-center justify-center gap-3">
                    <Plus size={20} /> Nouveau Plat
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {products.map(product => (
                   <div key={product.id} className={cn(
                     "bg-slate-900 border rounded-[32px] p-6 transition-all",
                     product.status === 'AVAILABLE' ? "border-slate-800" : "border-red-900/30 opacity-70"
                   )}>
                     <div className="flex gap-4 mb-6">
                        <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-slate-800">
                           <img src={product.image} className="w-full h-full object-cover" />
                        </div>
                        <div className="text-left flex-1">
                           <p className="text-[10px] font-black text-brand uppercase tracking-widest">{product.category}</p>
                           <h3 className="text-lg font-bold text-white mb-1">{product.name}</h3>
                           <p className="text-xl font-display font-black">{product.price} DT</p>
                        </div>
                     </div>

                     <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleToggleProduct(product.id, product.status)}
                          className={cn(
                          "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                          product.status === 'AVAILABLE' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                        )}>
                          {product.status === 'AVAILABLE' ? <><CheckCircle2 size={14} /> Disponible</> : <><X size={14} /> En Rupture</>}
                        </button>
                        <button className="p-3 bg-slate-800 text-slate-400 rounded-xl hover:text-white transition-all">
                           <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(product)}
                          className="p-3 bg-slate-800/50 text-slate-600 rounded-xl hover:text-red-500 transition-all"
                        >
                           <Trash2 size={18} />
                        </button>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-display font-black uppercase">Configuration du Menu</h2>
                    <p className="text-slate-500 text-sm mt-1">Gérez les articles de votre catalogue {store?.name}.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingProduct(null);
                      setProductForm({ name: '', price: '', category: 'Burgers', image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&q=80', description: '' });
                      setIsModalOpen(true);
                    }}
                    className="bg-emerald-500 text-white px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20"
                  >
                    <Plus size={20} /> Ajouter un Article
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {products.map(product => (
                   <motion.div 
                     layout
                     key={product.id} 
                     className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 group hover:border-emerald-500/30 transition-all"
                   >
                     <div className="flex gap-4 mb-6">
                        <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-slate-800 bg-slate-950">
                           <img src={product.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <div className="text-left flex-1">
                           <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{product.category}</p>
                           <h3 className="text-lg font-bold text-white mb-1 line-clamp-1">{product.name}</h3>
                           <p className="text-xl font-display font-black">{product.price} DT</p>
                        </div>
                     </div>

                     <div className="flex items-center gap-3">
                        <button 
                          onClick={() => {
                            setEditingProduct(product);
                            setProductForm({
                              name: product.name,
                              price: product.price.toString(),
                              category: product.category,
                              image: product.image,
                              description: product.description || ''
                            });
                            setIsModalOpen(true);
                          }}
                          className="flex-1 py-3 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                        >
                          <Edit3 size={14} /> Modifier
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(product)}
                          className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                        >
                           <Trash2 size={18} />
                        </button>
                     </div>
                   </motion.div>
                 ))}
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[40px] overflow-hidden relative shadow-2xl"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-display font-black uppercase text-white">
                    {editingProduct ? 'Modifier Article' : 'Nouvel Article'}
                  </h2>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSaveProduct} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Nom du plat</label>
                    <input 
                      required
                      value={productForm.name}
                      onChange={e => setProductForm({...productForm, name: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white focus:border-emerald-500 outline-none transition-all"
                      placeholder="Ex: Double Whopper Cheese"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Prix (DT)</label>
                      <input 
                        required
                        type="number"
                        step="0.001"
                        value={productForm.price}
                        onChange={e => setProductForm({...productForm, price: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white focus:border-emerald-500 outline-none transition-all"
                        placeholder="15.500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Catégorie</label>
                      <select 
                        value={productForm.category}
                        onChange={e => setProductForm({...productForm, category: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white focus:border-emerald-500 outline-none transition-all appearance-none"
                      >
                        <option>Burgers</option>
                        <option>Pizzas</option>
                        <option>Entrées</option>
                        <option>Boissons</option>
                        <option>Desserts</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">URL de l'image (Photo du plat)</label>
                    <input 
                      required
                      value={productForm.image}
                      onChange={e => setProductForm({...productForm, image: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white focus:border-emerald-500 outline-none transition-all"
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>

                  <button className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-500/20 active:scale-95 mt-4">
                    {editingProduct ? 'Mettre à jour' : 'Ajouter au catalogue'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {productToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setProductToDelete(null)}
              className="absolute inset-0 bg-slate-950/95 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[40px] overflow-hidden relative shadow-2xl p-8"
            >
              <div className="text-center">
                <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={40} />
                </div>
                <h2 className="text-2xl font-display font-black uppercase text-white mb-2">Confirmation</h2>
                <p className="text-slate-400 mb-8 px-4">
                  Voulez-vous vraiment supprimer <span className="text-white font-bold">"{productToDelete.name}"</span> du menu ? Cette action est irréversible.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setProductToDelete(null)}
                    className="py-4 bg-slate-800 text-slate-400 rounded-2xl font-black uppercase tracking-widest hover:text-white transition-all"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-xl shadow-red-500/20"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-slate-950/95 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[40px] overflow-hidden relative shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-brand/10 text-brand rounded-2xl flex items-center justify-center">
                    <Package size={28} />
                  </div>
                  <div className="text-left">
                    <h2 className="text-2xl font-display font-black uppercase text-white tracking-tight">Commande #{selectedOrder.id.slice(-6).toUpperCase()}</h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                      Reçue le {selectedOrder.createdAt?.toDate().toLocaleDateString('fr-FR')} à {selectedOrder.createdAt?.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-8 overflow-y-auto space-y-8 flex-1 custom-scrollbar">
                {/* Status & Customer Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-950/50 rounded-3xl p-6 border border-slate-800">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Informations Client</p>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
                        <Utensils size={20} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white uppercase">{selectedOrder.customerName}</p>
                        <p className="text-sm font-medium text-slate-400">{selectedOrder.customerPhone || "Numéro non fourni"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-slate-400 text-sm">
                       <MapPin size={16} className="shrink-0 mt-0.5 text-brand" />
                       <p>{selectedOrder.deliveryAddress || "À emporter"}</p>
                    </div>
                  </div>

                  <div className="bg-slate-950/50 rounded-3xl p-6 border border-slate-800 flex flex-col justify-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Statut Actuel</p>
                    <div className={cn(
                      "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest w-fit",
                      selectedOrder.status === 'PENDING' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : 
                      selectedOrder.status === 'DELIVERED' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                      "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                    )}>
                       <div className="w-2 h-2 bg-current rounded-full" />
                       {selectedOrder.status}
                    </div>

                    {selectedOrder.riderId && selectedOrder.status !== 'DELIVERED' && selectedOrder.status !== 'CANCELLED' && (
                      <button 
                        onClick={() => navigate(`/tracking?orderId=${selectedOrder.id}`)}
                        className="mt-4 flex items-center gap-3 text-brand hover:text-brand/80 transition-all text-xs font-black uppercase tracking-widest group bg-brand/10 p-3 rounded-2xl border border-brand/20"
                      >
                        <div className="w-8 h-8 bg-brand text-white rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform shadow-lg shadow-brand/20">
                          <MapPin size={16} />
                        </div>
                        Suivre le livreur en direct
                      </button>
                    )}

                    <p className="text-[10px] text-slate-600 font-bold mt-4 uppercase">Dernière mise à jour: {selectedOrder.updatedAt?.toDate().toLocaleTimeString('fr-FR')}</p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="space-y-4">
                   <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Détails du Panier</h3>
                   <div className="bg-slate-950/50 rounded-3xl overflow-hidden border border-slate-800">
                      <table className="w-full text-left">
                        <thead className="bg-slate-800/50">
                          <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                            <th className="px-6 py-4">Article</th>
                            <th className="px-6 py-4 text-center">Quantité</th>
                            <th className="px-6 py-4 text-right">Prix Unit.</th>
                            <th className="px-6 py-4 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {selectedOrder.items?.map((item: any, idx: number) => (
                            <tr key={idx} className="group hover:bg-slate-800/30 transition-all">
                              <td className="px-6 py-4 font-bold text-white">{item.name}</td>
                              <td className="px-6 py-4 text-center font-black text-brand">{item.quantity}</td>
                              <td className="px-6 py-4 text-right text-slate-400">{item.price} DT</td>
                              <td className="px-6 py-4 text-right font-black text-white">{(item.price * item.quantity).toFixed(3)} DT</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-800/30">
                           <tr>
                              <td colSpan={3} className="px-6 py-6 text-right font-black text-slate-500 uppercase tracking-widest">Sous-Total</td>
                              <td className="px-6 py-6 text-right font-display font-black text-2xl text-white">{selectedOrder.total} DT</td>
                           </tr>
                        </tfoot>
                      </table>
                   </div>
                </div>

                {/* Special Requests */}
                {selectedOrder.notes && (
                  <div className="bg-amber-500/10 border border-amber-500/20 p-8 rounded-[40px] flex items-start gap-6">
                    <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500 shrink-0">
                      <MessageSquare size={28} />
                    </div>
                    <div>
                      <h4 className="text-lg font-display font-black text-amber-500 uppercase mb-2">Note du Client</h4>
                      <p className="text-slate-200 font-medium italic text-lg leading-relaxed">
                        "{selectedOrder.notes}"
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="p-8 bg-slate-950/50 border-t border-white/5 shrink-0">
                <div className="flex items-center gap-4">
                  {selectedOrder.status === 'PENDING' && (
                    <button 
                      onClick={() => {
                        handleAcceptOrder(selectedOrder.id);
                        setSelectedOrder(null);
                      }}
                      className="flex-1 py-5 bg-emerald-500 text-white rounded-[24px] font-black uppercase tracking-widest transition-all hover:bg-emerald-400 shadow-xl shadow-emerald-500/20 active:scale-95"
                    >
                      Confirmer & Commencer
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedOrder(null)}
                    className="px-10 py-5 bg-slate-800 text-slate-400 rounded-[24px] font-black uppercase tracking-widest hover:text-white transition-all active:scale-95"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {newOrderAlert && (
          <motion.div 
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="fixed top-10 right-10 z-[200] w-96 bg-white dark:bg-slate-900 border border-slate-100 dark:border-brand/30 rounded-[40px] shadow-2xl overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => {
              setSelectedOrder(newOrderAlert);
              setNewOrderAlert(null);
            }}
          >
            <div className="absolute top-0 left-0 w-2 h-full bg-brand" />
            <div className="p-8 flex items-center gap-6">
              <div className="w-16 h-16 bg-brand/10 text-brand rounded-2xl flex items-center justify-center shrink-0">
                <Bell size={32} className="animate-tada" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-xl font-display font-black uppercase text-slate-900 dark:text-white tracking-tight">Nouvelle Commande !</h4>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase truncate">{newOrderAlert.customerName}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-black bg-brand/10 text-brand px-2 py-0.5 rounded-full">{newOrderAlert.total} DT</span>
                  <span className="text-[10px] font-bold text-slate-400">À l'instant</span>
                </div>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setNewOrderAlert(null);
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-10 right-10 bg-red-500 text-white p-6 rounded-3xl shadow-2xl flex items-center gap-4 z-[200]"
          >
             <AlertCircle size={24} />
             <p className="font-bold">{error}</p>
             <button onClick={() => setError(null)} className="ml-4 p-2 hover:bg-white/20 rounded-full">
               <X size={18} />
             </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
