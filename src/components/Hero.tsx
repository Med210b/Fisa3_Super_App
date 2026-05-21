import { motion } from 'motion/react';
import { Search, MapPin, Zap, Utensils, ShoppingBag } from 'lucide-react';
import { BRAND } from '../constants';

export default function Hero() {
  return (
    <section className="relative min-h-[70vh] md:min-h-[80vh] flex items-center pt-24 md:pt-32 pb-12 overflow-hidden bg-slate-50 dark:bg-slate-950 px-4 md:px-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative h-[450px] md:h-[500px] rounded-[32px] md:rounded-[40px] overflow-hidden bg-slate-900 group shadow-2xl"
        >
          {/* Theme Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-brand via-brand/80 to-transparent z-10 opacity-95 md:opacity-95" />
          <div className="absolute inset-0 bg-black/40 z-10 md:hidden" />
          
          {/* Background Decorative Pattern */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1.5px,transparent_1.5px)] [background-size:24px_24px] z-10" />

          {/* Interactive Background Image */}
          <motion.img 
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 10, repeat: Infinity, repeatType: "reverse" }}
            src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1600&q=80" 
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
            alt="Hero Background"
          />

          <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-16 text-white z-20">
            <motion.span 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="text-[10px] md:text-xs font-black tracking-[0.3em] uppercase mb-4 bg-white/20 w-max px-4 py-1.5 rounded-full backdrop-blur-md border border-white/20 shadow-sm"
            >
              FISA3 Super App Tunisie
            </motion.span>
            
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-6xl lg:text-7xl font-display font-extrabold mb-4 leading-tight"
            >
              Tout en <br className="hidden md:block" />
              <span className="text-yellow-400">15 minutes.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-white/80 max-w-md mb-8 text-sm md:text-lg font-medium"
            >
              Commandez plats, courses et électronique dans vos magasins locaux préférés. Livraison gratuite sur votre première commande.
            </motion.p>

            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.5 }}
               className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-max"
            >
              <div className="flex flex-col sm:flex-row items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl w-full sm:w-[450px] border border-transparent dark:border-slate-800">
                <div className="flex items-center gap-2 flex-1 px-3 py-1 md:py-0 text-slate-400 w-full border-b sm:border-b-0 border-slate-100 dark:border-slate-800">
                  <MapPin size={16} className="text-brand shrink-0" />
                  <input 
                    type="text" 
                    placeholder="Lieu de livraison..." 
                    className="w-full bg-transparent border-none focus:ring-0 text-xs md:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                </div>
                <button className="btn-primary w-full sm:w-auto h-11 md:h-auto">
                  Explorer
                </button>
              </div>
            </motion.div>
          </div>

          {/* Floaters for Depth */}
          <div className="absolute right-0 top-0 w-1/2 h-full hidden lg:block overflow-hidden pointer-events-none">
             <motion.div 
               animate={{ rotate: 360 }}
               transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
               className="absolute -right-20 -top-20 w-[400px] h-[400px] border border-white/10 rounded-[120px] mix-blend-overlay" 
             />
             <motion.div 
               animate={{ rotate: -360 }}
               transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
               className="absolute right-40 bottom-10 w-[200px] h-[200px] bg-brand/30 rounded-full blur-[100px]" 
             />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
