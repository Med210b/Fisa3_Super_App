import { motion } from 'motion/react';
import { BRAND } from '../constants';

export default function Splash() {
  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-8"
    >
      <div className="relative">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [1, 0.8, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="relative z-10"
        >
          <img src={BRAND.logo} alt="FISA3" className="w-24 h-24 object-contain rounded-3xl" />
        </motion.div>
        
        {/* Halo Effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-brand/20 rounded-full blur-[40px] animate-pulse" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-12 text-center"
      >
        <h1 className="text-3xl font-display font-bold text-white tracking-widest uppercase">
          FISA<span className="text-brand">3</span>
        </h1>
        <div className="mt-4 flex items-center gap-1">
          <div className="w-2 h-2 bg-brand rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 bg-brand rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 bg-brand rounded-full animate-bounce" />
        </div>
        <p className="mt-6 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
          Tunisia's Super App
        </p>
      </motion.div>
    </motion.div>
  );
}
