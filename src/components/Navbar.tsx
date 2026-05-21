import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as LucideIcons from 'lucide-react';
import { 
  Menu, X, Search, ShoppingCart, User, MapPin, 
  ChevronDown, Bell, Globe, LayoutDashboard, Utensils, 
  ShoppingBag, Zap, Monitor, Smartphone, ChevronRight,
  Package, Bike, CheckCircle2, Info
} from 'lucide-react';
import { BRAND, CATEGORIES } from '../constants';
import { cn } from '../lib/utils';
import { useAuth } from '../services/auth';
import { useTheme } from '../context/ThemeContext';
import { useNavigate, Link } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc } from 'firebase/firestore';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('home');
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [orderNotification, setOrderNotification] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const path = `users/${user.uid}/notifications`;
    const q = query(
      collection(db, path),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setNotifications(notifs);
      
      // Auto-show toast for newest unread notification if it's very recent
      const newest = notifs[0];
      if (newest && !newest.read) {
        const createdAt = newest.createdAt?.toMillis() || 0;
        if (Date.now() - createdAt < 10000) { // last 10 seconds
          // Resolve icon for toast
          let icon = Info;
          const type = newest.type;
          
          if (type === 'ORDER_ACCEPTED' || type === 'ORDER_READY') icon = Package;
          else if (type === 'RIDER_ASSIGNED' || type === 'ORDER_PICKED_UP' || type === 'ON_THE_WAY') icon = Bike;
          else if (type === 'ORDER_DELIVERED') icon = CheckCircle2;

          setOrderNotification({ ...newest, icon });
          setTimeout(() => setOrderNotification(null), 8000);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, `users/${user.uid}/notifications`, notificationId), { read: true });
    } catch (e) {
      console.error("Error marking notification as read:", e);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300 h-16 flex items-center px-4 md:px-6 border-b",
      isScrolled 
        ? "bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-sm" 
        : "bg-white dark:bg-slate-900 border-transparent"
    )}>
      {/* Order Status Toast */}
      <AnimatePresence>
        {orderNotification && (
          <motion.div
            initial={{ opacity: 0, y: -100, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -100, x: '-50%' }}
            className="fixed top-0 left-1/2 z-[100] w-[90%] max-w-md"
          >
            <div 
              onClick={() => {
                navigate(`/tracking?orderId=${orderNotification.id}`);
                setOrderNotification(null);
              }}
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-6 rounded-[2rem] shadow-2xl border border-white/20 dark:border-slate-200 flex items-center gap-6 cursor-pointer hover:scale-[1.02] transition-transform"
            >
              <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center text-white shrink-0">
                <orderNotification.icon size={24} />
              </div>
              <div className="flex-1 text-left">
                <h4 className="font-display font-black text-lg tracking-tight leading-tight">{orderNotification.title}</h4>
                <p className="text-xs font-bold opacity-70 mt-1">{orderNotification.message}</p>
              </div>
              <div className="h-10 w-10 flex items-center justify-center bg-white/10 dark:bg-slate-900/10 rounded-full">
                <ChevronRight size={20} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-2 md:gap-8">
        {/* Left: Logo & Location */}
        <div className="flex items-center gap-4 md:gap-8 shrink-0">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <img src={BRAND.logo} alt="FISA3" className="h-7 w-7 md:h-8 md:w-8 object-contain" />
            <h1 className="font-display font-extrabold text-lg md:text-xl tracking-tight text-slate-900 dark:text-white">
              FISA<span className="text-brand">3</span>
            </h1>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-full border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-all group">
            <MapPin size={14} className="text-brand group-hover:scale-110 transition-transform" />
            <span className="text-[10px] md:text-xs font-semibold text-slate-700 dark:text-slate-300">Tunis, Ariana</span>
            <ChevronDown size={12} className="text-slate-400" />
          </div>
        </div>

        {/* Middle: Search - Hidden on very small mobiles, or smaller padding */}
        <div className="hidden md:flex flex-1 max-w-lg relative group">
          <input 
            type="text" 
            placeholder="Rechercher restaurants, courses..." 
            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-2 px-10 text-sm focus:ring-2 focus:ring-brand/10 transition-all outline-none dark:text-white text-slate-900"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand transition-colors" size={16} />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-1">
            <button 
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:text-brand hover:bg-brand/5 dark:text-slate-400 dark:hover:text-brand dark:hover:bg-brand/10 rounded-xl transition-all"
              title={theme === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div id="google_translate_element" className="ml-2 scale-90 origin-right"></div>
          </div>
          
          <div className="flex items-center gap-1.5 md:gap-2">
            {/* Notifications Bell */}
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={cn(
                  "relative w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all",
                  unreadCount > 0 ? "bg-brand/10 text-brand" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand"
                )}
              >
                <Bell size={18} className={cn(unreadCount > 0 && "animate-bounce")} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsNotificationsOpen(false)} 
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: -20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -20 }}
                      className="fixed inset-x-4 top-20 md:absolute md:top-full md:right-0 md:mt-3 md:w-96 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Notifications</h3>
                        <span className="text-[10px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full">{unreadCount} non lues</span>
                      </div>
                      
                      <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {notifications.length > 0 ? (
                          notifications.map((notif) => (
                            <div 
                              key={notif.id}
                              onClick={() => {
                                markAsRead(notif.id);
                                if (notif.orderId) navigate(`/tracking?orderId=${notif.orderId}`);
                                setIsNotificationsOpen(false);
                              }}
                              className={cn(
                                "p-4 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer flex gap-4",
                                !notif.read && "bg-brand/[0.02]"
                              )}
                            >
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                (notif.type === 'ORDER_ACCEPTED' || notif.type === 'ORDER_READY') ? "bg-emerald-500/10 text-emerald-500" :
                                (notif.type === 'ON_THE_WAY' || notif.type === 'RIDER_ASSIGNED' || notif.type === 'ORDER_PICKED_UP') ? "bg-brand/10 text-brand" : 
                                notif.type === 'ORDER_DELIVERED' ? "bg-blue-500/10 text-blue-500" :
                                "bg-slate-100 text-slate-500"
                              )}>
                                {(notif.type === 'ORDER_ACCEPTED' || notif.type === 'ORDER_READY') ? <Package size={18} /> : 
                                 (notif.type === 'ON_THE_WAY' || notif.type === 'RIDER_ASSIGNED' || notif.type === 'ORDER_PICKED_UP') ? <Bike size={18} /> : 
                                 notif.type === 'ORDER_DELIVERED' ? <CheckCircle2 size={18} /> : 
                                 <Info size={18} />}
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{notif.title}</p>
                                  {!notif.read && <div className="w-1.5 h-1.5 bg-brand rounded-full shrink-0" />}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{notif.message}</p>
                                <p className="text-[9px] font-black uppercase text-slate-400 mt-2 tracking-widest">
                                  {notif.createdAt?.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-12 text-center">
                            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                              <Bell size={24} />
                            </div>
                            <p className="text-xs font-bold text-slate-500">Aucune notification</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 text-center">
                        <button 
                          onClick={() => navigate('/orders')}
                          className="text-[10px] font-black uppercase tracking-widest text-brand hover:underline"
                        >
                          Voir mes commandes
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <button className="relative w-9 h-9 md:w-10 md:h-10 bg-brand/5 rounded-xl flex items-center justify-center text-brand hover:bg-brand/10 transition-all">
              <ShoppingCart size={18} />
              <span className="absolute -top-1 -right-1 bg-brand text-white text-[9px] md:text-[10px] font-bold w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm">3</span>
            </button>
            
            {user ? (
               <div className="flex items-center gap-2 group relative">
                 <button className="w-9 h-9 md:w-10 md:h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Utilisateur" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-brand text-white flex items-center justify-center text-sm font-black">
                        {user.email?.[0].toUpperCase() || user.phoneNumber?.[0] || 'U'}
                      </div>
                    )}
                 </button>
                 {/* Tooltip/Dropdown simulation */}
                 <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all transform translate-y-2 group-hover:translate-y-0 z-50">
                    <div className="p-2 border-b border-slate-50 dark:border-slate-800 mb-2">
                       <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Connecté en tant que</p>
                       <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.email || user.phoneNumber}</p>
                    </div>
                    <button 
                      onClick={() => { navigate('/orders'); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all text-slate-700 dark:text-slate-300"
                    >
                       <Package size={14} /> Mes Commandes
                    </button>
                    <button className="w-full flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all text-slate-700 dark:text-slate-300">
                       <User size={14} /> Profil
                    </button>
                    {isAdmin && (
                      <button 
                       onClick={() => navigate('/admin')}
                       className="w-full flex items-center gap-2 p-2 hover:bg-brand/5 text-brand rounded-xl text-xs font-bold transition-all"
                      >
                         <LayoutDashboard size={14} /> Tableau de bord Admin
                      </button>
                    )}
                    <button 
                      onClick={() => logout()}
                      className="w-full flex items-center gap-2 p-2 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-500 rounded-xl text-xs font-bold transition-all"
                    >
                       <X size={14} /> Déconnexion
                    </button>
                 </div>
               </div>
            ) : (
              <button 
                onClick={() => navigate('/auth')}
                className="flex items-center gap-2 bg-brand text-white rounded-xl px-4 py-2 md:px-6 md:py-2.5 cursor-pointer shadow-lg shadow-brand/25 hover:bg-brand/90 hover:shadow-brand/40 hover:-translate-y-0.5 transition-all active:scale-95 group font-bold tracking-tight"
              >
                <div className="w-5 h-5 md:w-6 md:h-6 bg-white/20 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform">
                  <User size={12} strokeWidth={3} />
                </div>
                <span className="text-xs md:text-sm hidden sm:inline">Se connecter</span>
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button 
              className="md:hidden p-2 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overflow */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 p-6 shadow-2xl md:hidden"
          >
            <div className="grid grid-cols-3 gap-4 mb-8">
              {CATEGORIES.map((cat) => {
                const Icon = (LucideIcons as any)[cat.icon] || LucideIcons.ShoppingBag;
                return (
                  <div key={cat.id} className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => { navigate(`/stores?type=${cat.id.toUpperCase()}`); setIsMenuOpen(false); }}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-50 dark:bg-slate-800 group-hover:bg-brand/10 transition-all text-slate-600 dark:text-slate-400 group-hover:text-brand dark:group-hover:text-brand">
                      <Icon size={24} />
                    </div>
                    <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">{cat.name}</span>
                  </div>
                );
              })}
            </div>
            
            <div className="space-y-4">
              <button 
                onClick={() => { navigate('/orders'); setIsMenuOpen(false); }}
                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all font-bold dark:text-white"
              >
                <div className="flex items-center gap-3">
                  <Package size={20} className="text-brand" />
                  <span>Mes Commandes</span>
                </div>
                <ChevronRight className="text-slate-400" size={18} />
              </button>
              <button 
                onClick={() => { toggleTheme(); setIsMenuOpen(false); }}
                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="text-brand">
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                  </div>
                  <span className="font-bold dark:text-white">{theme === 'dark' ? 'Mode Clair' : 'Mode Sombre'}</span>
                </div>
                <ChevronRight className="text-slate-400" size={18} />
              </button>
              <button className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
                <div className="flex items-center gap-3">
                  <LayoutDashboard size={20} className="text-brand" />
                  <span className="font-bold dark:text-white">Portail Marchand</span>
                </div>
                <ChevronRight className="text-slate-400" size={18} />
              </button>
              <button 
                onClick={() => { logout(); setIsMenuOpen(false); }}
                className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-all font-bold text-red-600 dark:text-red-400"
              >
                <div className="flex items-center gap-3">
                  <X size={20} />
                  <span>Déconnexion</span>
                </div>
                <ChevronRight className="text-slate-400" size={18} />
              </button>
              <button className="w-full flex items-center justify-center gap-2 p-4 bg-brand text-white rounded-2xl font-bold shadow-lg shadow-brand/20">
                Télécharger l'App
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
