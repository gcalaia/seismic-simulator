'use client';

import Image from 'next/image';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Upload, Play, Pause, Square, Settings, TrendingUp, 
  Download, AlertCircle, Wifi, WifiOff, FileText,
  Zap, Activity, Cloud
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { database } from '../lib/firebase';
import { ref, set, onValue } from 'firebase/database';
import { calculateDominantFrequency } from './utils/calculateDominantFrequency';

export default function Home() {
  const [seismicData, setSeismicData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [loading, setLoading] = useState(false);
  const [mostrarModalSismos, setMostrarModalSismos] = useState(false);
  const [showWiFiModal, setShowWiFiModal] = useState(false);
  const [isCSVLoaded, setIsCSVLoaded] = useState(false);
  const [esp32IP, setEsp32IP] = useState('');
  
  const [dominantFreqResult, setDominantFreqResult] = useState(null);
  const [isHistoricalMode, setIsHistoricalMode] = useState(false)
  // Bandera para cancelar reproducción
  const cancelPlayback = useRef(false);
  
  const [manualParams, setManualParams] = useState({
    frequency: 2.0,
    duration: 10,
    waveform: 'sine',
    waveformType: 0
  });

  const [deviceId, setDeviceId] = useState('LAB_01');
  const [crankPosition, setCrankPosition] = useState(5);
  
  // Tabla de configuraciones mecánicas
  const CRANK_CONFIG = {
    1: { radius: 12, amplitude: 24, use: 'Pequeña', maxFreq: '3-5 Hz' },
    2: { radius: 20, amplitude: 40, use: 'Media Baja', maxFreq: '2-4 Hz' },
    3: { radius: 28, amplitude: 56, use: 'Media', maxFreq: '1-3 Hz' },
    4: { radius: 36, amplitude: 72, use: 'Media Alta', maxFreq: '0.5-2 Hz' },
    5: { radius: 44, amplitude: 88, use: 'Grande', maxFreq: '0.5-2 Hz' }
  };
  
  const currentConfig = CRANK_CONFIG[crankPosition];
  
  // ✅ EJEMPLOS DE SISMOS CORREGIDOS - TODAS LAS RUTAS CON /examples/
  const EJEMPLOS_SISMOS = [
  {
    nombre: 'Terremoto de Japón (Tohoku) 2011',
    magnitud: 9.1,
    pga: 20.5, // 🆕 Peak Ground Acceleration estimado
    duracion: 60,
    archivo: '/examples/Tohoku_2011_M9.1.csv',
    descripcion: 'Tohoku, uno de los más potentes registrados',
    icon: '🇯🇵'
  },
  {
    nombre: 'Terremoto de Chile 2010',
    magnitud: 8.8,
    pga: 15.2,
    duracion: 60,
    archivo: '/examples/Chile_2010_M8.8.csv',
    descripcion: 'Maule, uno de los mayores en la historia de Chile',
    icon: '🇨🇱'
  },
  {
    nombre: 'Terremoto de México 2017',
    magnitud: 7.1,
    pga: 12.8,
    duracion: 45,
    archivo: '/examples/Mexico_2017_M7.1.csv',
    descripcion: 'Puebla-Morelos, altamente destructivo',
    icon: '🇲🇽'
  },
  {
    nombre: 'Terremoto de Chi-Chi 1999',
    magnitud: 7.6,
    pga: 14.5,
    duracion: 50,
    archivo: '/examples/Chi-Chi_1999_M7.6.csv',
    descripcion: 'Taiwan, uno de los más grandes de Asia',
    icon: '🇹🇼'
  },
  {
    nombre: 'Terremoto de Christchurch 2011',
    magnitud: 6.2,
    pga: 14.2,
    duracion: 30,
    archivo: '/examples/Christchurch_2011_M6.2.csv',
    descripcion: 'Nueva Zelanda, altamente destructivo',
    icon: '🇳🇿'
  },
  {
    nombre: 'Terremoto de Kobe 1995',
    magnitud: 6.9,
    pga: 8.2,
    duracion: 35,
    archivo: '/examples/Kobe_1995_M6.9.csv',
    descripcion: 'Gran terremoto de Hanshin-Awaji',
    icon: '🇯🇵'
  },
  {
    nombre: 'Terremoto de Loma Prieta 1989',
    magnitud: 6.9,
    pga: 6.3,
    duracion: 30,
    archivo: '/examples/Loma_Prieta_1989_M6.9.csv',
    descripcion: 'San Francisco, World Series earthquake',
    icon: '🇺🇸'
  },
  {
    nombre: 'Terremoto de Northridge 1994',
    magnitud: 6.7,
    pga: 8.5,
    duracion: 32,
    archivo: '/examples/Northridge_1994_M6.7.csv',
    descripcion: 'Los Angeles, uno de los más costosos de EEUU',
    icon: '🇺🇸'
  },
  {
    nombre: 'Terremoto de San Fernando 1971',
    magnitud: 6.6,
    pga: 12.1,
    duracion: 28,
    archivo: '/examples/San_Fernando_1971_M6.6.csv',
    descripcion: 'Sylmar earthquake, Los Angeles',
    icon: '🇺🇸'
  },
  {
    nombre: 'Terremoto de Darfield 2010',
    magnitud: 7.1,
    pga: 10.8,
    duracion: 60,
    archivo: '/examples/Darfield_2010_M7.1.csv',
    descripcion: 'Canterbury earthquake, Nueva Zelanda',
    icon: '🇳🇿'
  },
  {
    nombre: 'Terremoto de Pacoima 1971',
    magnitud: 6.6,
    pga: 12.3,
    duracion: 30,
    archivo: '/examples/Pacoima_Dam.csv',
    descripcion: 'San Fernando earthquake, Pacoima Dam',
    icon: '🇺🇸'
  }
];

  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [activityLog, setActivityLog] = useState([]);
  const [showLog, setShowLog] = useState(true);
  const [esp32Logs, setEsp32Logs] = useState([]);
  const lastMotorState = useRef(null);
  const logRef = useRef(null);
  const fileInputRef = useRef(null);
  const durationRef = useRef(0);
  
  const [deviceStatus, setDeviceStatus] = useState({
    online: false,
    isRunning: false,
    currentFrequency: 0,
    currentAmplitude: 0,
    lastSeen: 0,
    ip: '',
  });

  const [mechanicalConfig, setMechanicalConfig] = useState({
    crankPosition: 1,
    crankRadius: 12,
    maxAmplitude: 24,
    recommendedUse: 'Pequeña',
    maxFrequency: '3-5 Hz'
  });

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

 const visibleData = useMemo(() => {
  // Cargar una ventana más amplia (20 segundos) para renderizado suave
  const bufferSize = 20;
  const startTime = Math.max(0, currentTime - bufferSize / 2);
  const endTime = Math.min(duration, currentTime + bufferSize / 2);
  
  return seismicData.filter(point => point.time >= startTime && point.time <= endTime);
}, [seismicData, currentTime, duration]);

  const yAxisDomain = useMemo(() => {
  if (seismicData.length === 0) return [-10, 10];
  
  const amplitudes = seismicData.map(d => d.amplitude);
  const min = Math.min(...amplitudes);
  const max = Math.max(...amplitudes);
  
  const padding = (max - min) * 0.1;
  
  return [
    Math.floor(min - padding),
    Math.ceil(max + padding)
  ];
}, [seismicData]);

  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('es-AR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    setActivityLog(prev => [{
      id: uniqueId,
      timestamp,
      message,
      type
    }, ...prev].slice(0, 100));
  }, []);

  const addEsp32Log = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('es-AR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    setEsp32Logs(prev => [{
      id: uniqueId,
      timestamp,
      message,
      type
    }, ...prev].slice(0, 100));
  }, []);

  // Escuchar Firebase
  useEffect(() => {
    if (!deviceId) return;
    
    const deviceStatusRef = ref(database, `devices/${deviceId}/status`);
    
    addLog(`Escuchando: ${deviceId}`, 'info');
    
    const unsubscribe = onValue(deviceStatusRef, (snapshot) => {
      if (snapshot.exists()) {
        const status = snapshot.val();
        setFirebaseConnected(true);
        
        if (status.isRunning !== undefined) {
          setIsPlaying(status.isRunning);
        }
        
        if (status.progress !== undefined && status.progress >= 0 && status.progress <= 100) {
          if (durationRef.current > 0) {
            const newTime = (status.progress / 100) * durationRef.current;
            setCurrentTime(newTime);
          }
        }
        
        const now = Math.floor(Date.now() / 1000);
        const isOnline = status.lastSeen && (now - status.lastSeen) < 15;
        setConnectionStatus(isOnline ? 'connected' : 'disconnected');
        
      } else {
        setFirebaseConnected(false);
        setConnectionStatus('disconnected');
      }
    }, (error) => {
      console.error('Error Firebase:', error);
      setFirebaseConnected(false);
      setConnectionStatus('disconnected');
    });

    return () => unsubscribe();
  }, [deviceId, addLog]);

  useEffect(() => {
    if (!deviceId) return;
    
    const commandsRef = ref(database, `devices/${deviceId}/commands`);
    const statusRef = ref(database, `devices/${deviceId}/status`);
    const realtimeRef = ref(database, `devices/${deviceId}/realtime`);
    
    const unsubscribeCommands = onValue(commandsRef, (snapshot) => {
      if (snapshot.exists()) {
        const cmd = snapshot.val();
        
        const actionEmoji = {
          'START': '▶️',
          'STOP': '⏹️',
          'PAUSE': '⏸️',
          'READY': '🟢'
        }[cmd.action] || '📥';
        
        addEsp32Log(`${actionEmoji} ${cmd.action}`, 'command');
        
        if (cmd.amplitude !== undefined && cmd.amplitude > 0) {
          addEsp32Log(`📊 Amplitud: ${cmd.amplitude}mm`, 'data');
        }
        if (cmd.frequency !== undefined && cmd.frequency > 0) {
          addEsp32Log(`🔊 Frecuencia: ${cmd.frequency}Hz`, 'data');
        }
        if (cmd.duration !== undefined && cmd.duration > 0) {
          addEsp32Log(`⏱️ Duración: ${cmd.duration}s`, 'data');
        }
        if (cmd.waveformType !== undefined) {
          const waveforms = {
            0: 'Senoidal',
            1: 'Onda P',
            2: 'Onda S',
            3: 'Sismo Completo',
            4: 'Con Réplicas',
            5: 'Cercano',
            6: 'Lejano'
          };
          addEsp32Log(`🌊 Tipo: ${waveforms[cmd.waveformType] || 'Desconocido'}`, 'data');
        }
      }
    });
    
    const unsubscribeStatus = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        const status = snapshot.val();
        
        if (status.isRunning !== undefined && status.isRunning !== lastMotorState.current) {
          lastMotorState.current = status.isRunning;
          const stateMsg = status.isRunning ? '🟢 Motor: ACTIVO' : '🔴 Motor: PARADO';
          addEsp32Log(stateMsg, status.isRunning ? 'success' : 'info');
        }
        
        if (status.progress !== undefined) {
          const prog = Math.round(status.progress);
          if ([25, 50, 75].includes(prog)) {
            addEsp32Log(`📊 Progreso: ${prog}%`, 'info');
          }
        }
      }
    });
    
    let lastRealtimeLog = 0;
    let sampleCount = 0;
    const unsubscribeRealtime = onValue(realtimeRef, (snapshot) => {
      if (snapshot.exists()) {
        const now = Date.now();
        sampleCount++;
        
        if (now - lastRealtimeLog < 3000) return;
        lastRealtimeLog = now;
        
        const data = snapshot.val();
        
        if (data.time !== undefined && data.amplitude !== undefined) {
          const timeValue = data.time.toFixed(1);
          const ampValue = data.amplitude.toFixed(2);
          const ampEmoji = Math.abs(data.amplitude) > 10 ? '📈' : '📉';
          addEsp32Log(`${ampEmoji} t=${timeValue}s | Amp=${ampValue}mm`, 'info');
        } else if (data.amplitude !== undefined) {
          const ampValue = data.amplitude.toFixed(2);
          const ampEmoji = Math.abs(data.amplitude) > 10 ? '📈' : '📉';
          addEsp32Log(`${ampEmoji} Amplitud: ${ampValue}mm`, 'info');
        }
      }
    });
    
    return () => {
      unsubscribeCommands();
      unsubscribeStatus();
      unsubscribeRealtime();
    };
  }, [deviceId, addEsp32Log]);

  useEffect(() => {
    if (!deviceId) return;
    
    const updateMechanicalConfig = async () => {
      try {
        const configRef = ref(database, `devices/${deviceId}/mechanicalConfig`);
        await set(configRef, {
          crankPosition: crankPosition,
          crankRadius: currentConfig.radius,
          maxAmplitude: currentConfig.amplitude,
          recommendedUse: currentConfig.use,
          maxFrequency: currentConfig.maxFreq,
          mechanismType: 'crank-slider',
          updatedAt: Date.now()
        });
        
        console.log('✅ Config mecánica actualizada:', crankPosition);
        addLog(`⚙️ Config: Pos ${crankPosition} (${currentConfig.amplitude}mm)`, 'info');
      } catch (error) {
        console.error('❌ Error actualizando config mecánica:', error);
        addLog(`❌ Error config: ${error.message}`, 'error');
      }
    };
    
    updateMechanicalConfig();
  }, [crankPosition, currentConfig, deviceId, addLog]);

  useEffect(() => {
    if (!deviceId) return;
    
    const initMechanicalConfig = async () => {
      try {
        const configRef = ref(database, `devices/${deviceId}/mechanicalConfig`);
        await set(configRef, {
          crankPosition: crankPosition,
          crankRadius: currentConfig.radius,
          maxAmplitude: currentConfig.amplitude,
          recommendedUse: currentConfig.use,
          maxFrequency: currentConfig.maxFreq,
          mechanismType: 'crank-slider',
          updatedAt: Date.now()
        });
        
        console.log('✅ Config mecánica inicializada al cargar:', {
          position: crankPosition,
          radius: currentConfig.radius,
          amplitude: currentConfig.amplitude
        });
        addLog(`⚙️ Config inicial: Pos ${crankPosition} (${currentConfig.amplitude}mm)`, 'success');
      } catch (error) {
        console.error('❌ Error inicializando config mecánica:', error);
        addLog(`❌ Error init config: ${error.message}`, 'error');
      }
    };
    
    const timer = setTimeout(() => {
      initMechanicalConfig();
    }, 1000);
    
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ FUNCIÓN PARA CARGAR EJEMPLO DE SISMO
  const cargarEjemplo = async (ejemplo) => {
  try {
    addLog(`📂 Cargando: ${ejemplo.nombre}`, 'info');
    setLoading(true);
    
    const response = await fetch(ejemplo.archivo);
    
    if (!response.ok) {
      throw new Error(`Archivo no encontrado: ${ejemplo.archivo}`);
    }
    
    const csvText = await response.text();
    
    const lines = csvText.trim().split('\n');
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const [time, amplitude] = line.split(',').map(val => parseFloat(val.trim()));
      
      if (!isNaN(time) && !isNaN(amplitude)) {
        data.push({ time, amplitude });
      }
    }
    
    if (data.length === 0) {
      throw new Error('No se encontraron datos válidos en el archivo');
    }
    
    // 🆕 NUEVO: CALCULAR FRECUENCIA DOMINANTE
    try {
       console.log('📊 DATOS CARGADOS:', {
    puntos: data.length,
    primerPunto: data[0],
    ultimoPunto: data[data.length - 1],
    duracion: data[data.length - 1].time - data[0].time
  });
  
  const freqResult = calculateDominantFrequency(data);
  
  console.log('✅ FRECUENCIA CALCULADA:', freqResult);
  
  setDominantFreqResult(freqResult);
  setIsHistoricalMode(true);
      
      // 🆕 NUEVO: ACTUALIZAR CONTROLES AUTOMÁTICAMENTE
      setManualParams(prev => ({
        ...prev,
        frequency: freqResult.frequency,
        duration: freqResult.duration
      }));
      
      setCrankPosition(freqResult.recommendedPosition);
      
      addLog(`✅ ${ejemplo.nombre} cargado (${data.length} puntos)`, 'success');
      addLog(`📊 Frecuencia dominante: ${freqResult.frequency.toFixed(2)} Hz`, 'info');
      addLog(`📐 Período dominante: ${freqResult.period.toFixed(2)} s`, 'info');
      addLog(`🏢 ${freqResult.vulnerableBuildings}`, 'info');
      addLog(`⚙️ Posición biela: ${freqResult.recommendedPosition} (auto)`, 'success');
      
    } catch (calcError) {
      console.warn('⚠️ No se pudo calcular frecuencia dominante:', calcError);
      addLog(`⚠️ Frecuencia no calculada, usando default`, 'warning');
      setDominantFreqResult(null);
      setIsHistoricalMode(false);
      setCrankPosition(ejemplo.posicionRecomendada);
    }
    
    setSeismicData(data);
    setFileName(ejemplo.nombre);
    setDuration(data[data.length - 1].time);
    setCurrentTime(0);
    setIsCSVLoaded(true);
    
  } catch (error) {
    console.error('Error cargando ejemplo:', error);
    addLog(`❌ Error: ${error.message}`, 'error');
    alert(`No se pudo cargar el ejemplo:\n${error.message}\n\nAsegúrate de tener los archivos CSV en la carpeta public/examples/`);
  } finally {
    setLoading(false);
  }
};

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    addLog(`📂 ${file.name}`, 'info');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('deviceId', deviceId);

      const response = await fetch('/api/seismic/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setSeismicData(result.data);
        setFileName(result.fileName);
        setDuration(result.metadata.duration);
        setCurrentTime(0);
        
        addLog(`✅ ${result.data.length} puntos`, 'success');
        alert(`✅ Cargado!\n${result.metadata.totalPoints} puntos\n${result.metadata.duration}s`);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      addLog(`❌ ${error.message}`, 'error');
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ⭐ CAMBIO: generateManualWave usa amplitud automática
  const generateManualWave = async () => {
    addLog(`⚙️ ${manualParams.waveform}`, 'info');
    setLoading(true);
    setIsHistoricalMode(false);
    setDominantFreqResult(null);

    const points = [];
    const samples = manualParams.duration * 100;
    
    // Usar amplitud de configuración mecánica
    const amplitudeToUse = currentConfig.amplitude;
    
    for (let i = 0; i < samples; i++) {
      const t = i / 100;
      let amplitude = 0;
      
      switch (manualParams.waveform) {
        case 'sine':
          amplitude = amplitudeToUse * Math.sin(2 * Math.PI * manualParams.frequency * t);
          break;
          
        case 'square':
          amplitude = amplitudeToUse * Math.sign(Math.sin(2 * Math.PI * manualParams.frequency * t));
          break;
          
        case 'sawtooth':
          amplitude = amplitudeToUse * (2 * (t * manualParams.frequency - Math.floor(t * manualParams.frequency + 0.5)));
          break;
          
        case 'random':
          amplitude = amplitudeToUse * (Math.random() * 2 - 1);
          break;
          
        case 'chirp':
          const freq = manualParams.frequency * (1 + t / manualParams.duration);
          amplitude = amplitudeToUse * Math.sin(2 * Math.PI * freq * t);
          break;
          
        case 'pwave':
          {
            const freq = 8.0;
            const decay = Math.exp(-t * 2.0);
            amplitude = amplitudeToUse * Math.sin(2 * Math.PI * freq * t) * decay;
          }
          break;
          
        case 'swave':
          {
            const freq = 4.0;
            const decay = Math.exp(-t * 1.0);
            amplitude = amplitudeToUse * Math.sin(2 * Math.PI * freq * t) * decay;
          }
          break;
          
        case 'complete':
          {
            if (t < 2.0) {
              const freq = 8.0;
              const decay = Math.exp(-t * 2.0);
              amplitude = amplitudeToUse * 0.3 * Math.sin(2 * Math.PI * freq * t) * decay;
            } else if (t < 6.0) {
              const t2 = t - 2.0;
              const freq = 4.0;
              const decay = Math.exp(-t2 * 1.0);
              amplitude = amplitudeToUse * 0.6 * Math.sin(2 * Math.PI * freq * t2) * decay;
            } else if (t < 15.0) {
              const t2 = t - 6.0;
              const freq = 2.0;
              const decay = Math.exp(-t2 * 0.5);
              amplitude = amplitudeToUse * Math.sin(2 * Math.PI * freq * t2) * decay;
            }
          }
          break;
          
        case 'aftershocks':
          {
            if (t < 15.0) {
              if (t < 2.0) {
                const freq = 8.0;
                const decay = Math.exp(-t * 2.0);
                amplitude = amplitudeToUse * 0.3 * Math.sin(2 * Math.PI * freq * t) * decay;
              } else if (t < 6.0) {
                const t2 = t - 2.0;
                const freq = 4.0;
                const decay = Math.exp(-t2 * 1.0);
                amplitude = amplitudeToUse * 0.6 * Math.sin(2 * Math.PI * freq * t2) * decay;
              } else {
                const t2 = t - 6.0;
                const freq = 2.0;
                const decay = Math.exp(-t2 * 0.5);
                amplitude = amplitudeToUse * Math.sin(2 * Math.PI * freq * t2) * decay;
              }
            } else if (t >= 20.0 && t < 30.0) {
              const t2 = t - 20.0;
              const freq = 5.0;
              const decay = Math.exp(-t2 * 1.5);
              amplitude = amplitudeToUse * 0.4 * Math.sin(2 * Math.PI * freq * t2) * decay;
            } else if (t >= 35.0 && t < 42.0) {
              const t2 = t - 35.0;
              const freq = 4.0;
              const decay = Math.exp(-t2 * 2.0);
              amplitude = amplitudeToUse * 0.25 * Math.sin(2 * Math.PI * freq * t2) * decay;
            }
          }
          break;
          
        case 'near':
          {
            const freq = 10.0;
            const attack = Math.min(t * 5.0, 1.0);
            const decay = Math.exp(-t * 1.5);
            amplitude = amplitudeToUse * Math.sin(2 * Math.PI * freq * t) * attack * decay;
          }
          break;
          
        case 'far':
          {
            const freq = 1.5;
            const attack = Math.min(t * 0.5, 1.0);
            const decay = Math.exp(-t * 0.3);
            amplitude = amplitudeToUse * Math.sin(2 * Math.PI * freq * t) * attack * decay;
          }
          break;
      }
      
      points.push({
        time: parseFloat(t.toFixed(4)),
        amplitude: parseFloat(amplitude.toFixed(3))
      });
    }
    
    setSeismicData(points);
    setFileName(`${manualParams.waveform}_${manualParams.frequency}Hz`);
    setDuration(manualParams.duration);
    setCurrentTime(0);
    setIsCSVLoaded(false);

    setLoading(false);
    addLog(`✅ ${points.length} puntos generados con amplitud ${amplitudeToUse}mm`, 'success');
  };



const handlePlay = async () => {
  if (seismicData.length === 0) {
    alert('Primero genera una onda o carga un CSV');
    return;
  }

  addLog('▶️ START', 'command');
  
  try {
    let frequencyToUse = manualParams.frequency;
    let durationToUse = manualParams.duration;
    
    // 🆕 SI ESTÁ EN MODO HISTÓRICO, USAR FRECUENCIA DOMINANTE
    if (isHistoricalMode && dominantFreqResult) {
      frequencyToUse = dominantFreqResult.frequency;
      durationToUse = dominantFreqResult.duration;
      
      addLog(`🌍 Modo sismo histórico activado`, 'info');
      addLog(`📊 Usando frecuencia dominante: ${frequencyToUse.toFixed(2)} Hz`, 'info');
    }
    
    await set(ref(database, `devices/${deviceId}/commands`), {
      action: 'START',
      frequency: frequencyToUse,
      amplitude: currentConfig.amplitude,
      duration: durationToUse,
      waveformType: manualParams.waveformType,
      crankPosition: crankPosition,
      timestamp: Date.now()
    });
    
    addLog(`✅ ${frequencyToUse.toFixed(2)}Hz, ${currentConfig.amplitude}mm, ${durationToUse}s`, 'success');
    
  } catch (error) {
    addLog(`❌ ${error.message}`, 'error');
  }
};

  const handlePause = async () => {
    addLog('⏸️ PAUSE', 'command');
    
    cancelPlayback.current = true;
    setIsPlaying(false);
    
    try {
      await set(ref(database, `devices/${deviceId}/commands`), {
        action: 'PAUSE',
        timestamp: Date.now()
      });
      addLog('✅ Enviado', 'success');
    } catch (error) {
      addLog(`❌ ${error.message}`, 'error');
    }
  };

  const handleStop = async () => {
    addLog('🛑 STOP', 'command');
    
    cancelPlayback.current = true;
    
    setCurrentTime(0);
    setIsPlaying(false);
    
    try {
      await set(ref(database, `devices/${deviceId}/commands`), {
        action: 'STOP',
        timestamp: Date.now()
      });
      
      await set(ref(database, `devices/${deviceId}/status`), {
        online: true,
        isRunning: false,
        progress: 0,
        lastSeen: Math.floor(Date.now() / 1000)
      });
      
      addLog('✅ STOP + Reset completo', 'success');
    } catch (error) {
      addLog(`❌ ${error.message}`, 'error');
    }
  };

  const handleDownload = () => {
    const csv = 'time,amplitude\n' + seismicData.map(d => `${d.time},${d.amplitude}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName || 'seismic'}.csv`;
    a.click();
    addLog('✅ Exportado', 'success');
  };

  const getCurrentAmplitude = () => {
    if (seismicData.length === 0 || isNaN(currentTime)) return '0.00';
    const validTime = Math.max(0, Math.min(currentTime, duration));
    const point = seismicData.find(d => Math.abs(d.time - validTime) < 0.05);
    return point ? point.amplitude.toFixed(2) : '0.00';
  };

  const openWiFiSettings = () => {
    setShowWiFiModal(true);
  };

  const changeWiFiNetwork = () => {
    if (deviceStatus.ip) {
      window.open(`http://${deviceStatus.ip}`, '_blank');
    } else {
      alert('⚠️ No se puede conectar al dispositivo. IP no disponible.');
    }
  };
const clearHistoricalMode = () => {
  setIsHistoricalMode(false);
  setDominantFreqResult(null);
  addLog('🔓 Modo manual activado', 'info');
};

const estimateFrequencyFromMetadata = (pga, duracion) => {
    let frequency;
    
    if (duracion > 50) {
      if (pga > 15) {
        frequency = 0.8;
      } else if (pga > 10) {
        frequency = 1.2;
      } else {
        frequency = 1.5;
      }
    } else if (duracion > 30) {
      if (pga > 12) {
        frequency = 1.2;
      } else if (pga > 8) {
        frequency = 1.5;
      } else {
        frequency = 1.8;
      }
    } else {
      if (pga > 10) {
        frequency = 1.5;
      } else if (pga > 6) {
        frequency = 2.0;
      } else {
        frequency = 2.5;
      }
    }
    
    frequency = Math.min(2.5, Math.max(0.5, frequency));
    
    let recommendedPosition;
    if (frequency >= 2.5) {
      recommendedPosition = 2;
    } else if (frequency >= 1.8) {
      recommendedPosition = 3;
    } else if (frequency >= 1.2) {
      recommendedPosition = 4;
    } else {
      recommendedPosition = 5;
    }
    
    return { frequency, recommendedPosition };
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-800/50 backdrop-blur rounded-lg p-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 hidden md:block relative">
                <Image 
                  src="/utn-logo.png" 
                  alt="UTN Logo" 
                  width={64}
                  height={64}
                  className="object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                  <Zap className="w-10 h-10 text-yellow-400" />
                  Mesa Vibratoria Sísmica
                </h1>
                <p className="text-gray-300">Universidad Tecnológica Nacional - Control Remoto Cloud</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                firebaseConnected ? 'bg-green-900/30 border border-green-500/50' : 'bg-red-900/30 border border-red-500/50'
              }`}>
                <Cloud className={`w-5 h-5 ${firebaseConnected ? 'text-green-400' : 'text-red-400'}`} />
                <span className={`font-semibold ${firebaseConnected ? 'text-green-300' : 'text-red-300'}`}>
                  Firebase: {firebaseConnected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                connectionStatus === 'connected' ? 'bg-green-900/30 border border-green-500/50' : 'bg-orange-900/30 border border-orange-500/50'
              }`}>
                {connectionStatus === 'connected' ? 
                  <Wifi className="w-5 h-5 text-green-400" /> : 
                  <WifiOff className="w-5 h-5 text-orange-400" />
                }
                <span className={`font-semibold ${connectionStatus === 'connected' ? 'text-green-300' : 'text-orange-300'}`}>
                  ESP32: {connectionStatus === 'connected' ? 'Online' : 'Offline'}
                </span>
              </div>

              <button
                onClick={openWiFiSettings}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-all"
              >
                <Wifi className="w-5 h-5" />
                Configurar WiFi
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel Izquierdo */}
          <div className="lg:col-span-1 space-y-6">
             {/* 🆕 NUEVO: BANNER DE MODO HISTÓRICO */}
  {isHistoricalMode && dominantFreqResult && (
    <div className="bg-blue-900/30 border-2 border-blue-500/50 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-semibold text-blue-300 flex items-center text-sm">
            <span className="mr-2">🌍</span>
            Modo Sismo Histórico Activo
          </h4>
          <p className="text-xs text-blue-200 mt-1">
            Los controles están configurados automáticamente
          </p>
        </div>
        <button
          onClick={clearHistoricalMode}
          className="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded transition-colors"
        >
          🔓 Desbloquear
        </button>
      </div>
      <div className="text-xs text-blue-200 space-y-1 mt-2">
        <div className="flex justify-between">
          <span>Frecuencia:</span>
          <span className="font-mono font-bold">{dominantFreqResult.frequency.toFixed(2)} Hz</span>
        </div>
        <div className="flex justify-between">
          <span>Posición biela:</span>
          <span className="font-mono font-bold">{dominantFreqResult.recommendedPosition}</span>
        </div>
      </div>
    </div>
  )}
            {/* Cargar CSV */}
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Cargar Archivo
              </h2>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-3 rounded-lg transition font-semibold flex items-center justify-center gap-2"
              >
                <FileText className="w-5 h-5" />
                {loading ? 'Procesando...' : 'Seleccionar CSV'}
              </button>
              
              {fileName && (
                <div className="mt-4 p-3 bg-green-900/20 border border-green-500/50 rounded-lg">
                  <p className="text-sm text-green-300 break-all">
                    <strong>{fileName}</strong>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {seismicData.length} muestras • {duration.toFixed(1)}s
                  </p>
                </div>
              )}
            </div>

            {/* BOTÓN MODAL SISMOS */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-blue-500/30">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-blue-400" />
                Ejemplos de Sismos Reales
              </h2>
              
              <button
                onClick={() => setMostrarModalSismos(true)}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 
                           text-white rounded-lg p-4 transition-all duration-200 
                           flex items-center justify-center space-x-3 border border-blue-400/20 hover:border-blue-300/40 group"
              >
                <FileText className="h-6 w-6 group-hover:scale-110 transition-transform" />
                <span className="text-lg font-semibold">Ver Sismos Históricos</span>
                <span className="bg-white/20 px-2 py-1 rounded text-sm">{EJEMPLOS_SISMOS.length}</span>
              </button>
              
              <div className="mt-3 bg-blue-900/20 border border-blue-600/30 rounded-lg p-3">
                <p className="text-xs text-blue-200 flex items-center">
                  <span className="mr-2">🌍</span>
                  Sismos históricos de Japón, Chile, México, EEUU, Nueva Zelanda y más.
                </p>
              </div>
            </div>
            {/* 🆕 NOTA EDUCATIVA MEJORADA */}
{isHistoricalMode && dominantFreqResult && (
  <div className="bg-gradient-to-br from-blue-50/10 to-indigo-50/10 border-2 border-blue-300/50 rounded-lg p-4">
    <h4 className="font-semibold text-blue-300 mb-3 flex items-center text-sm">
      <span className="mr-2">📚</span>
      Nota Educativa - Frecuencia Dominante
    </h4>
    
    {/* Información del cálculo */}
    <div className="bg-white/5 rounded-lg p-3 mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">Cruces por cero:</span>
        <span className="font-mono text-blue-300">{dominantFreqResult.zeroCrossings}</span>
      </div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">Duración registro:</span>
        <span className="font-mono text-blue-300">{dominantFreqResult.duration.toFixed(1)}s</span>
      </div>
      <div className="border-t border-gray-600/30 pt-2 mt-2">
        <div className="flex justify-between text-xs">
          <span className="text-gray-300 font-medium">Frecuencia dominante:</span>
          <span className="font-mono font-bold text-indigo-400">
            {dominantFreqResult.frequency.toFixed(2)} Hz
          </span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-gray-300 font-medium">Período dominante:</span>
          <span className="font-mono font-bold text-indigo-400">
            {dominantFreqResult.period.toFixed(2)} s
          </span>
        </div>
      </div>
    </div>

    {/* Estructuras vulnerables */}
    <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-2 mb-3">
      <p className="text-xs text-amber-300">
        <strong>🏢 Estructuras vulnerables:</strong><br/>
        {dominantFreqResult.vulnerableBuildings}
      </p>
    </div>

    {/* Limitación del sistema */}
    <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-2">
      <p className="text-xs text-yellow-200">
        <strong>⚠️ Limitación:</strong> Este sistema reproduce solo la <strong>frecuencia dominante</strong> mediante 
        movimiento sinusoidal. Los sismos reales tienen un <strong>espectro de respuesta completo</strong> con 
        múltiples frecuencias simultáneas que varían en el tiempo.
      </p>
    </div>
  </div>
)}
            {/* Generador - ⭐ SIN SLIDER DE AMPLITUD */}
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Generar Onda
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-2">Tipo</label>
                  <select
                    value={manualParams.waveform}
                    onChange={(e) => {
                      const value = e.target.value;
                      let waveformType = 0;
                      let recommendedDuration = manualParams.duration;
                      
                      switch(value) {
                        case 'sine': 
                          waveformType = 0; 
                          recommendedDuration = 10;
                          break;
                        case 'pwave': 
                          waveformType = 1; 
                          recommendedDuration = 5;
                          break;
                        case 'swave': 
                          waveformType = 2;
                          recommendedDuration = 8;
                          break;
                        case 'complete': 
                          waveformType = 3;
                          recommendedDuration = 15;
                          break;
                        case 'aftershocks': 
                          waveformType = 4;
                          recommendedDuration = 45;
                          break;
                        case 'near': 
                          waveformType = 5;
                          recommendedDuration = 10;
                          break;
                        case 'far': 
                          waveformType = 6;
                          recommendedDuration = 20;
                          break;
                        default: 
                          waveformType = 0;
                          recommendedDuration = 10;
                      }
                      
                      setManualParams({
                        ...manualParams, 
                        waveform: value, 
                        waveformType: waveformType,
                        duration: recommendedDuration
                      });
                    }}
                    className="w-full bg-slate-700 px-3 py-2 rounded-lg"
                    disabled={isHistoricalMode}
                    >
                    <optgroup label="Ondas Básicas">
                      <option value="sine">🌊 Senoidal</option>
                      <option value="square">⬜ Cuadrada</option>
                      <option value="sawtooth">📐 Sierra</option>
                      <option value="random">🎲 Aleatoria</option>
                      <option value="chirp">📶 Chirp</option>
                    </optgroup>
                    <optgroup label="🌋 Sismos Sintéticos">
                      <option value="pwave">⚡ Onda P (Primaria - 5s)</option>
                      <option value="swave">〰️ Onda S (Secundaria - 8s)</option>
                      <option value="complete">🌍 Sismo Completo (15s)</option>
                      <option value="aftershocks">💥 Con Réplicas (45s)</option>
                      <option value="near">📍 Sismo Cercano (10s)</option>
                      <option value="far">🌏 Sismo Lejano (20s)</option>
                    </optgroup>
                  </select>
                </div>
                
                {/* ⭐ AMPLITUD AUTOMÁTICA (SIN SLIDER) */}
                <div className="bg-purple-900/20 border border-purple-600/30 rounded-lg p-4">
                  <label className="block text-sm font-semibold mb-3 text-purple-300">
                    💡 Amplitud (Automática según posición)
                  </label>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300">Amplitud máxima:</span>
                    <span className="font-mono text-2xl font-bold text-green-400">
                      {currentConfig.amplitude} mm
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-300">Posición biela:</span>
                    <span className="font-mono text-xl font-bold text-purple-400">
                      {crankPosition}
                    </span>
                  </div>
                  <div className="bg-yellow-900/20 border border-yellow-600/30 rounded p-2">
                    <p className="text-xs text-yellow-200 flex items-center">
                      <span className="mr-2">⚠️</span>
                      La amplitud se ajusta automáticamente según la posición física de la biela para evitar daños mecánicos
                    </p>
                  </div>
                </div>
                
                <div>
                 <label className="block text-sm mb-2">
  Frecuencia (Hz): {manualParams.frequency.toFixed(1)}
  {isHistoricalMode && <span className="text-yellow-400 ml-2">🔒 Bloqueado</span>} {/* 🆕 NUEVO */}
</label>
<input
  type="range"
  min="0.5"
  max="10"
  step="0.1"
  value={manualParams.frequency}
  onChange={(e) => setManualParams({...manualParams, frequency: parseFloat(e.target.value)})}
  className="w-full"
  disabled={isHistoricalMode} // 🆕 NUEVO
/>
                </div>
                
                <div>
                  <label className="block text-sm mb-2">
  Duración (s): {manualParams.duration}
  {isHistoricalMode && <span className="text-yellow-400 ml-2">🔒 Bloqueado</span>} {/* 🆕 NUEVO */}
</label>
<input
  type="range"
  min="5"
  max="60"
  value={manualParams.duration}
  onChange={(e) => setManualParams({...manualParams, duration: parseInt(e.target.value)})}
  className="w-full"
  disabled={isHistoricalMode} // 🆕 NUEVO
/>
                </div>
                
                <button
                  onClick={generateManualWave}
                  disabled={loading}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-4 py-3 rounded-lg transition font-semibold flex items-center justify-center gap-2"
                >
                  <TrendingUp className="w-5 h-5" />
                  Generar
                </button>
              </div>
            </div>


            {/* Panel de Configuración Mecánica */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <Settings className="h-5 w-5 mr-2 text-purple-400" />
                Configuración Mecánica
              </h2>
              
              <div className="space-y-4">
                <div>
                <label className="block text-sm font-medium mb-2">
  Posición de la Biela: {crankPosition}
  {isHistoricalMode && <span className="text-yellow-400 ml-2">🔒 Auto</span>} {/* 🆕 NUEVO */}
</label>
<input
  type="range"
  min="1"
  max="5"
  step="1"
  value={crankPosition}
  onChange={(e) => setCrankPosition(parseInt(e.target.value))}
  className="w-full accent-purple-500"
  disabled={isHistoricalMode} // 🆕 NUEVO
/>
                  <div className="flex justify-between text-xs text-purple-300 mt-1">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                    <span>5</span>
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-purple-300">Radio manivela:</span>
                    <span className="font-mono font-bold text-white">{currentConfig.radius} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-300">Amplitud máxima:</span>
                    <span className="font-mono font-bold text-green-400">{currentConfig.amplitude} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-300">Uso recomendado:</span>
                    <span className="font-medium text-blue-400">{currentConfig.use}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-300">Freq. máx. recom.:</span>
                    <span className="font-medium text-yellow-400">{currentConfig.maxFreq}</span>
                  </div>
                </div>

                {manualParams.frequency > 3 && crankPosition >= 4 && !isHistoricalMode && ( 
                  <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-3 flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-200">
                      <p className="font-semibold">⚠️ Advertencia</p>
                      <p>Frecuencia alta para posición {crankPosition}. Reduce a {currentConfig.maxFreq} para mejor rendimiento.</p>
                    </div>
                  </div>
                )}

                <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-3">
                  <p className="text-xs text-blue-200 flex items-center">
                    <span className="mr-2">ℹ️</span>
                    Sistema biela-manivela: movimiento circular convertido a lineal sinusoidal
                  </p>
                </div>
              </div>
            </div>

            {/* Device ID */}
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">ID Dispositivo</h2>
              <input
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="w-full bg-slate-700 px-3 py-2 rounded-lg"
                placeholder="LAB_01"
              />
            </div>
          </div>

          {/* Panel Derecho */}
          <div className="lg:col-span-2 space-y-6">
            {/* Gráfico */}
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Visualización en Tiempo Real
              </h2>
              
              {seismicData.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={visibleData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorAmplitude" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      
                     <XAxis 
                        dataKey="time" 
                        stroke="#9CA3AF"
                        domain={[
                          Math.max(0, currentTime - 7.5),
                          Math.min(duration, currentTime + 7.5)
                        ]}
                        type="number"
                        label={{ value: 'Tiempo (s)', position: 'insideBottom', offset: -5 }}
                        tickFormatter={(value) => value.toFixed(1)}
                        allowDataOverflow={true}
                      />
                      
                      <YAxis 
                        stroke="#9CA3AF"
                        domain={(() => {
                          if (seismicData.length === 0) return [-100, 100];
                          
                          const amps = seismicData.map(d => d.amplitude);
                          const min = Math.min(...amps);
                          const max = Math.max(...amps);
                          const padding = Math.max(10, (max - min) * 0.15);
                          
                          return [
                            Math.floor(min - padding),
                            Math.ceil(max + padding)
                          ];
                        })()}
                        label={{ value: 'Amplitud (mm)', angle: -90, position: 'insideLeft' }}
                        width={60}
                      />
                      
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1e293b', 
                          border: '1px solid #475569',
                          borderRadius: '8px',
                          padding: '8px'
                        }}
                        labelStyle={{ color: '#e5e7eb', fontWeight: 'bold' }}
                        formatter={(value) => [value.toFixed(2) + ' mm', 'Amplitud']}
                        labelFormatter={(value) => 'Tiempo: ' + value.toFixed(2) + 's'}
                      />
                      
                      <ReferenceLine 
                        x={currentTime} 
                        stroke="#ef4444" 
                        strokeWidth={3} 
                        strokeDasharray="5 5"
                        label={{ 
                          value: `${currentTime.toFixed(1)}s`, 
                          position: 'top', 
                          fill: '#ef4444',
                          fontSize: 14,
                          fontWeight: 'bold'
                        }} 
                      />
                      
                      <Line 
                        type="monotone" 
                        dataKey="amplitude" 
                        stroke="#3b82f6" 
                        strokeWidth={2.5}
                        dot={false}
                        animationDuration={0}
                        isAnimationActive={false}
                        fill="url(#colorAmplitude)"
                        fillOpacity={0.3}
                      />
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Métricas */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                      <div className="text-sm text-gray-400">Tiempo</div>
                      <div className="text-2xl font-bold">
                        {currentTime.toFixed(2)}s
                      </div>
                    </div>
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                      <div className="text-sm text-gray-400">Amplitud</div>
                      <div className="text-2xl font-bold text-blue-400">{getCurrentAmplitude()}mm</div>
                    </div>
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                      <div className="text-sm text-gray-400">Duración</div>
                      <div className="text-2xl font-bold">{duration.toFixed(1)}s</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-purple-500/30">
                      <p className="text-sm text-purple-300 mb-1">Posición biela</p>
                      <p className="text-2xl font-bold">{crankPosition}</p>
                      <p className="text-xs text-purple-400 mt-1">Radio: {currentConfig.radius}mm</p>
                    </div>
                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-purple-500/30">
                      <p className="text-sm text-purple-300 mb-1">Amplitud real</p>
                      <p className="text-2xl font-bold">{currentConfig.amplitude}mm</p>
                      <p className="text-xs text-purple-400 mt-1">Pico a pico</p>
                    </div>
                  </div>

                  {/* Barra */}
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max={duration}
                      step="0.01"
                      value={currentTime}
                      onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                      className="w-full"
                      disabled={isPlaying}
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>0s</span>
                      <span>{duration > 0 ? ((currentTime / duration) * 100).toFixed(1) : 0}%</span>
                      <span>{duration.toFixed(1)}s</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Carga un archivo o genera una onda</p>
                  </div>
                </div>
              )}
            </div>

            {/* Controles */}
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Controles</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={handlePlay}
                  disabled={seismicData.length === 0 || isPlaying || loading || !firebaseConnected}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-3 rounded-lg transition flex flex-col items-center justify-center gap-2 font-semibold"
                >
                  <Play className="w-6 h-6" />
                  <span className="text-sm">Iniciar</span>
                </button>
                
                <button
                  onClick={handlePause}
                  disabled={!isPlaying}
                  className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-3 rounded-lg transition flex flex-col items-center justify-center gap-2 font-semibold"
                >
                  <Pause className="w-6 h-6" />
                  <span className="text-sm">Pausar</span>
                </button>
                
                <button
                  onClick={handleStop}
                  disabled={seismicData.length === 0}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-3 rounded-lg transition flex flex-col items-center justify-center gap-2 font-semibold"
                >
                  <Square className="w-6 h-6" />
                  <span className="text-sm">Detener</span>
                </button>

                <button
                  onClick={handleDownload}
                  disabled={seismicData.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-3 rounded-lg transition flex flex-col items-center justify-center gap-2 font-semibold"
                >
                  <Download className="w-6 h-6" />
                  <span className="text-sm">Exportar</span>
                </button>
              </div>
            </div>

            {/* Monitor ESP32 */}
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    Monitor ESP32
                  </h2>
                  {isPlaying && (
                    <div className="flex items-center gap-2 px-2 py-1 bg-green-500/20 rounded-full">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-300 font-medium">EN VIVO</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEsp32Logs([])}
                    className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded transition disabled:opacity-50"
                    disabled={esp32Logs.length === 0}
                  >
                    🗑️ Limpiar
                  </button>
                  <button
                    onClick={() => {
                      const text = esp32Logs.map(log => `[${log.timestamp}] ${log.message}`).join('\n');
                      navigator.clipboard.writeText(text);
                      addLog('📋 Logs copiados', 'success');
                    }}
                    className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded transition disabled:opacity-50"
                    disabled={esp32Logs.length === 0}
                  >
                    📋 Copiar
                  </button>
                </div>
              </div>
              
              {esp32Logs.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="bg-slate-900/50 rounded p-2 text-center">
                    <div className="text-xs text-slate-400">Total Logs</div>
                    <div className="text-lg font-bold text-blue-400">{esp32Logs.length}</div>
                  </div>
                  <div className="bg-slate-900/50 rounded p-2 text-center">
                    <div className="text-xs text-slate-400">Comandos</div>
                    <div className="text-lg font-bold text-green-400">
                      {esp32Logs.filter(l => l.type === 'command').length}
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded p-2 text-center">
                    <div className="text-xs text-slate-400">Datos</div>
                    <div className="text-lg font-bold text-cyan-400">
                      {esp32Logs.filter(l => l.type === 'data').length}
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded p-2 text-center">
                    <div className="text-xs text-slate-400">Errores</div>
                    <div className="text-lg font-bold text-red-400">
                      {esp32Logs.filter(l => l.type === 'error').length}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs h-64 overflow-y-auto">
                {esp32Logs.length === 0 ? (
                  <div className="text-slate-500 italic text-center py-8 flex flex-col items-center gap-2">
                    <Activity className="w-8 h-8 opacity-50" />
                    <p>Esperando datos del ESP32...</p>
                    <p className="text-xs">Los comandos y datos aparecerán aquí</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {esp32Logs.map((log) => (
                      <div 
                        key={log.id}
                        className={`${
                          log.type === 'error' ? 'text-red-400' :
                          log.type === 'success' ? 'text-green-400' :
                          log.type === 'warning' ? 'text-yellow-400' :
                          log.type === 'command' ? 'text-blue-400' :
                          log.type === 'data' ? 'text-cyan-400' :
                          'text-slate-300'
                        }`}
                      >
                        <span className="text-slate-600">[{log.timestamp}]</span> {log.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Log */}
        <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
          <div className="bg-slate-900/95 backdrop-blur-lg rounded-lg shadow-2xl border border-slate-700">
            <div 
              className="flex items-center justify-between p-3 border-b border-slate-700 cursor-pointer hover:bg-slate-800/50 transition"
              onClick={() => setShowLog(!showLog)}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-400" />
                <span className="font-semibold text-sm">Log</span>
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                  {activityLog.length}
                </span>
              </div>
              <button className="text-gray-400">{showLog ? '▼' : '▲'}</button>
            </div>
            
            {showLog && (
              <>
                <div ref={logRef} className="max-h-96 overflow-y-auto p-3 space-y-2 text-xs font-mono">
                  {activityLog.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <p>Sin actividad</p>
                    </div>
                  ) : (
                    activityLog.map((log) => (
                      <div 
                        key={log.id}
                        className={`p-2 rounded border-l-2 ${
                          log.type === 'error' ? 'bg-red-900/20 border-red-500 text-red-200' :
                          log.type === 'success' ? 'bg-green-900/20 border-green-500 text-green-200' :
                          log.type === 'command' ? 'bg-blue-900/20 border-blue-500 text-blue-200' :
                          'bg-slate-800/50 border-slate-600 text-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-gray-500 shrink-0">{log.timestamp}</span>
                          <span className="break-all">{log.message}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="p-2 border-t border-slate-700 flex justify-between">
                  <button
                    onClick={() => setActivityLog([])}
                    className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800"
                  >
                    🗑️ Limpiar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ✅ MODAL DE SISMOS */}
      {mostrarModalSismos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl border-2 border-blue-500/50 max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Sismos Históricos</h2>
                  <p className="text-blue-100 text-sm">{EJEMPLOS_SISMOS.length} eventos sísmicos disponibles</p>
                </div>
              </div>
              <button
                onClick={() => setMostrarModalSismos(false)}
                className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {EJEMPLOS_SISMOS.map((ejemplo, index) => {
                  // 🆕 CALCULAR frecuencia y posición ANTES de renderizar
                  const { frequency, recommendedPosition } = estimateFrequencyFromMetadata(
                    ejemplo.pga, 
                    ejemplo.duracion
                  );

                  return (
                    <button
                      key={index}
                      onClick={() => {
                        cargarEjemplo(ejemplo);
                        setMostrarModalSismos(false);
                      }}
                      disabled={loading}
                      className="bg-slate-800/50 hover:bg-slate-700/70 border-2 border-slate-700 hover:border-blue-500 
                                rounded-xl p-4 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                                flex items-start space-x-4 text-left group"
                    >
                      <div className="text-4xl mt-1 group-hover:scale-110 transition-transform">
                        {ejemplo.icon}
                      </div>
                      
                      <div className="flex-1">
                        <div className="font-semibold text-white text-base mb-1 group-hover:text-blue-300 transition-colors">
                          {ejemplo.nombre}
                        </div>
                        <div className="text-sm text-gray-400 mb-2">
                          {ejemplo.descripcion}
                        </div>
                        <div className="flex items-center space-x-2 text-xs">
                          <span className="bg-red-500/20 text-red-300 px-2 py-1 rounded-md font-mono font-bold border border-red-500/30">
                            M {ejemplo.magnitud}
                          </span>
                          <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded-md border border-purple-500/30">
                            Pos. {recommendedPosition}
                          </span>
                          <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-md font-mono border border-blue-500/30">
                            ~{frequency.toFixed(1)} Hz
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-blue-400 group-hover:translate-x-1 transition-transform">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">💡</span>
                  <div className="flex-1 text-sm text-blue-200">
                    <p className="font-semibold mb-1">Recomendaciones:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Usa la posición de biela sugerida para cada sismo</li>
                      <li>Los sismos de mayor magnitud (M 8+) requieren posición 5</li>
                      <li>Verifica que el motor esté calibrado antes de iniciar</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 p-4 flex justify-end border-t border-slate-700">
              <button
                onClick={() => setMostrarModalSismos(false)}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ MODAL WIFI MEJORADO */}
      {showWiFiModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-bold mb-4">📡 Configuración WiFi</h3>
            
            <div className="space-y-4 mb-6">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-bold mb-2">Opción 1: Botón Físico (Recomendado)</h4>
                <ol className="text-sm space-y-1 text-gray-300">
                  <li>1. Mantén presionado el botón <strong>BOOT</strong> del ESP32</li>
                  <li>2. Espera <strong>3 segundos</strong></li>
                  <li>3. El dispositivo se reiniciará en modo configuración</li>
                  <li>4. Conéctate a la red <strong>&quot;Simulador_Config&quot;</strong></li>
                  <li>5. Contraseña: <strong>12345678</strong></li>
                  <li>6. Abre tu navegador (se abrirá automáticamente)</li>
                  <li>7. Ingresa tu nueva red WiFi</li>
                </ol>
              </div>

              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <h4 className="font-bold mb-2">Opción 2: Portal Web</h4>
                <p className="text-sm text-gray-300 mb-3">
                  Si el dispositivo está conectado y conoces su IP:
                </p>
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded p-3 mb-3">
                  <p className="text-xs text-yellow-200">
                    💡 <strong>Tip:</strong> La IP aparece en el monitor serial del ESP32 al conectarse
                  </p>
                </div>
                <button
                  onClick={() => {
                    const ip = prompt('Ingresa la IP del ESP32 (ejemplo: 192.168.1.100):');
                    if (ip && ip.trim()) {
                      window.open(`http://${ip.trim()}`, '_blank');
                    }
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  🌐 Ingresar IP Manualmente
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowWiFiModal(false)}
              className="w-full bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-semibold transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
