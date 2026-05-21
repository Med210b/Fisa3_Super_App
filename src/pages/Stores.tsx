import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, Filter, ArrowUpDown, Star, Clock, 
  MapPin, ChevronDown, Utensils, ShoppingBag, 
  Zap, PlusCircle, Monitor, Shirt, Home as HomeIcon,
  LayoutGrid, List, Map as MapIconIcon, LocateFixed
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MOCK_STORES, CATEGORIES } from '../constants';
import { StoreCard } from '../components/StoreSection';
import StoreMap from '../components/MapContainer';
import { cn } from '../lib/utils';
import { StoreType } from '../types';
import { db } from '../services/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useGeolocation } from '../hooks/useGeolocation';

type SortOption = 'rating' | 'time' | 'distance';
type ViewMode = 'grid' | 'list' | 'map';

export default function Stores() {
  const [searchParams, setSearchParams] = useSearchParams();
  const typeFilter = (searchParams.get('type') as StoreType | 'ALL') || 'ALL';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [stores, setStores] = useState<any[]>(MOCK_STORES);
  const [loading, setLoading] = useState(true);

  const { location: realLocation, loading: geoLoading, error: geoError, refetch: getGeo } = useGeolocation();

  // Basic "user location" for distance calculation fallback
  const fallbackLocation = { lat: 36.8065, lng: 10.1815 }; // Tunis Center
  const userLocation = realLocation || fallbackLocation;

  // Fetch Firestore Stores
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const q = query(collection(db, 'stores'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const firestoreStores = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }));
        
        // Merge with mock stores (or replace if preferred)
        // We'll merge but unique by name/id for demo purposes
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
        console.error("Error fetching stores:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStores();
  }, []);

  const calculateDistance = (lat: number, lng: number) => {
    return Math.sqrt(
      Math.pow(lat - userLocation.lat, 2) + 
      Math.pow(lng - userLocation.lng, 2)
    );
  };

  const filteredAndSortedStores = useMemo(() => {
    let result = [...stores];

    // Filter by type
    if (typeFilter !== 'ALL') {
      result = result.filter(s => s.type === typeFilter);
    }

    // Filter by search
    if (searchQuery) {
      result = result.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.address.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'rating') {
        return b.rating - a.rating;
      }
      if (sortBy === 'time') {
        const timeA = parseInt(a.deliveryTime) || 999;
        const timeB = parseInt(b.deliveryTime) || 999;
        return timeA - timeB;
      }
      if (sortBy === 'distance') {
        const distA = calculateDistance(a.location.lat, a.location.lng);
        const distB = calculateDistance(b.location.lat, b.location.lng);
        return distA - distB;
      }
      return 0;
    });

    return result;
  }, [stores, typeFilter, searchQuery, sortBy]);

  const handleTypeChange = (type: string) => {
    setSearchParams(type === 'ALL' ? {} : { type });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 pt-8 pb-6 sticky top-16 z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {typeFilter === 'ALL' ? 'Tous les Magasins' : typeFilter.charAt(0) + typeFilter.slice(1).toLowerCase() + ' Magasins'}
                </h1>
                {realLocation ? (
                   <span className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-500 text-[10px] font-bold rounded-full animate-pulse">
                     <LocateFixed size={10} /> Live GPS
                   </span>
                ) : (
                  <button 
                    onClick={getGeo}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-bold rounded-full hover:text-brand transition-colors"
                  >
                    <MapPin size={10} /> Activer GPS
                  </button>
                )}
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                Affichage de {filteredAndSortedStores.length} magasins près de {realLocation ? 'votre position' : 'Tunis'}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative group flex-grow md:w-64">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..." 
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-brand/10 transition-all outline-none dark:text-white"
                />
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand transition-colors" size={16} />
              </div>
              
              <div className="flex items-center bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors shrink-0">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={cn("p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-white dark:bg-slate-700 shadow-sm text-brand" : "text-slate-400")}
                  title="Grille"
                >
                  <LayoutGrid size={18} />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-white dark:bg-slate-700 shadow-sm text-brand" : "text-slate-400")}
                  title="Liste"
                >
                  <List size={18} />
                </button>
                <button 
                  onClick={() => setViewMode('map')}
                  className={cn("p-2 rounded-lg transition-all", viewMode === 'map' ? "bg-white dark:bg-slate-700 shadow-sm text-brand" : "text-slate-400")}
                  title="Carte"
                >
                  <MapIconIcon size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 mt-8 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => handleTypeChange('ALL')}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all shrink-0 border",
                typeFilter === 'ALL' 
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-lg" 
                  : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand/40 hover:text-brand transition-colors"
              )}
            >
              Tous
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleTypeChange(cat.id.toUpperCase())}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all shrink-0 border flex items-center gap-2",
                  typeFilter === cat.id.toUpperCase()
                    ? "bg-brand text-white border-brand shadow-lg" 
                    : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand/40 hover:text-brand transition-colors"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters - Desktop */}
          <aside className="hidden lg:block w-64 shrink-0 space-y-8">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
                <ArrowUpDown size={14} /> Trier Par
              </h3>
              <div className="space-y-2">
                {[
                  { id: 'rating', label: 'Note Clients', icon: Star },
                  { id: 'time', label: 'Temps de Livraison', icon: Clock },
                  { id: 'distance', label: 'Distance', icon: MapPin },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setSortBy(option.id as SortOption)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-2xl text-sm font-bold transition-all border shadow-sm",
                      sortBy === option.id 
                        ? "bg-brand/5 dark:bg-brand/10 border-brand/20 dark:border-brand/20 text-brand" 
                        : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <option.icon size={16} />
                      {option.label}
                    </div>
                    {sortBy === option.id && <ChevronDown className="-rotate-90" size={14} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 bg-brand rounded-[32px] text-white overflow-hidden relative group">
              <Zap className="absolute -right-4 -top-4 w-24 h-24 text-white/10 group-hover:rotate-12 transition-transform duration-500" />
              <h4 className="text-xl font-display font-bold mb-2 relative z-10">Livraison Gratuite</h4>
              <p className="text-xs text-white/80 font-medium mb-4 relative z-10">Inscrivez-vous à FISA3 Plus et profitez de la livraison offerte sur toutes vos commandes.</p>
              <button className="bg-white text-brand px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest relative z-10 hover:scale-105 transition-transform">
                S'abonner
              </button>
            </div>
          </aside>

          {/* Mobile Sort/Filter Bar */}
          <div className="lg:hidden flex items-center justify-between mb-4">
             <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto scrollbar-hide max-w-[280px]">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap">Tri :</span>
                {[
                  { id: 'rating', label: 'Note' },
                  { id: 'time', label: 'Temps' },
                  { id: 'distance', label: 'Dist' },
                ].map((opt) => (
                  <button 
                    key={opt.id}
                    onClick={() => setSortBy(opt.id as SortOption)}
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-lg whitespace-nowrap",
                      sortBy === opt.id ? "bg-brand text-white" : "text-slate-600 dark:text-slate-400"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
             </div>
             <button className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-slate-600 dark:text-slate-400">
               <Filter size={18} />
             </button>
          </div>

          {/* Results Grid / Map */}
          <div className="flex-1">
            <AnimatePresence mode="wait">
              {viewMode === 'map' ? (
                <motion.div
                  key="map-view"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full h-[600px]"
                >
                  <StoreMap stores={filteredAndSortedStores} />
                </motion.div>
              ) : filteredAndSortedStores.length > 0 ? (
                <div 
                  key="list-view"
                  className={cn(
                    "grid gap-6",
                    viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
                  )}
                >
                  {filteredAndSortedStores.map((store) => (
                    <motion.div
                      key={store.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                    >
                      <StoreCard store={store} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-300 dark:text-slate-600 mb-6">
                    <Search size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Aucun magasin trouvé</h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto">Nous n'avons trouvé aucun magasin correspondant à vos critères. Essayez d'ajuster vos filtres.</p>
                  <button 
                    onClick={() => { setSearchQuery(''); handleTypeChange('ALL'); }}
                    className="mt-6 text-brand font-bold text-sm uppercase tracking-widest border-b-2 border-brand"
                  >
                    Réinitialiser les filtres
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
