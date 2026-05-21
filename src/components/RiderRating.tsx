import { useState } from 'react';
import { Star, MessageSquare, Send, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db } from '../services/firebase';
import { doc, collection, addDoc, updateDoc, getDoc, serverTimestamp, increment } from 'firebase/firestore';

interface RiderRatingProps {
  orderId: string;
  riderId: string;
  riderName: string;
  customerId: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

export default function RiderRating({ orderId, riderId, riderName, customerId, onSuccess, onClose }: RiderRatingProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setIsSubmitting(true);
    try {
      // 1. Add to rider's ratings subcollection
      await addDoc(collection(db, `riders/${riderId}/ratings`), {
        orderId,
        customerId,
        rating,
        feedback,
        createdAt: serverTimestamp()
      });

      // 2. Update rider average (Simplified for this environment - in real app use Cloud Functions)
      const riderRef = doc(db, 'riders', riderId);
      const riderSnap = await getDoc(riderRef);
      
      if (riderSnap.exists()) {
        const data = riderSnap.data();
        const oldTotal = data.totalRatings || 0;
        const oldRating = data.rating || 0;
        const newTotal = oldTotal + 1;
        const newRating = ((oldRating * oldTotal) + rating) / newTotal;

        await updateDoc(riderRef, {
          rating: newRating,
          totalRatings: newTotal,
          updatedAt: serverTimestamp()
        });
      }

      // 3. Mark order as rated
      await updateDoc(doc(db, 'orders', orderId), {
        riderRated: true,
        updatedAt: serverTimestamp()
      });

      setIsSubmitted(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (error) {
      console.error("Error submitting rating:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-green-500/20">
        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mx-auto mb-6">
          <CheckCircle2 size={40} className="animate-bounce" />
        </div>
        <h3 className="text-2xl font-display font-black text-slate-900 dark:text-white mb-2">Merci pour votre retour!</h3>
        <p className="text-slate-500 font-medium">Votre avis aide {riderName} à s'améliorer.</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl relative border border-slate-100 dark:border-slate-800">
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      )}

      <div className="text-center mb-8">
        <p className="text-[10px] font-black uppercase text-brand tracking-[0.3em] mb-2">Feedback Livraison</p>
        <h3 className="text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight">Notez votre livreur</h3>
        <p className="text-slate-500 text-sm font-medium mt-2">Comment s'est passée votre livraison avec {riderName} ?</p>
      </div>

      {/* Stars */}
      <div className="flex justify-center gap-3 mb-8">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            onClick={() => setRating(star)}
            className="group relative transition-transform active:scale-95"
          >
            <Star 
              size={44} 
              className={cn(
                "transition-all duration-300",
                (hoveredRating || rating) >= star 
                  ? "fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]" 
                  : "text-slate-200 dark:text-slate-800 hover:text-yellow-200"
              )} 
            />
          </button>
        ))}
      </div>

      {/* Feedback Textarea */}
      <div className="relative mb-8">
        <div className="absolute top-4 left-4 text-slate-400">
          <MessageSquare size={20} />
        </div>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Un petit mot sur la livraison... (optionnel)"
          className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-3xl p-4 pl-12 text-sm font-medium focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all resize-none min-h-[120px]"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || rating === 0}
        className={cn(
          "w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest transition-all shadow-xl",
          rating > 0 
           ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-brand dark:hover:bg-brand dark:hover:text-white shadow-brand/20" 
           : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none"
        )}
      >
        {isSubmitting ? (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Send size={18} />
            Envoyer mon avis
          </>
        )}
      </button>
    </div>
  );
}
