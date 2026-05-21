import { motion } from 'motion/react';
import { Clock, Package, Bike, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface OrderProgressBarProps {
  status: string;
}

const STEPS = [
  { id: 'PENDING', label: 'Attente', icon: Clock, group: ['PENDING', 'ACCEPTED_BY_STORE'] },
  { id: 'PREPARING', label: 'Cuisine', group: ['PREPARING', 'READY_FOR_PICKUP'] },
  { id: 'ON_THE_WAY', label: 'Livraison', group: ['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'] },
  { id: 'DELIVERED', label: 'Livré', group: ['DELIVERED'] },
];

export default function OrderProgressBar({ status }: OrderProgressBarProps) {
  // Find the current step index
  const currentStepIndex = STEPS.findIndex(step => step.group.includes(status));
  
  // If status is CANCELLED or not found, we might want to handle it differently, 
  // but for active orders we follow this.
  const activeIndex = currentStepIndex === -1 ? (status === 'DELIVERED' ? 3 : 0) : currentStepIndex;

  return (
    <div className="w-full py-8 px-2">
      <div className="relative">
        {/* Background Line */}
        <div className="absolute top-5 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full" />
        
        {/* Progress Line */}
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${(activeIndex / (STEPS.length - 1)) * 100}%` }}
          className="absolute top-5 left-0 h-1 bg-brand rounded-full z-10"
          transition={{ duration: 1, ease: "easeInOut" }}
        />

        {/* Steps */}
        <div className="relative z-20 flex justify-between items-center">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < activeIndex;
            const isActive = idx === activeIndex;
            const isFuture = idx > activeIndex;
            
            let Icon = Clock;
            if (idx === 1) Icon = Package;
            if (idx === 2) Icon = Bike;
            if (idx === 3) Icon = CheckCircle2;

            return (
              <div key={step.id} className="flex flex-col items-center">
                <motion.div 
                  initial={false}
                  animate={{ 
                    scale: isActive ? 1.2 : 1,
                    backgroundColor: isActive || isCompleted ? 'var(--color-brand)' : 'var(--color-slate-100)',
                    color: isActive || isCompleted ? '#ffffff' : '#94a3b8'
                  }}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-sm transition-colors",
                    isActive && "ring-4 ring-brand/20",
                    isFuture && "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  )}
                >
                  <Icon size={18} className={cn(isActive && "animate-pulse")} />
                </motion.div>
                
                <span className={cn(
                  "mt-3 text-[9px] font-black uppercase tracking-widest transition-colors",
                  isActive ? "text-brand" : isCompleted ? "text-slate-600 dark:text-slate-300" : "text-slate-400"
                )}>
                  {step.label}
                </span>
                
                {isActive && (
                  <motion.div 
                    layoutId="active-indicator"
                    className="absolute -bottom-1 w-1 h-1 bg-brand rounded-full"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
