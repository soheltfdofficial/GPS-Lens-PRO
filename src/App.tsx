/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, MapPin, Settings as SettingsIcon, Image as ImageIcon, Video, Sun, Moon, Map as MapIcon, Download, RefreshCw, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WatermarkStyle, LocationData, AppSettings } from './types';

// --- Components ---

const WatermarkOverlay = ({ location, settings }: { location: LocationData; settings: AppSettings }) => {
  if (!location.latitude || !location.longitude) return null;

  const styleClasses = {
    classic: "absolute bottom-6 right-6 bg-black/80 text-white p-4 flex flex-row gap-4 items-center backdrop-blur-md border-r-4 border-accent",
    modern: "absolute bottom-6 right-6 bg-panel/90 text-white p-3.5 rounded-lg flex flex-row gap-5 items-center border border-white/10 backdrop-blur-xl shadow-2xl",
    badge: "absolute bottom-24 right-6 bg-black/70 text-white p-3 rounded-sm flex flex-col gap-1 border-r-2 border-accent",
    minimal: "absolute bottom-8 right-8 text-white text-right drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-mono flex flex-col"
  };

  const mapUrl = `https://static-maps.yandex.ru/1.x/?ll=${location.longitude},${location.latitude}&size=80,80&z=15&l=sat`;

  return (
    <div className={styleClasses[settings.style]}>
      {settings.showSatellite && settings.style !== 'minimal' && (
        <div className="relative shrink-0">
          <img 
            src={mapUrl} 
            alt="satellite" 
            className="w-12 h-12 rounded-sm border border-white/20 object-cover shadow-inner bg-black"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 border border-white/5 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444]" />
        </div>
      )}

      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex flex-col">
          <span className="text-sm font-black leading-none tracking-tight mb-1 uppercase truncate max-w-[140px]">
            {location.address?.split(',')[0] || 'Unknown Place'}
          </span>
          <div className={`flex gap-2 text-[9px] font-mono text-accent uppercase tracking-wider ${settings.style === 'minimal' ? 'justify-end' : ''}`}>
            <span>{location.latitude.toFixed(4)}°{location.latitude >= 0 ? 'N' : 'S'}</span>
            <span>·</span>
            <span>{location.longitude.toFixed(4)}°{location.longitude >= 0 ? 'E' : 'W'}</span>
          </div>
          <span className="text-[8px] text-white/40 font-mono mt-0.5 whitespace-nowrap">
            {location.timestamp}
          </span>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [location, setLocation] = useState<LocationData>({
    latitude: null,
    longitude: null,
    address: null,
    timestamp: new Date().toLocaleString(),
  });

  const [settings, setSettings] = useState<AppSettings>({
    style: 'modern',
    showSatellite: true,
    theme: 'dark',
    mode: 'photo',
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize Location
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation(prev => ({
          ...prev,
          latitude,
          longitude,
          timestamp: new Date().toLocaleString(),
        }));

        // Reverse Geocode
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
          const data = await res.json();
          setLocation(prev => ({ ...prev, address: data.display_name }));
        } catch (e) {
          console.error("Geocoding failed", e);
        }
      },
      (err) => setError(`Location Permission Error: ${err.message}`),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Initialize Camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraReady(true);
      }
    } catch (err) {
      setError("Camera access denied. Please check site permissions.");
    }
  }, []);

  useEffect(() => {
    startCamera();
  }, [startCamera]);

  // Capture Photo Logic
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Capture the Overlay UI (simplified - we redraw watermark on canvas)
    // In a real app we'd use html2canvas or better, manual draw for performance and quality
    drawWatermarkToCanvas(ctx, canvas.width, canvas.height, location, settings);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(dataUrl);
    setIsCapturing(false);
  }, [location, settings]);

  const drawWatermarkToCanvas = (ctx: CanvasRenderingContext2D, width: number, height: number, loc: LocationData, set: AppSettings) => {
    // Watermark Dimensions
    const rectH = 80;
    const rectW = 450;
    const margin = 40;
    const rectX = width - rectW - margin;
    const rectY = height - rectH - margin;

    // Background overlay
    if (set.style === 'classic') {
       ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
       ctx.fillRect(rectX, rectY, rectW, rectH);
       ctx.fillStyle = '#00ff88';
       ctx.fillRect(width - margin - 4, rectY, 4, rectH);
    } else if (set.style === 'modern') {
       ctx.fillStyle = 'rgba(20, 22, 26, 0.95)';
       ctx.beginPath();
       ctx.roundRect(rectX, rectY, rectW, rectH, 12);
       ctx.fill();
       ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
       ctx.stroke();
    }

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    
    const textX = width - margin - (set.style === 'classic' ? 20 : 20);
    const contentY = rectY + 30;

    // Place Name
    ctx.font = '900 24px Inter, sans-serif';
    const lines = loc.address?.split(',') || ['Unknown Place'];
    ctx.fillText(lines[0].trim().toUpperCase(), textX, contentY);
    
    // Lat Long
    ctx.fillStyle = '#00ff88';
    ctx.font = '16px JetBrains Mono, monospace';
    const latLong = `${loc.latitude?.toFixed(4)}°${loc.latitude! >= 0 ? 'N' : 'S'} · ${loc.longitude?.toFixed(4)}°${loc.longitude! >= 0 ? 'E' : 'W'}`;
    ctx.fillText(latLong, textX, contentY + 25);
    
    // Timestamp
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '12px JetBrains Mono, monospace';
    ctx.fillText(loc.timestamp, textX, contentY + 45);

    // Satellite Image
    if (set.showSatellite && set.style !== 'minimal') {
       const mapSize = 60;
       const mapX = rectX + 20;
       const mapY = rectY + (rectH - mapSize) / 2;
       
       ctx.fillStyle = 'rgba(255,255,255,0.1)';
       ctx.beginPath();
       ctx.roundRect(mapX, mapY, mapSize, mapSize, 8);
       ctx.fill();
       ctx.strokeStyle = 'rgba(255,255,255,0.3)';
       ctx.stroke();
    }
  };

  const downloadImage = () => {
    if (!capturedImage) return;
    const link = document.createElement('a');
    link.download = `GPS_PRO_${Date.now()}.jpg`;
    link.href = capturedImage;
    link.click();
    setCapturedImage(null);
  };

  return (
    <div className={`h-screen flex flex-col md:flex-row font-sans transition-colors duration-500 ${settings.theme === 'dark' ? 'bg-black text-white' : 'bg-gray-50 text-black'}`}>
      
      {/* --- Sidebar (Settings) --- */}
      <aside className="hidden md:flex flex-col w-[280px] bg-panel border-r border-white/10 p-8 z-50 overflow-y-auto">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-black font-black">G</div>
          <h1 className="text-lg font-black tracking-tight uppercase">GeoCam <span className="text-accent">Pro</span></h1>
        </div>

        <div className="space-y-10">
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-6">Watermark Style</h3>
            <div className="space-y-2">
              {(['classic', 'modern', 'badge', 'minimal'] as WatermarkStyle[]).map(s => (
                <button 
                  key={s}
                  onClick={() => setSettings(prev => ({ ...prev, style: s }))}
                  className={`w-full p-4 rounded-lg border flex items-center gap-4 transition-all ${settings.style === s ? 'border-accent bg-accent/5' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                >
                  <div className={`w-8 h-4 rounded-sm ${settings.style === s ? 'bg-accent' : 'bg-white/20'}`} />
                  <span className="capitalize font-bold text-sm tracking-tight">{s}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
             <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-6">Display Options</h3>
             <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white/80">Satellite Miniature</span>
                  <button 
                    onClick={() => setSettings(prev => ({ ...prev, showSatellite: !prev.showSatellite }))}
                    className={`w-10 h-5 rounded-full transition-colors relative ${settings.showSatellite ? 'bg-accent' : 'bg-white/10'}`}
                  >
                    <motion.div animate={{ x: settings.showSatellite ? 20 : 2 }} className="absolute top-1 w-3 h-3 rounded-full bg-white" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white/80">Dark Mode</span>
                  <button 
                    onClick={() => setSettings(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }))}
                    className={`w-10 h-5 rounded-full transition-colors relative ${settings.theme === 'dark' ? 'bg-accent' : 'bg-white/10'}`}
                  >
                    <motion.div animate={{ x: settings.theme === 'dark' ? 20 : 2 }} className="absolute top-1 w-3 h-3 rounded-full bg-white" />
                  </button>
                </div>
             </div>
          </div>

          <div className="mt-auto pt-10 text-[10px] uppercase font-mono tracking-widest text-white/20">
            Storage: Internal / 12.4 GB Free
          </div>
        </div>
      </aside>

      {/* --- Main Viewport --- */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-black">
        
        {/* --- Viewfinder --- */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center">
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />

          {/* HUD Badge Overlay */}
          <div className="absolute top-6 left-6 right-6 flex justify-between pointer-events-none z-10">
             <div className="bg-black/40 backdrop-blur-sm border border-white/10 p-2 px-3 rounded text-[10px] font-mono flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_#00ff88]" />
                GPS LOCKED : 3.4M ACCURACY
             </div>
             <div className="bg-black/40 backdrop-blur-sm border border-white/10 p-2 px-3 rounded text-[10px] font-mono uppercase">
                ISO 200 · 1/120 · f/1.8 · 4K 60FPS
             </div>
          </div>

          {/* Focus Reticle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-white/20 pointer-events-none">
             <div className="absolute top-1/2 -left-3 w-6 h-[1px] bg-accent" />
             <div className="absolute top-1/2 -right-3 w-6 h-[1px] bg-accent" />
             <div className="absolute -top-3 left-1/2 w-[1px] h-6 bg-accent" />
             <div className="absolute -bottom-3 left-1/2 w-[1px] h-6 bg-accent" />
          </div>

          {/* Real-time Watermark Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <WatermarkOverlay location={location} settings={settings} />
          </div>

          <AnimatePresence>
            {isCapturing && <motion.div initial={{ opacity: 1 }} animate={{ opacity: 0 }} className="absolute inset-0 bg-white z-[100]" />}
          </AnimatePresence>
        </div>

        {/* --- Footer Controls --- */}
        <footer className="h-[140px] bg-panel border-t border-white/10 flex items-center justify-around px-12 md:px-24">
           <div className="flex flex-col items-center gap-1">
             <button className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                <ImageIcon size={20} />
             </button>
             <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Gallery</span>
           </div>

           <div className="flex flex-col items-center gap-4 py-4">
              <button 
                onClick={capturePhoto}
                disabled={!isCameraReady || isCapturing}
                className="group relative w-20 h-20 flex items-center justify-center"
              >
                <div className="absolute inset-0 rounded-full border-[3px] border-white group-hover:scale-105 transition-transform" />
                <div className="w-14 h-14 rounded-full bg-white group-active:scale-95 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]" />
              </button>
              
              <div className="flex bg-white/5 p-1 rounded-full border border-white/5">
                <button 
                  onClick={() => setSettings(s => ({ ...s, mode: 'photo' }))}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${settings.mode === 'photo' ? 'bg-accent text-black' : 'text-white/40'}`}
                >
                  Photo
                </button>
                <button 
                  onClick={() => setSettings(s => ({ ...s, mode: 'video' }))}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${settings.mode === 'video' ? 'bg-accent text-black' : 'text-white/40'}`}
                >
                  Video
                </button>
              </div>
           </div>

           <div className="flex flex-col items-center gap-1">
             <button 
               onClick={() => setIsSettingsOpen(true)}
               className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white md:hidden"
             >
                <SettingsIcon size={20} />
             </button>
             <div className="hidden md:flex flex-col items-center gap-1">
                <button className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                  <RefreshCw size={20} />
                </button>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Switch</span>
             </div>
           </div>
        </footer>

        {/* --- Error Overlay --- */}
        {error && (
          <div className="absolute inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-8 text-center gap-4 px-12">
            <X size={32} className="text-red-500 mb-2" />
            <h2 className="text-xl font-bold">Permission Required</h2>
            <p className="text-white/40 text-sm max-w-xs">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-4 px-8 py-3 bg-accent text-black rounded-full font-black text-sm transition-transform active:scale-95">RETRY ACCESS</button>
          </div>
        )}

        {/* --- Preview Overlay (Mobile Modal for Settings) --- */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm md:hidden flex flex-col justify-end"
            >
              <motion.div 
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                className="bg-[#121212] rounded-t-[32px] p-8 pb-12"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-black uppercase">Settings</h2>
                  <button onClick={() => setIsSettingsOpen(false)}><X size={24} /></button>
                </div>
                {/* Simplified settings for mobile modal */}
                <div className="space-y-6">
                   <div>
                     <label className="text-[10px] font-bold uppercase tracking-widest text-accent mb-4 block">Watermark Style</label>
                     <div className="grid grid-cols-2 gap-3">
                        {(['classic', 'modern', 'badge', 'minimal'] as WatermarkStyle[]).map(s => (
                          <button key={s} onClick={() => setSettings(p => ({ ...p, style: s }))} className={`p-4 rounded-xl border-2 capitalize font-bold text-sm ${settings.style === s ? 'border-accent bg-accent/10 text-accent' : 'border-white/5 bg-white/5'}`}>{s}</button>
                        ))}
                     </div>
                   </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Captured Preview Modal */}
        <AnimatePresence>
          {capturedImage && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-8">
              <div className="relative w-full aspect-square md:aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                <img src={capturedImage} alt="captured" className="w-full h-full object-contain bg-black/40" />
              </div>
              <div className="mt-12 flex gap-4 w-full justify-center">
                <button onClick={() => setCapturedImage(null)} className="px-10 py-4 rounded-full border border-white/20 font-bold text-sm tracking-widest">DISCARD</button>
                <button onClick={downloadImage} className="px-10 py-4 rounded-full bg-accent text-black font-black text-sm tracking-widest shadow-[0_0_30px_rgba(0,255,136,0.3)]">SAVE PHOTO</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- Hidden Canvas for processing --- */}
        <canvas ref={canvasRef} className="hidden" />
      </main>
    </div>
  );
}
