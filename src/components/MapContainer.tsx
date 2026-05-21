import React, { ReactNode, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Store } from '../types';
import { Layers, Plus, Minus, Star, Clock, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker issue
const createStoreIcon = () => {
  return L.divIcon({
    html: `
      <div class="flex items-center justify-center w-10 h-10 rounded-full bg-brand border-2 border-white shadow-xl transform hover:scale-110 transition-all">
        <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
      </div>
    `,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

type MapMode = 'voyager' | 'light' | 'dark' | 'satellite';

const TILE_LAYERS = {
  voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

const ATTRIBUTION = {
  voyager: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  light: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  dark: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  satellite: 'Tiles &copy; Esri &mdash; Source: Esri',
};

function FitBounds({ stores }: { stores: Store[] }) {
  const map = useMap();
  useEffect(() => {
    if (stores.length > 0) {
      const bounds = L.latLngBounds(stores.map(s => [s.location.lat, s.location.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [stores, map]);
  return null;
}

function CustomControls({ mode, setMode }: { mode: MapMode, setMode: (m: MapMode) => void }) {
  const map = useMap();
  return (
    <>
      <div className="absolute top-4 left-4 z-[1000] flex items-center bg-white dark:bg-slate-900 rounded-2xl p-1 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="p-2.5 text-slate-400 dark:text-slate-500 border-r border-slate-100 dark:border-slate-800 mr-1">
          <Layers size={18} />
        </div>
        <div className="flex items-center gap-1">
          {(['voyager', 'light', 'dark', 'satellite'] as MapMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                mode === m 
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg" 
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-1">
        <button onClick={() => map.zoomIn()} className="w-10 h-10 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-900 dark:text-white rounded-t-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
          <Plus size={20} />
        </button>
        <button onClick={() => map.zoomOut()} className="w-10 h-10 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-900 dark:text-white rounded-b-xl border-x border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
          <Minus size={20} />
        </button>
      </div>
    </>
  );
}

export function MapProvider({ children }: { children: ReactNode }) {
  return <div className="w-full h-full">{children}</div>;
}

export default function StoreMap({ stores, center }: { stores: Store[], center?: [number, number] }) {
  const [mode, setMode] = useState<MapMode>('voyager');
  const defaultCenter: [number, number] = center || [36.8065, 10.1815];
  const navigate = useNavigate();

  return (
    <div className="w-full h-full relative rounded-3xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        zoomControl={false}
        className="w-full h-full z-0"
      >
        <FitBounds stores={stores} />
        <TileLayer attribution={ATTRIBUTION[mode]} url={TILE_LAYERS[mode]} />
        
        {stores.map((store) => (
          <Marker 
            key={store.id} 
            position={[store.location.lat, store.location.lng]}
            icon={createStoreIcon()}
          >
            <Popup className="custom-popup" minWidth={220}>
              <div className="p-0 overflow-hidden min-w-[200px]">
                <div className="h-24 w-full relative bg-white">
                  <img src={store.image} alt={store.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                    <Star size={10} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-[10px] font-black">{store.rating}</span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-display font-black text-slate-900 text-sm leading-tight mb-1">{store.name}</h3>
                  <div className="flex items-center gap-2 mb-4 text-slate-500">
                    <Clock size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{store.deliveryTime}</span>
                  </div>
                  <button onClick={() => navigate(`/store/${store.id}`)} className="w-full py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand transition-colors">
                    Voir Menu
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        <CustomControls mode={mode} setMode={setMode} />
      </MapContainer>
    </div>
  );
}
