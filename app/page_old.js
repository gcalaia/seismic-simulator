'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Upload, Play, Pause, Square, Settings, TrendingUp, 
  Download, AlertCircle, Wifi, WifiOff, FileText,
  Zap, Activity, Cloud
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { database } from '../lib/firebase';
import { ref, set, onValue } from 'firebase/database';

export default function Home() {
  const [seismicData, setSeismicData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [loading, setLoading] = useState(false);
  const [mostrarModalSismos, setMostrarModalSismos] = useState(false);
  
  // Bandera para cancelar reproducción
  const cancelPlayback = useRef(false);
  
  const [manualParams, setManualParams] = useState({
    amplitude: 50,
    frequency: 2.0,
    duration: 10,
    waveform: 'sine',
    waveformType: 0 // Para sismos sintéticos
  });

  const [deviceId, setDeviceId] = useState('LAB_01');
   const [crankPosition, setCrankPosition] = useState(5); // Posición 1-5
  
  // Tabla de configuraciones mecánicas
  const CRANK_CONFIG = {
    1: { radius: 12, amplitude: 24, use: 'Pequeña', maxFreq: '3-5 Hz' },
    2: { radius: 20, amplitude: 40, use: 'Media Baja', maxFreq: '2-4 Hz' },
    3: { radius: 28, amplitude: 56, use: 'Media', maxFreq: '1-3 Hz' },
    4: { radius: 36, amplitude: 72, use: 'Media Alta', maxFreq: '0.5-2 Hz' },
    5: { radius: 44, amplitude: 88, use: 'Grande', maxFreq: '0.5-2 Hz' }
  };
  
  // Obtener configuración actual
  const currentConfig = CRANK_CONFIG[crankPosition];
  
  
  // Ejemplos de sismos reales - NOMBRES EXACTOS CON GUION BAJO
  const EJEMPLOS_SISMOS = [
    {
      nombre: 'Terremoto de Japón (Tohoku) 2011',
      magnitud: 9.1,
      archivo: '/ejemplos/Tohoku_2011_M9_1.csv',
      descripcion: 'Tohoku, uno de los más potentes registrados',
      posicionRecomendada: 5,
      icon: '🇯🇵'
    },
    {
      nombre: 'Terremoto de Chile 2010',
      magnitud: 8.8,
      archivo: '/ejemplos/Chile_2010_M8_8.csv',
      descripcion: 'Maule, uno de los mayores en la historia de Chile',
      posicionRecomendada: 5,
      icon: '🇨🇱'
    },
    {
      nombre: 'Terremoto de México 2017',
      magnitud: 7.1,
      archivo: '/ejemplos/Mexico_2017_M7_1.csv',
      descripcion: 'Puebla-Morelos, altamente destructivo',
      posicionRecomendada: 4,
      icon: '🇲🇽'
    },
    {
      nombre: 'Terremoto de Chi-Chi 1999',
      magnitud: 7.6,
      archivo: '/ejemplos/Chi-Chi_1999_M7_6.csv',
      descripcion: 'Taiwan, uno de los más grandes de Asia',
      posicionRecomendada: 4,
      icon: '🇹🇼'
    },
    {
      nombre: 'Terremoto de Christchurch 2011',
      magnitud: 6.2,
      archivo: '/ejemplos/Christchurch_2011_M6_2.csv',
      descripcion: 'Nueva Zelanda, altamente destructivo',
      posicionRecomendada: 3,
      icon: '🇳🇿'
    },
    {
      nombre: 'Terremoto de Kobe 1995',
      magnitud: 6.9,
      archivo: '/ejemplos/Kobe_1995_M6_9.csv',
      descripcion: 'Gran terremoto de Hanshin-Awaji',
      posicionRecomendada: 4,
      icon: '🇯🇵'
    },
    {
      nombre: 'Terremoto de Loma Prieta 1989',
      magnitud: 6.9,
      archivo: '/ejemplos/Loma_Prieta_1989_M6_9.csv',
      descripcion: 'San Francisco, World Series earthquake',
      posicionRecomendada: 4,
      icon: '🇺🇸'
    },
    {
      nombre: 'Terremoto de Northridge 1994',
      magnitud: 6.7,
      archivo: '/ejemplos/Northridge_1994_M6_7.csv',
      descripcion: 'Los Angeles, uno de los más costosos de EEUU',
      posicionRecomendada: 4,
      icon: '🇺🇸'
    },
    {
      nombre: 'Terremoto de San Fernando 1971',
      magnitud: 6.6,
      archivo: '/ejemplos/San_Fernando_1971_M6_6.csv',
      descripcion: 'Sylmar earthquake, Los Angeles',
      posicionRecomendada: 3,
      icon: '🇺🇸'
    },
    {
      nombre: 'Terremoto de Darfield 2010',
      magnitud: 7.1,
      archivo: '/ejemplos/Darfield_2010_M7_1.csv',
      descripcion: 'Canterbury earthquake, Nueva Zelanda',
      posicionRecomendada: 4,
      icon: '🇳🇿'
    }
  ];
  
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [activityLog, setActivityLog] = useState([]);
  const [showLog, setShowLog] = useState(true);
  const logRef = useRef(null);
  const fileInputRef = useRef(null);
  const [esp32Logs, setEsp32Logs] = useState([]);
  const lastMotorState = useRef(null);
  const durationRef = useRef(0);
  
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Calcular datos visibles
  const visibleData = useMemo(() => {
    const windowSize = 10;
    const startTime = Math.max(0, currentTime - windowSize / 2);
    const endTime = Math.min(duration, currentTime + windowSize / 2);
    
    return seismicData.filter(d => 
      d.time >= startTime && d.time <= endTime
    );
  }, [seismicData, currentTime, duration]);

  // Agregar log simple
  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('es-AR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    const uniqueId = Date.now() + Math.random();
    
    setActivityLog(prev => [{ id: uniqueId, timestamp, message, type }, ...prev].slice(0, 100));
  }, []);

  // Agregar log ESP32 simple
  const addEsp32Log = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('es-AR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    const uniqueId = Date.now() + Math.random();
    
    setEsp32Logs(prev => [{ id: uniqueId, timestamp, message, type }, ...prev].slice(0, 100));
  }, []);
    
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

  // NUEVO: Escuchar comandos y realtime del ESP32
  useEffect(() => {
    if (!deviceId) return;
    
    const commandsRef = ref(database, `devices/${deviceId}/commands`);
    const statusRef = ref(database, `devices/${deviceId}/status`);
    const realtimeRef = ref(database, `devices/${deviceId}/realtime`);
    
    // Listener de comandos
    const unsubscribeCommands = onValue(commandsRef, (snapshot) => {
      if (snapshot.exists()) {
        const cmd = snapshot.val();
        
        // Log del comando principal
        const actionEmoji = {
          'START': '▶️',
          'STOP': '⏹️',
          'PAUSE': '⏸️',
          'READY': '🟢'
        }[cmd.action] || '📥';
        
        addEsp32Log(`${actionEmoji} ${cmd.action}`, 'command');
        
        // Logs de parámetros (solo si existen)
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
    
    // Listener de estado
    const unsubscribeStatus = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        const status = snapshot.val();
        
        // Log cuando cambia el estado (NO repetir constantemente)
        if (status.isRunning !== undefined && status.isRunning !== lastMotorState.current) {
          lastMotorState.current = status.isRunning;
          const stateMsg = status.isRunning ? '🟢 Motor: ACTIVO' : '🔴 Motor: PARADO';
          addEsp32Log(stateMsg, status.isRunning ? 'success' : 'info');
        }
        
        // Log de progreso (solo en hitos importantes)
        if (status.progress !== undefined) {
          const prog = Math.round(status.progress);
          if ([25, 50, 75].includes(prog)) {
            addEsp32Log(`📊 Progreso: ${prog}%`, 'info');
          }
        }
      }
    });
    
    // Listener de datos en tiempo real (limitado para no saturar)
    let lastRealtimeLog = 0;
    let sampleCount = 0;
    const unsubscribeRealtime = onValue(realtimeRef, (snapshot) => {
      if (snapshot.exists()) {
        const now = Date.now();
        sampleCount++;
        
        // Solo logear cada 3 segundos para evitar spam
        if (now - lastRealtimeLog < 3000) return;
        lastRealtimeLog = now;
        
        const data = snapshot.val();
        
        // Mostrar tiempo y amplitud juntos si ambos existen
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


  // ✅ Actualizar configuración mecánica en Firebase cuando cambia la posición
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

  // ✅ Inicializar configuración mecánica al cargar la app (una sola vez)
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
    
    // Ejecutar con un pequeño delay para asegurar que Firebase esté listo
    const timer = setTimeout(() => {
      initMechanicalConfig();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []); // Array vacío = solo se ejecuta una vez al montar el componente


  // Cargar CSV

  // Cargar ejemplo de sismo real
  const cargarEjemplo = async (ejemplo) => {
    try {
      addLog(`📂 Cargando: ${ejemplo.nombre}`, 'info');
      setLoading(true);
      
      // Descargar el archivo
      const response = await fetch(ejemplo.archivo);
      
      if (!response.ok) {
        throw new Error(`Archivo no encontrado: ${ejemplo.archivo}`);
      }
      
      const csvText = await response.text();
      
      // Parsear CSV
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
      
      // Actualizar estado
      setSeismicData(data);
      setFileName(ejemplo.nombre);
      setDuration(data[data.length - 1].time);
      setCurrentTime(0);
      
      // Sugerir posición de biela
      setCrankPosition(ejemplo.posicionRecomendada);
      
      addLog(`✅ ${ejemplo.nombre} cargado (${data.length} puntos)`, 'success');
      addLog(`💡 Sugerencia: Usar posición ${ejemplo.posicionRecomendada}`, 'info');
      addLog(`🌍 Magnitud: ${ejemplo.magnitud} - ${ejemplo.descripcion}`, 'info');
      
    } catch (error) {
      console.error('Error cargando ejemplo:', error);
      addLog(`❌ Error: ${error.message}`, 'error');
      alert(`No se pudo cargar el ejemplo:\n${error.message}\n\nAsegúrate de tener los archivos CSV en la carpeta public/ejemplos/`);
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

  // Generar onda
  const generateManualWave = async () => {
    addLog(`⚙️ ${manualParams.waveform}`, 'info');
    setLoading(true);
    
    const points = [];
    const samples = manualParams.duration * 100;
    
    for (let i = 0; i < samples; i++) {
      const t = i / 100;
      let amplitude = 0;
      
      switch (manualParams.waveform) {
        case 'sine':
          amplitude = manualParams.amplitude * Math.sin(2 * Math.PI * manualParams.frequency * t);
          break;
          
        case 'square':
          amplitude = manualParams.amplitude * Math.sign(Math.sin(2 * Math.PI * manualParams.frequency * t));
          break;
          
        case 'sawtooth':
          amplitude = manualParams.amplitude * (2 * (t * manualParams.frequency - Math.floor(t * manualParams.frequency + 0.5)));
          break;
          
        case 'random':
          amplitude = manualParams.amplitude * (Math.random() * 2 - 1);
          break;
          
        case 'chirp':
          const freq = manualParams.frequency * (1 + t / manualParams.duration);
          amplitude = manualParams.amplitude * Math.sin(2 * Math.PI * freq * t);
          break;
          
        // SISMOS SINTÉTICOS
        case 'pwave': // Onda P (Primaria)
          {
            const freq = 8.0;
            const decay = Math.exp(-t * 2.0);
            amplitude = manualParams.amplitude * Math.sin(2 * Math.PI * freq * t) * decay;
          }
          break;
          
        case 'swave': // Onda S (Secundaria)
          {
            const freq = 4.0;
            const decay = Math.exp(-t * 1.0);
            amplitude = manualParams.amplitude * Math.sin(2 * Math.PI * freq * t) * decay;
          }
          break;
          
        case 'complete': // Sismo Completo (P+S+Surface)
          {
            if (t < 2.0) {
              // P-Wave
              const freq = 8.0;
              const decay = Math.exp(-t * 2.0);
              amplitude = manualParams.amplitude * 0.3 * Math.sin(2 * Math.PI * freq * t) * decay;
            } else if (t < 6.0) {
              // S-Wave
              const t2 = t - 2.0;
              const freq = 4.0;
              const decay = Math.exp(-t2 * 1.0);
              amplitude = manualParams.amplitude * 0.6 * Math.sin(2 * Math.PI * freq * t2) * decay;
            } else if (t < 15.0) {
              // Surface Wave
              const t2 = t - 6.0;
              const freq = 2.0;
              const decay = Math.exp(-t2 * 0.5);
              amplitude = manualParams.amplitude * Math.sin(2 * Math.PI * freq * t2) * decay;
            }
          }
          break;
          
        case 'aftershocks': // Con Réplicas
          {
            if (t < 15.0) {
              // Sismo principal
              if (t < 2.0) {
                const freq = 8.0;
                const decay = Math.exp(-t * 2.0);
                amplitude = manualParams.amplitude * 0.3 * Math.sin(2 * Math.PI * freq * t) * decay;
              } else if (t < 6.0) {
                const t2 = t - 2.0;
                const freq = 4.0;
                const decay = Math.exp(-t2 * 1.0);
                amplitude = manualParams.amplitude * 0.6 * Math.sin(2 * Math.PI * freq * t2) * decay;
              } else {
                const t2 = t - 6.0;
                const freq = 2.0;
                const decay = Math.exp(-t2 * 0.5);
                amplitude = manualParams.amplitude * Math.sin(2 * Math.PI * freq * t2) * decay;
              }
            } else if (t >= 20.0 && t < 30.0) {
              // Réplica 1
              const t2 = t - 20.0;
              const freq = 5.0;
              const decay = Math.exp(-t2 * 1.5);
              amplitude = manualParams.amplitude * 0.4 * Math.sin(2 * Math.PI * freq * t2) * decay;
            } else if (t >= 35.0 && t < 42.0) {
              // Réplica 2
              const t2 = t - 35.0;
              const freq = 4.0;
              const decay = Math.exp(-t2 * 2.0);
              amplitude = manualParams.amplitude * 0.25 * Math.sin(2 * Math.PI * freq * t2) * decay;
            }
          }
          break;
          
        case 'near': // Sismo Cercano (alta frecuencia)
          {
            const freq = 10.0;
            const attack = Math.min(t * 5.0, 1.0);
            const decay = Math.exp(-t * 1.5);
            amplitude = manualParams.amplitude * Math.sin(2 * Math.PI * freq * t) * attack * decay;
          }
          break;
          
        case 'far': // Sismo Lejano (baja frecuencia)
          {
            const freq = 1.5;
            const attack = Math.min(t * 0.5, 1.0);
            const decay = Math.exp(-t * 0.3);
            amplitude = manualParams.amplitude * Math.sin(2 * Math.PI * freq * t) * attack * decay;
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
    
    setLoading(false);
    addLog(`✅ ${points.length} puntos`, 'success');
  };

  // NUEVO: Reproducir CSV en tiempo real
  const playCSVRealtime = async () => {
    if (seismicData.length === 0) {
      alert('Primero carga un CSV');
      return;
    }

    addLog('🎬 Reproducción CSV en tiempo real', 'info');
    setIsPlaying(true);
    cancelPlayback.current = false; // Reset bandera

    // Enviar comando inicial
    await set(ref(database, `devices/${deviceId}/commands`), {
      action: 'START',
      frequency: 0,
      amplitude: 0,
      waveformType: 99, // Código especial para "modo remoto"
      timestamp: Date.now()
    });

    // Enviar cada punto en tiempo real
    let lastTime = 0;
    for (let i = 0; i < seismicData.length; i++) {
      // Verificar si se canceló
      if (cancelPlayback.current) {
        addLog('⏹️ Reproducción cancelada', 'info');
        break;
      }

      const point = seismicData[i];
      const delayMs = (point.time - lastTime) * 1000;

      // Esperar el tiempo correcto
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // Verificar nuevamente después del delay
      if (cancelPlayback.current) {
        addLog('⏹️ Reproducción cancelada', 'info');
        break;
      }

      // Enviar amplitud actual a Firebase
      await set(ref(database, `devices/${deviceId}/realtime`), {
        amplitude: point.amplitude,
        time: point.time,
        index: i,
        total: seismicData.length
      });

      setCurrentTime(point.time);
      lastTime = point.time;

      // Log cada 100 puntos
      if (i % 100 === 0) {
        addLog(`📍 ${i}/${seismicData.length}`, 'info');
      }
    }

    // Detener al finalizar (solo si no se canceló antes)
    if (!cancelPlayback.current) {
      await set(ref(database, `devices/${deviceId}/commands`), {
        action: 'STOP',
        timestamp: Date.now()
      });
      addLog('✅ Reproducción completada', 'success');
    }

    setIsPlaying(false);
  };

  // Controles
  const handlePlay = async () => {
    if (seismicData.length === 0) {
      alert('Primero genera una onda o carga un CSV');
      return;
    }

    addLog('▶️ START', 'command');
    
    // Si es un CSV cargado, usar modo realtime
    if (fileName.includes('.csv') || fileName.includes('.txt')) {
      addLog('📊 Modo: Reproducción CSV', 'info');
      playCSVRealtime();
    } else {
      // Si es generado, usar parámetros
      addLog('⚙️ Modo: Generación local', 'info');
      try {
        await set(ref(database, `devices/${deviceId}/commands`), {
          action: 'START',
          frequency: manualParams.frequency,
          amplitude: manualParams.amplitude,
          duration: manualParams.duration,
          waveformType: manualParams.waveformType,
          crankPosition: crankPosition, // Enviar posición de biela
          timestamp: Date.now()
        });
        addLog(`✅ ${manualParams.frequency}Hz, ${manualParams.amplitude}mm, ${manualParams.duration}s, Pos:${crankPosition}, Type:${manualParams.waveformType}`, 'success');
      } catch (error) {
        addLog(`❌ ${error.message}`, 'error');
      }
    }
  };

  const handlePause = async () => {
    addLog('⏸️ PAUSE', 'command');
    
    // Cancelar reproducción CSV
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
    
    // Cancelar reproducción CSV si está activa
    cancelPlayback.current = true;
    
    setCurrentTime(0);
    setIsPlaying(false);
    
    try {
      // Enviar STOP
      await set(ref(database, `devices/${deviceId}/commands`), {
        action: 'STOP',
        timestamp: Date.now()
      });
      
      // LIMPIAR ESTADO EN FIREBASE
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-800/50 backdrop-blur rounded-lg p-6">
            <div className="flex items-center gap-4">
              {/* Logo UTN */}
              <img 
                src="/utn-logo.png" 
                alt="UTN Logo" 
                className="h-16 w-auto hidden md:block"
                onError={(e) => {
                  // Fallback si no encuentra la imagen
                  e.target.style.display = 'none';
                }}
              />
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
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel Izquierdo */}
          <div className="lg:col-span-1 space-y-6">
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


            {/* Botón para abrir modal de ejemplos */}
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

            {/* Generador */}
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
                      
                      // Mapear tipo de onda a código numérico y duración recomendada
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
                
                <div>
                  <label className="block text-sm mb-2">Amplitud (mm): {manualParams.amplitude}</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={manualParams.amplitude}
                    onChange={(e) => setManualParams({...manualParams, amplitude: parseInt(e.target.value)})}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm mb-2">Frecuencia (Hz): {manualParams.frequency}</label>
                  <input
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.1"
                    value={manualParams.frequency}
                    onChange={(e) => setManualParams({...manualParams, frequency: parseFloat(e.target.value)})}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm mb-2">Duración (s): {manualParams.duration}</label>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    value={manualParams.duration}
                    onChange={(e) => setManualParams({...manualParams, duration: parseInt(e.target.value)})}
                    className="w-full"
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
                {/* Selector de posición */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Posición de la Biela: {crankPosition}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={crankPosition}
                    onChange={(e) => setCrankPosition(parseInt(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                  <div className="flex justify-between text-xs text-purple-300 mt-1">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                    <span>5</span>
                  </div>
                </div>

                {/* Información de la configuración actual */}
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

                {/* Advertencia si frecuencia es muy alta */}
                {manualParams.frequency > 3 && crankPosition >= 4 && (
                  <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-3 flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-200">
                      <p className="font-semibold">⚠️ Advertencia</p>
                      <p>Frecuencia alta para posición {crankPosition}. Reduce a {currentConfig.maxFreq} para mejor rendimiento.</p>
                    </div>
                  </div>
                )}

                {/* Info del mecanismo */}
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
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={visibleData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="time" 
                        stroke="#9CA3AF"
                        domain={[Math.max(0, currentTime - 5), Math.min(duration, currentTime + 5)]}
                        type="number"
                        label={{ value: 'Tiempo (s)', position: 'insideBottom', offset: -5 }}
                        tickFormatter={(value) => value.toFixed(1)}
                      />
                      <YAxis 
                        stroke="#9CA3AF"
                        domain={['auto', 'auto']}
                        label={{ value: 'Amplitud (mm)', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                        labelStyle={{ color: '#e5e7eb' }}
                        formatter={(value) => [value.toFixed(2) + 'mm', 'Amplitud']}
                        labelFormatter={(value) => 'Tiempo: ' + value.toFixed(2) + 's'}
                      />
                      {/* LÍNEA ROJA DE PROGRESO */}
                      <ReferenceLine 
                        x={currentTime} 
                        stroke="#ef4444" 
                        strokeWidth={2} 
                        label={{ value: 'Actual', position: 'top', fill: '#ef4444' }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="amplitude" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={false}
                        animationDuration={0}
                        isAnimationActive={false}
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

            {/* NUEVO: Monitor ESP32 */}
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
              
              {/* Estadísticas rápidas */}
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

      {/* Modal de Sismos */}
      {mostrarModalSismos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl border-2 border-blue-500/50 max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
            {/* Header del modal */}
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

            {/* Contenido scrolleable */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {EJEMPLOS_SISMOS.map((ejemplo, index) => (
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
                    {/* Icono */}
                    <div className="text-4xl mt-1 group-hover:scale-110 transition-transform">
                      {ejemplo.icon}
                    </div>
                    
                    {/* Info */}
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
                          Pos. {ejemplo.posicionRecomendada}
                        </span>
                      </div>
                    </div>
                    
                    {/* Flecha */}
                    <div className="text-blue-400 group-hover:translate-x-1 transition-transform">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>

              {/* Info adicional */}
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

            {/* Footer */}
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
    </div>
  );
}
