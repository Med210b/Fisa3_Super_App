import { useState, MouseEvent } from 'react';
import { Star, Clock, MapPin, Zap, ChevronRight, Plus, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Store } from '../types';
import { formatCurrency, cn } from '../lib/utils';

interface StoreCardProps {
  store: Store;
}

export function StoreCard({ store }: StoreCardProps) {
  const navigate = useNavigate();
  const [added, setAdded] = useState(false);

  const handleQuickAdd = (e: MouseEvent) => {
    e.stopPropagation();
    if (added) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <motion.div 
      initial={false}
      animate={added ? { scale: [1, 1.02, 1], transition: { duration: 0.3 } } : {}}
      whileHover={{ y: -4, shadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
      onClick={() => navigate(`/store/${store.id}`)}
      className="bg-white dark:bg-slate-900 rounded-[24px] md:rounded-[32px] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 flex h-[120px] md:h-[140px] group transition-all cursor-pointer"
    >
      <div className="w-[100px] md:w-[140px] shrink-0 relative overflow-hidden bg-white dark:bg-white p-2">
        <img 
          src={store.image} 
          alt={store.name} 
          className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110" 
        />
        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          {store.rating > 4.5 && (
            <div className="bg-brand text-white px-2 py-0.5 rounded-lg text-[7px] md:text-[8px] font-black uppercase tracking-widest shadow-lg w-max">
              Top
            </div>
          )}
        </div>
        
        {/* Quick Add Button */}
        <button 
          onClick={handleQuickAdd}
          className={cn(
            "absolute bottom-2 right-2 w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center transition-all duration-300 shadow-xl",
            added ? "bg-green-500 text-white" : "bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-brand hover:bg-brand hover:text-white"
          )}
        >
          <AnimatePresence mode="wait">
            {added ? (
              <motion.div
                key="check"
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 45 }}
              >
                <Check size={16} />
              </motion.div>
            ) : (
              <motion.div
                key="plus"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Plus size={18} />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>
      
      <div className="p-3 md:p-4 flex-1 flex flex-col justify-between overflow-hidden">
        <div className="space-y-0.5 md:space-y-1">
          <div className="flex justify-between items-start gap-1">
            <h3 className="font-display font-bold text-xs md:text-sm text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-brand transition-colors">{store.name}</h3>
            <span className="bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-500 text-[8px] md:text-[10px] px-1.5 py-0.5 rounded-lg font-black flex items-center gap-0.5 shrink-0">
               <Star size={8} className="fill-green-700 dark:fill-green-500" />
               {store.rating}
            </span>
          </div>
          <p className="text-[9px] md:text-[10px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
            {store.type} • {store.deliveryTime}
          </p>
        </div>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center text-brand font-black text-[9px] md:text-[10px] uppercase tracking-wider">
            <Zap size={10} className="mr-1 fill-brand" /> 
            {store.deliveryFee === 0 ? 'Free Delivery' : `${formatCurrency(store.deliveryFee)} Fee`}
          </div>
          
          <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:bg-brand group-hover:text-white group-hover:border-brand transition-all">
             <ChevronRight size={12} md:size={14} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function StoreSection({ title, stores, type }: { title: string; stores: any[]; type?: string }) {
  const navigate = useNavigate();
  
  return (
    <section className="py-12 bg-slate-50 dark:bg-transparent">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">{title}</h2>
            <div className="h-1 w-12 bg-brand rounded-full mt-1.5" />
          </div>
          <button 
            onClick={() => navigate(type ? `/stores?type=${type.toUpperCase()}` : '/stores')}
            className="text-xs font-bold text-brand uppercase tracking-widest flex items-center hover:opacity-70 transition-opacity"
          >
            See all <ChevronRight size={14} className="ml-1" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {stores.map((store, i) => (
            <motion.div
              key={store.id}
              initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <StoreCard store={store} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
