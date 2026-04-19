export type WatermarkStyle = 'classic' | 'modern' | 'badge' | 'minimal';

export interface LocationData {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  timestamp: string;
}

export interface AppSettings {
  style: WatermarkStyle;
  showSatellite: boolean;
  theme: 'light' | 'dark';
  mode: 'photo' | 'video';
}
