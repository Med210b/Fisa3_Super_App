import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker issue
const icon = L.divIcon({
  html: `<div class="bg-brand w-10 h-10 rounded-full border-4 border-white shadow-2xl flex items-center justify-center text-white"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

interface LocationPickerProps {
  initialLocation?: { lat: number, lng: number };
  onSelect: (location: { lat: number, lng: number }) => void;
  onClose: () => void;
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function LocateControl({ setPos }: { setPos: (lat: number, lng: number) => void }) {
  const map = useMap();
  
  const handleLocate = () => {
    map.locate().on('locationfound', (e) => {
      setPos(e.latlng.lat, e.latlng.lng);
      map.flyTo(e.latlng, 16);
    });
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleLocate();
      }}
      className="absolute bottom-24 right-4 z-[1000] p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 text-brand hover:scale-110 active:scale-95 transition-all"
    >
      <Navigation size={24} />
    </button>
  );
}

export default function LocationPicker({ initialLocation, onSelect, onClose }: LocationPickerProps) {
  const [position, setPosition] = useState<{ lat: number, lng: number }>(initialLocation || { lat: 36.8065, lng: 10.1815 });

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-display font-black text-slate-900 dark:text-white">Emplacement de livraison</h3>
          <p className="text-xs text-slate-500 font-medium mt-1">Cliquez sur la carte pour choisir votre adresse</p>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        >
          <X size={24} className="dark:text-white" />
        </button>
      </div>

      <div className="flex-1 relative">
        <MapContainer
          center={[position.lat, position.lng]}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <Marker position={[position.lat, position.lng]} icon={icon} />
          <MapClickHandler onClick={(lat, lng) => setPosition({ lat, lng })} />
          <LocateControl setPos={(lat, lng) => setPosition({ lat, lng })} />
        </MapContainer>

        {/* Selected Coordinates Label */}
        <div className="absolute bottom-24 left-4 z-[1000] p-3 bg-white/90 backdrop-blur-md dark:bg-slate-900/90 rounded-xl shadow-lg border border-white/20 text-[10px] font-black text-slate-900 dark:text-white flex items-center gap-2">
          <MapPin size={12} className="text-brand" />
          {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
        </div>
      </div>

      <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <button
          onClick={() => onSelect(position)}
          className="w-full py-4 bg-brand text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-brand/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <Check size={20} />
          Confirmer l'emplacement
        </button>
      </div>
    </div>
  );
}
