import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, TrendingUp, ArrowDownLeft, ArrowUpRight, 
  CreditCard, Calendar, Clock, ChevronRight,
  TrendingDown, DollarSign, Download, Filter
} from 'lucide-react';
import { db } from '../services/firebase';
import { 
  collection, query, where, onSnapshot, 
  orderBy, limit 
} from 'firebase/firestore';
import { cn } from '../lib/utils';

interface Transaction {
  id: string;
  amount: number;
  type: 'EARNING' | 'WITHDRAWAL' | 'BONUS';
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  description: string;
  createdAt: any;
  orderId?: string;
}

export default function RiderWallet({ riderId }: { riderId: string }) {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    today: 0,
    week: 0,
    month: 0
  });

  useEffect(() => {
    if (!riderId) return;

    // Listen to rider document for balance
    const riderRef = collection(db, 'riders');
    const unsubscribeRider = onSnapshot(query(riderRef, where('id', '==', riderId)), (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setBalance(data.balance || 0);
      }
    });

    // Listen to transactions
    const transactionsRef = collection(db, `riders/${riderId}/transactions`);
    const q = query(transactionsRef, orderBy('createdAt', 'desc'), limit(20));
    
    const unsubscribeTransactions = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(txs);
      
      // Calculate basic stats (in a real app this might be server-side or more complex)
      const now = new Date();
      const startOfDay = new Date(now.setHours(0,0,0,0)).getTime();
      
      const todayTotal = txs
        .filter(t => t.type === 'EARNING' && t.status === 'COMPLETED' && t.createdAt?.toMillis() >= startOfDay)
        .reduce((acc, curr) => acc + curr.amount, 0);
        
      setStats(prev => ({ ...prev, today: todayTotal }));
      setLoading(false);
    });

    return () => {
      unsubscribeRider();
      unsubscribeTransactions();
    };
  }, [riderId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest">Chargement du portefeuille...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-brand rounded-[40px] p-8 shadow-2xl shadow-brand/20 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
          <Wallet size={160} />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
              <TrendingUp size={16} className="text-white" />
            </div>
            <span className="text-white font-black text-[10px] uppercase tracking-widest opacity-80">Solde Actuel</span>
          </div>
          
          <div className="flex items-baseline gap-2 mb-8">
            <h2 className="text-5xl font-display font-black text-white">{balance.toFixed(2)}</h2>
            <span className="text-xl font-display font-black text-white/60">TND</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <button className="bg-white text-brand rounded-2xl py-4 flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest shadow-xl shadow-black/10 active:scale-95 transition-all">
              <Download size={18} />
              Retirer Fonds
            </button>
            <div className="bg-brand-dark/30 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col justify-center">
               <p className="text-[8px] font-black text-white/50 uppercase tracking-[0.2em] mb-1">Aujourd'hui</p>
               <p className="text-lg font-display font-black text-white">+{stats.today.toFixed(2)} TND</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile icon={ArrowUpRight} label="Bonus" value="15.00" color="bg-emerald-500/10 text-emerald-500" />
        <StatTile icon={TrendingUp} label="Semaine" value="142.50" color="bg-brand/10 text-brand" />
        <StatTile icon={Clock} label="En attente" value="0.00" color="bg-slate-800 text-slate-500" />
      </div>

      {/* Transactions List */}
      <div className="bg-slate-900 rounded-[32px] border border-slate-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Dernières Transactions</h3>
          <button className="text-[10px] font-black text-brand uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
            Voir Tout <Filter size={12} />
          </button>
        </div>
        
        <div className="space-y-3">
          {transactions.length > 0 ? (
            transactions.map((tx, idx) => (
              <motion.div 
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between p-4 bg-slate-800/40 rounded-2xl hover:bg-slate-800/60 transition-all cursor-pointer group border border-transparent hover:border-slate-800"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    tx.type === 'EARNING' ? "bg-emerald-500/10 text-emerald-500" : 
                    tx.type === 'BONUS' ? "bg-brand/10 text-brand" : "bg-red-500/10 text-red-500"
                  )}>
                    {tx.type === 'EARNING' ? <TrendingUp size={20} /> : 
                     tx.type === 'BONUS' ? <DollarSign size={20} /> : <TrendingDown size={20} />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-200">{tx.description}</p>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-0.5">
                      {tx.createdAt?.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} • #{tx.id.slice(-6).toUpperCase()}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className={cn(
                    "text-sm font-black",
                    tx.type === 'WITHDRAWAL' ? "text-red-500" : "text-emerald-500"
                  )}>
                    {tx.type === 'WITHDRAWAL' ? '-' : '+'}{tx.amount.toFixed(2)}
                  </p>
                  <p className={cn(
                    "text-[8px] font-black uppercase tracking-widest mt-1",
                    tx.status === 'COMPLETED' ? "text-emerald-500/60" : "text-slate-500"
                  )}>
                    {tx.status}
                  </p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="py-12 text-center">
              <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center text-slate-700 mx-auto mb-4">
                <CreditCard size={20} />
              </div>
              <p className="text-xs font-bold text-slate-600">Aucune transaction pour le moment</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl flex flex-col items-center text-center">
      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-2", color)}>
        <Icon size={16} />
      </div>
      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xs font-black text-slate-200">{value} TND</p>
    </div>
  );
}
