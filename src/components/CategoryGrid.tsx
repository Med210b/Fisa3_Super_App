import { motion } from 'motion/react';
import { CATEGORIES } from '../constants';
import * as LucideIcons from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CategoryGrid() {
  const navigate = useNavigate();
  
  return (
    <section className="py-20 bg-white dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">Our Services</h2>
            <p className="text-slate-500 dark:text-slate-400">Explore wide range of services in one place</p>
          </div>
          <button 
            onClick={() => navigate('/stores')}
            className="text-brand font-bold text-sm uppercase tracking-wider hover:opacity-80"
          >
            View All
          </button>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 font-sans">
          {CATEGORIES.map((cat, index) => {
            const IconComponent = (LucideIcons as any)[cat.icon] || LucideIcons.ShoppingBag;
            
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="group cursor-pointer"
                onClick={() => navigate(`/stores?type=${cat.id.toUpperCase()}`)}
              >
                <div className="bg-white dark:bg-slate-800 p-3 md:p-4 rounded-[24px] md:rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center hover:border-brand/40 group-hover:shadow-lg transition-all duration-300">
                  <div 
                    className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-3 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${cat.color}10`, color: cat.color }}
                  >
                    <IconComponent size={20} className="md:block hidden" />
                    <IconComponent size={20} className="md:hidden" />
                  </div>
                  
                  <span className="text-[8px] md:text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-tight group-hover:text-brand text-center">{cat.name}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
