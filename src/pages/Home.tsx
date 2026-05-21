import Hero from '../components/Hero';
import CategoryGrid from '../components/CategoryGrid';
import StoreSection from '../components/StoreSection';
import { MOCK_STORES } from '../constants';
import { motion, useInView, useMotionValue, useTransform, animate } from 'motion/react';
import { ShoppingBag, ChevronRight, Smartphone, Zap, Apple } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

function Counter({ value, duration = 2, decimals = 0, suffix = "" }: { value: number, duration?: number, decimals?: number, suffix?: string }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => {
    return latest.toFixed(decimals) + suffix;
  });
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (inView) {
      const controls = animate(count, value, { duration });
      return () => controls.stop();
    }
  }, [inView, count, value, duration]);

  return <motion.span ref={ref}>{rounded}</motion.span>;
}

export default function Home() {
  const [stores, setStores] = useState<any[]>(MOCK_STORES);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' 
        ? scrollLeft - clientWidth * 0.8 
        : scrollLeft + clientWidth * 0.8;
      
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };
  
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const q = query(collection(db, 'stores'), orderBy('createdAt', 'desc'), limit(10));
        const querySnapshot = await getDocs(q);
        const firestoreStores = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }));
        
        const combined = [...firestoreStores, ...MOCK_STORES].reduce((acc: any[], current: any) => {
          // Check if we already have this store by ID or by name
          const isDuplicate = acc.find(item => item.id === current.id || item.name === current.name);
          if (!isDuplicate) {
            return acc.concat([current]);
          }
          return acc;
        }, []);
        
        setStores(combined);
      } catch (error) {
        console.error("Error fetching home stores:", error);
      }
    };
    fetchStores();
  }, []);

  const foodStores = stores.filter(s => s.type === 'FOOD');
  const groceryStores = stores.filter(s => s.type === 'GROCERY');

  return (
    <div className="bg-slate-50">
      <Hero />
      
      <CategoryGrid />

      {/* Featured Offers Horizontal Scroll */}
      <section className="py-12 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
           <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-display font-bold text-slate-900">Offres Spéciales</h2>
              <div className="flex gap-2">
                 <button 
                  onClick={() => scroll('left')}
                  className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 cursor-pointer hover:bg-brand hover:text-white transition-all bg-white shadow-sm"
                 >
                    <ChevronRight size={18} className="rotate-180" />
                 </button>
                 <button 
                  onClick={() => scroll('right')}
                  className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 cursor-pointer hover:bg-brand hover:text-white transition-all bg-white shadow-sm"
                 >
                    <ChevronRight size={18} />
                 </button>
              </div>
           </div>
           
           <div 
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto pb-8 scrollbar-hide snap-x scroll-smooth"
           >
              {[
                { id: 'off-bk', t: '-50%', s: 'Burger King', c: 'bg-brand', d: 'Sur votre première commande' },
                { id: 'off-cf', t: 'Livraison Gratuite', s: 'Carrefour', c: 'bg-green-600', d: 'Commandes > 50 DT' },
                { id: 'off-el', t: 'Vente Flash', s: 'Électronique', c: 'bg-purple-600', d: 'Jusqu\'à -30% aujourd\'hui' },
                { id: 'off-ph', t: 'Nouveau Magasin', s: 'Pizza Hut', c: 'bg-orange-500', d: 'Cadeau d\'ouverture spécial' },
              ].map((offer) => (
                <motion.div 
                  key={offer.id}
                  whileHover={{ scale: 1.02 }}
                  className={cn("min-w-[300px] h-48 rounded-3xl p-8 flex flex-col justify-between text-white snap-center relative overflow-hidden", offer.c)}
                >
                   <div className="relative z-10">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">{offer.s}</p>
                      <h3 className="text-3xl font-display font-bold leading-none">{offer.t}</h3>
                      <p className="text-xs mt-2 opacity-90">{offer.d}</p>
                   </div>
                   <button className="relative z-10 w-fit px-4 py-2 bg-white/20 backdrop-blur-md rounded-xl text-[10px] font-bold uppercase tracking-wider border border-white/30 hover:bg-white/40 transition-all">
                      Claim Now
                   </button>
                   {/* Background Graphics */}
                   <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-12 translate-x-12" />
                   <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl translate-y-12 -translate-x-12" />
                </motion.div>
              ))}
           </div>
        </div>
      </section>
      
      {/* Featured Promo Banner */}
      <section className="py-8 md:py-12 px-4 md:px-8 max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative h-[280px] md:h-[320px] rounded-[32px] overflow-hidden bg-slate-900 group shadow-2xl"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-brand via-brand/80 to-transparent z-10 opacity-90" />
          <img 
            src="https://images.unsplash.com/photo-1512152272829-e3139592d56f?w=1600&q=80" 
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" 
            alt="Promo"
          />
          <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-20 text-white z-20">
             <span className="text-[9px] md:text-[10px] font-black tracking-[0.3em] uppercase mb-3 md:mb-4 bg-white/20 w-max px-3 md:px-4 py-1.5 rounded-full border border-white/20">Lancement FISA3 Mart</span>
             <h2 className="text-3xl md:text-5xl font-display font-extrabold mb-3 md:mb-4">Courses en <br className="md:hidden" /> <span className="text-yellow-400">15 mins</span></h2>
             <p className="text-white/70 max-w-sm mb-5 md:mb-6 text-xs md:text-base font-medium line-clamp-2 md:line-clamp-none">Tout ce dont vous avez besoin, livré plus vite que vous ne pouvez cuisiner. Livraison offerte aujourd'hui.</p>
             <button className="bg-white text-brand px-6 md:px-8 py-2.5 md:py-3 rounded-full font-bold text-xs md:text-sm w-max shadow-xl hover:bg-slate-50 transition-all active:scale-95">
                Acheter
             </button>
          </div>
          <div className="absolute right-10 top-1/2 -translate-y-1/2 flex space-x-4 opacity-50 z-10 hidden lg:flex">
             <div className="w-32 h-32 bg-white/10 rounded-[40px] blur-2xl animate-pulse" />
          </div>
        </motion.div>
      </section>

      <StoreSection title="Populaire près de chez vous" stores={foodStores} type="FOOD" />
      
      {/* App Download Promo */}
      <section className="py-16 md:py-24 overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col lg:flex-row items-center gap-12 md:gap-20">
           <div className="flex-1 space-y-8 md:space-y-10 text-center lg:text-left">
              <div className="space-y-4">
                 <h2 className="text-3xl md:text-6xl font-display font-extrabold text-slate-900 tracking-tight leading-tight">Tout dans votre poche.</h2>
                 <p className="text-sm md:text-lg text-slate-500 leading-relaxed max-w-xl font-medium mx-auto lg:mx-0">
                    Découvrez le moyen le plus rapide d'obtenir tout ce dont vous avez besoin en Tunisie. Téléchargez l'application FISA3 dès aujourd'hui et profitez d'offres exclusives et d'un suivi en temps réel.
                 </p>
              </div>
 
              <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                 <button className="flex items-center gap-3 md:gap-4 bg-slate-900 text-white px-6 md:px-8 py-3 md:py-4 rounded-[32px] md:rounded-[40px] hover:bg-slate-800 transition-all shadow-2xl shadow-slate-900/20 active:scale-95">
                    <Smartphone size={20} className="text-brand" />
                    <div className="flex flex-col items-start leading-none text-left">
                       <span className="text-[8px] md:text-[10px] font-black uppercase opacity-60 tracking-[0.1em]">Télécharger sur l'</span>
                       <span className="text-base md:text-lg font-bold">App Store</span>
                    </div>
                 </button>
                 <button className="flex items-center gap-3 md:gap-4 bg-slate-900 text-white px-6 md:px-8 py-3 md:py-4 rounded-[32px] md:rounded-[40px] hover:bg-slate-800 transition-all shadow-2xl shadow-slate-900/20 active:scale-95">
                    <Zap size={20} className="text-brand" />
                    <div className="flex flex-col items-start leading-none text-left">
                       <span className="text-[8px] md:text-[10px] font-black uppercase opacity-60 tracking-[0.1em]">Disponible sur</span>
                       <span className="text-base md:text-lg font-bold">Google Play</span>
                    </div>
                 </button>
              </div>
              
              <div className="pt-8 md:pt-10 border-t border-slate-100 flex items-center justify-center lg:justify-start gap-8 md:gap-12">
                 <div className="text-left leading-none">
                    <p className="text-3xl md:text-4xl font-display font-black text-slate-900 tracking-tighter">
                      <Counter value={4.9} decimals={1} suffix="/5" />
                    </p>
                    <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Trust Score</p>
                 </div>
                 <div className="w-px h-10 md:h-12 bg-slate-100" />
                 <div className="text-left leading-none">
                    <p className="text-3xl md:text-4xl font-display font-black text-slate-900 tracking-tighter">
                      <Counter value={1} suffix="M+" />
                    </p>
                    <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Active Users</p>
                 </div>
              </div>
           </div>
 
           <div className="flex-1 relative flex justify-center w-full max-w-sm md:max-w-none mx-auto lg:mx-0">
              <div className="relative z-10 grid grid-cols-2 gap-3 md:gap-4">
                 <motion.div 
                    animate={{ y: [0, -15, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="pt-10 md:pt-12"
                 >
                     <div className="w-full md:w-56 h-[300px] md:h-[440px] bg-slate-900 rounded-[32px] md:rounded-[48px] border-[4px] md:border-8 border-slate-900 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden">
                        <img 
                           src="https://i.postimg.cc/34JcyDgd/74425775-bdc6-4e89-8fc4-7946867330b7.png" 
                           className="w-full h-full object-cover" 
                           alt="App Mockup 1" 
                           referrerPolicy="no-referrer"
                        />
                     </div>
                  </motion.div>
                  <motion.div 
                     animate={{ y: [0, 15, 0] }}
                     transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  >
                     <div className="w-full md:w-56 h-[300px] md:h-[440px] bg-white rounded-[32px] md:rounded-[48px] border-[4px] md:border-8 border-slate-900 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden">
                        <img 
                           src="https://i.postimg.cc/tZCM1Vh7/2d77e515-97aa-465c-b2b6-b3619bcb7913.png" 
                           className="w-full h-full object-contain p-2" 
                           alt="App Mockup 2" 
                           referrerPolicy="no-referrer"
                        />
                     </div>
                 </motion.div>
              </div>
              
              {/* Background Shapes */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand/5 rounded-full blur-[100px] -z-0" />
              <div className="absolute -top-10 right-0 w-32 h-32 bg-brand/20 rounded-full blur-[50px]" />
           </div>
        </div>
      </section>

      <StoreSection title="Courses Fraîches" stores={groceryStores} type="GROCERY" />

      {/* Featured Marketplace Section Alternative */}
      <section className="py-12 md:py-20 bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
           <div className="bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-16 shadow-xl border border-slate-100 flex flex-col lg:flex-row items-center gap-10 md:gap-12">
              <div className="flex-1 text-center lg:text-left">
                 <div className="flex items-center justify-center lg:justify-start gap-2 text-brand font-bold uppercase tracking-widest text-[10px] md:text-xs mb-3 md:mb-4">
                   <ShoppingBag size={14} md:size={16} />
                   <span>Marché</span>
                 </div>
                 <h2 className="text-3xl md:text-4xl font-display font-bold text-slate-900 mb-4 md:mb-6 leading-tight">Électronique, Mode & Plus.</h2>
                 <p className="text-slate-500 text-sm md:text-lg mb-6 md:mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0">Commandez des milliers de produits de vos marques préférées, le tout sur une plateforme unique.</p>
                 <div className="flex justify-center lg:justify-start gap-4">
                    {[
                      { l: 'Electronics', i: 'Monitor' },
                      { l: 'Fashion', i: 'Shirt' },
                      { l: 'Home', i: 'Home' }
                    ].map((item) => (
                      <div key={item.l} className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-brand hover:bg-brand/5 transition-all cursor-pointer">
                           <Zap size={20} md:size={24} />
                        </div>
                        <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.l}</span>
                      </div>
                    ))}
                 </div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3 md:gap-6 w-full max-w-lg lg:w-auto mx-auto lg:mx-0">
                 <div className="space-y-3 md:space-y-6">
                    <img src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80" alt="Product" className="w-full aspect-square object-cover rounded-2xl md:rounded-3xl shadow-lg" />
                    <img src="https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=400&q=80" alt="Product" className="w-full aspect-[4/5] object-cover rounded-2xl md:rounded-3xl shadow-lg" />
                 </div>
                 <div className="space-y-3 md:space-y-6 pt-8 md:pt-12">
                    <img src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80" alt="Product" className="w-full aspect-square object-cover rounded-2xl md:rounded-3xl shadow-lg" />
                    <img src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80" alt="Product" className="w-full aspect-[4/3] object-cover rounded-2xl md:rounded-3xl shadow-lg" />
                 </div>
              </div>
           </div>
        </div>
      </section>
    </div>
  );
}
