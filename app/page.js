'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Upload, Play, Pause, Square, Settings, TrendingUp, 
  Download, AlertCircle, Wifi, WifiOff, FileText,
  Zap, Activity, Cloud, CloudOff
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { database } from '../lib/firebase';
import { ref, set, onValue, get } from 'firebase/database';

export default function Home() {
  const [seismicData, setSeismicData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [loading, setLoading] = useState(false);
  
  const [manualParams, setManualParams] = useState({
    amplitude: 50,
    frequency: 2.0,
    duration: 10,
    waveform: 'sine'
  });

  const [deviceId, setDeviceId] = useState('LAB_01');
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  
  // Log de actividad
  const [activityLog, setActivityLog] = useState([]);
  const [showLog, setShowLog] = useState(true);
  const logRef = useRef(null);

  const fileInputRef = useRef(null);

  // Función para agregar al log
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('es-AR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    
    // Generar ID único combinando timestamp y random
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    setActivityLog(prev => [{
      id: uniqueId, // ID único garantizado
      timestamp,
      message,
      type // 'info', 'success', 'error', 'command', 'response'
    }, ...prev].slice(0, 100)); // Mantener últimos 100 mensajes
  };

  // Escuchar cambios en Firebase
  useEffect(() => {
    const deviceStatusRef = ref(database, `devices/${deviceId}/status`);
    
    addLog(`Escuchando dispositivo: ${deviceId}`, 'info');
    
    const unsubscribe = onValue(deviceStatusRef, (snapshot) => {
      if (snapshot.exists()) {
        const status = snapshot.val();
        setDeviceStatus(status);
        setFirebaseConnected(true);
        
        addLog(`✅ Respuesta ESP32: ${JSON.stringify({
          isRunning: status.isRunning,
          freq: status.currentFrequency,
          amp: status.currentAmplitude
        })}`, 'response');
        
        // Actualizar estado del motor
        if (status.isRunning !== isPlaying) {
          setIsPlaying(status.isRunning);
          addLog(`Motor: ${status.isRunning ? 'INICIADO' : 'DETENIDO'}`, status.isRunning ? 'success' : 'info');
        }
        
        // Verificar si está online
        const now = Math.floor(Date.now() / 1000);
        const isOnline = status.lastSeen && (now - status.lastSeen) < 10;
        const newStatus = isOnline ? 'connected' : 'disconnected';
        
        if (connectionStatus !== newStatus) {
          setConnectionStatus(newStatus);
          addLog(`ESP32: ${isOnline ? 'Conectado' : 'Desconectado'}`, isOnline ? 'success' : 'error');
        }
      } else {
        setFirebaseConnected(false);
        setConnectionStatus('disconnected');
        addLog('❌ Dispositivo no encontrado en Firebase', 'error');
      }
    }, (error) => {
      console.error('Error Firebase:', error);
      setFirebaseConnected(false);
      addLog(`❌ Error Firebase: ${error.message}`, 'error');
    });

    return () => unsubscribe();
  }, [deviceId]);

  // Cargar archivo CSV
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    addLog(`📂 Cargando archivo: ${file.name}`, 'info');
    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      
      const data = lines.slice(1).map((line, index) => {
        const [time, amplitude] = line.split(',').map(val => parseFloat(val.trim()));
        return {
          time: time || index * 0.01,
          amplitude: amplitude || 0
        };
      }).filter(point => !isNaN(point.amplitude));

      setSeismicData(data);
      setFileName(file.name);
      setDuration(data.length > 0 ? data[data.length - 1].time : 0);
      setCurrentTime(0);
      setLoading(false);
      
      addLog(`✅ Archivo cargado: ${data.length} muestras, ${(data[data.length - 1].time).toFixed(1)}s`, 'success');
    };

    reader.readAsText(file);
  };

  // Generar onda manual
  const generateManualWave = async () => {
    addLog(`⚙️ Generando onda ${manualParams.waveform}: ${manualParams.amplitude}mm, ${manualParams.frequency}Hz, ${manualParams.duration}s`, 'info');
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
          const instantFreq = manualParams.frequency * (1 + t / manualParams.duration);
          amplitude = manualParams.amplitude * Math.sin(2 * Math.PI * instantFreq * t);
          break;
        default:
          amplitude = 0;
      }
      
      points.push({
        time: parseFloat(t.toFixed(3)),
        amplitude: parseFloat(amplitude.toFixed(3))
      });
    }
    
    setSeismicData(points);
    setDuration(manualParams.duration);
    setCurrentTime(0);
    setFileName(`${manualParams.waveform}_${Date.now()}.csv`);
    setLoading(false);
    
    addLog(`✅ Onda generada: ${points.length} puntos`, 'success');
  };

  // Buscar dispositivo
  const searchDevice = async () => {
    addLog(`🔍 Buscando dispositivo: ${deviceId}`, 'info');
    setLoading(true);
    try {
      const deviceRef = ref(database, `devices/${deviceId}`);
      const snapshot = await get(deviceRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        addLog(`✅ Dispositivo encontrado: ${data.name}`, 'success');
        addLog(`📊 Info: IP=${data.ip}, Micropasos=${data.microsteps || 'N/A'}`, 'info');
        alert(`✅ Dispositivo encontrado: ${data.name}`);
        setConnectionStatus('connected');
      } else {
        addLog('❌ Dispositivo no encontrado', 'error');
        alert('❌ Dispositivo no encontrado.\nAsegúrate de que el ESP32 esté encendido y conectado a WiFi.');
        setConnectionStatus('disconnected');
      }
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      alert('Error al buscar dispositivo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Control de reproducción
  useEffect(() => {
    if (!isPlaying || seismicData.length === 0) return;

    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const next = prev + 0.01;
        if (next >= duration) {
          setIsPlaying(false);
          handleStop();
          return duration;
        }
        return next;
      });
    }, 10);

    return () => clearInterval(interval);
  }, [isPlaying, duration, seismicData.length]);

  const handlePlay = async () => {
    if (seismicData.length === 0) return;
    
    const commandData = {
      motorEnabled: true,
      frequency: manualParams.frequency,
      amplitude: manualParams.amplitude
    };
    
    addLog(`🚀 Enviando comando START`, 'command');
    addLog(`📤 Parámetros: freq=${commandData.frequency}Hz, amp=${commandData.amplitude}mm`, 'command');
    
    try {
      await set(ref(database, `devices/${deviceId}/commands`), commandData);
      
      setIsPlaying(true);
      addLog('✅ Comando enviado exitosamente', 'success');
      console.log('✅ Comando enviado a Firebase');
    } catch (error) {
      console.error('Error:', error);
      addLog(`❌ Error al enviar: ${error.message}`, 'error');
      alert('Error al enviar comando: ' + error.message);
    }
  };

  const handlePause = async () => {
    addLog('⏸️ Pausando motor...', 'command');
    setIsPlaying(false);
    try {
      await set(ref(database, `devices/${deviceId}/commands/motorEnabled`), false);
      addLog('✅ Motor pausado', 'success');
    } catch (error) {
      addLog(`❌ Error al pausar: ${error.message}`, 'error');
      console.error('Error al pausar:', error);
    }
  };

  const handleStop = async () => {
    addLog('🛑 Deteniendo motor...', 'command');
    setIsPlaying(false);
    setCurrentTime(0);
    try {
      await set(ref(database, `devices/${deviceId}/commands/motorEnabled`), false);
      addLog('✅ Motor detenido', 'success');
    } catch (error) {
      addLog(`❌ Error al detener: ${error.message}`, 'error');
      console.error('Error al detener:', error);
    }
  };

  const handleDownload = () => {
    if (seismicData.length === 0) return;
    
    addLog(`💾 Exportando ${fileName}`, 'info');
    const csv = ['time,amplitude', ...seismicData.map(d => `${d.time},${d.amplitude}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'seismic_data.csv';
    a.click();
    URL.revokeObjectURL(url);
    addLog('✅ Archivo exportado', 'success');
  };

  const visibleData = seismicData.filter(d => 
    d.time >= Math.max(0, currentTime - 5) && d.time <= Math.min(duration, currentTime + 5)
  );

  const getCurrentAmplitude = () => {
    const point = seismicData.find(d => Math.abs(d.time - currentTime) < 0.01);
    return point ? point.amplitude.toFixed(2) : '0.00';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
            <Activity className="w-8 h-8 md:w-10 md:h-10 text-blue-400" />
            Simulador Sísmico
          </h1>
          <p className="text-gray-300 text-sm md:text-base">
            Control remoto vía Firebase Cloud
          </p>
        </header>

        {/* Status Bar */}
        <div className="bg-slate-800/50 backdrop-blur rounded-lg p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' ? (
                <Wifi className="w-5 h-5 text-green-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-500" />
              )}
              <span className="text-sm">
                ESP32: {connectionStatus === 'connected' ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {firebaseConnected ? (
                <Cloud className="w-5 h-5 text-green-500" />
              ) : (
                <CloudOff className="w-5 h-5 text-red-500" />
              )}
              <span className="text-sm">
                Firebase: {firebaseConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
            {fileName && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <FileText className="w-4 h-4" />
                {fileName}
              </div>
            )}
          </div>
          <div className="text-sm text-gray-300">
            {seismicData.length} muestras
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel de Control */}
          <div className="lg:col-span-1 space-y-6">
            {/* Carga de archivo */}
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Cargar Sismo
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
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {loading ? 'Cargando...' : 'Seleccionar CSV'}
              </button>
              <p className="text-xs text-gray-400 mt-2">
                Formato: tiempo,amplitud
              </p>
            </div>

            {/* Parámetros Manuales */}
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Parámetros Manuales
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-300 mb-1 block">
                    Amplitud: {manualParams.amplitude}mm
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={manualParams.amplitude}
                    onChange={(e) => setManualParams({...manualParams, amplitude: parseInt(e.target.value)})}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-300 mb-1 block">
                    Frecuencia: {manualParams.frequency}Hz
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={manualParams.frequency}
                    onChange={(e) => setManualParams({...manualParams, frequency: parseFloat(e.target.value)})}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-300 mb-1 block">
                    Duración: {manualParams.duration}s
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={manualParams.duration}
                    onChange={(e) => setManualParams({...manualParams, duration: parseInt(e.target.value)})}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-300 mb-1 block">Forma de onda</label>
                  <select
                    value={manualParams.waveform}
                    onChange={(e) => setManualParams({...manualParams, waveform: e.target.value})}
                    className="w-full bg-slate-700 px-3 py-2 rounded border border-slate-600"
                  >
                    <option value="sine">Senoidal</option>
                    <option value="square">Cuadrada</option>
                    <option value="sawtooth">Diente de sierra</option>
                    <option value="random">Aleatoria</option>
                    <option value="chirp">Barrido (Chirp)</option>
                  </select>
                </div>

                <button
                  onClick={generateManualWave}
                  disabled={loading}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-4 py-2 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  {loading ? 'Generando...' : 'Generar Onda'}
                </button>
              </div>
            </div>

            {/* Configuración Dispositivo */}
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">🔥 Dispositivo</h2>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-300 mb-1 block">ID del Dispositivo</label>
                  <input
                    type="text"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    className="w-full bg-slate-700 px-3 py-2 rounded border border-slate-600 text-white"
                    placeholder="LAB_01"
                  />
                </div>
                <button
                  onClick={searchDevice}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  {loading ? 'Buscando...' : 'Buscar Dispositivo'}
                </button>
                
                {deviceStatus && (
                  <div className="mt-4 p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg text-xs">
                    <p><strong>Frecuencia:</strong> {deviceStatus.currentFrequency || 0}Hz</p>
                    <p><strong>Amplitud:</strong> {deviceStatus.currentAmplitude || 0}mm</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Panel de Visualización */}
          <div className="lg:col-span-2 space-y-6">
            {/* Gráfico */}
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Visualización en Tiempo Real</h2>
              
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

                  {/* Información actual */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                      <div className="text-sm text-gray-400">Tiempo</div>
                      <div className="text-2xl font-bold">{currentTime.toFixed(2)}s</div>
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

                  {/* Barra de progreso */}
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
                      <span>{(currentTime / duration * 100).toFixed(1)}%</span>
                      <span>{duration.toFixed(1)}s</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Carga un archivo CSV o genera una onda manual</p>
                    <p className="text-sm mt-2">para comenzar la simulación</p>
                  </div>
                </div>
              )}
            </div>

            {/* Controles de Reproducción */}
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Controles de Simulación</h2>
              
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

            {/* Información */}
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 backdrop-blur rounded-lg p-6 border border-blue-500/20">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                Sistema Cloud
              </h3>
              <p className="text-sm text-gray-300 mb-3">
                Control remoto desde cualquier lugar del mundo vía Firebase. 
                El ESP32 y la app se sincronizan en tiempo real a través de la nube.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-blue-500/20 px-3 py-1 rounded-full">Next.js 14</span>
                <span className="bg-green-500/20 px-3 py-1 rounded-full">ESP32</span>
                <span className="bg-orange-500/20 px-3 py-1 rounded-full">Firebase</span>
                <span className="bg-purple-500/20 px-3 py-1 rounded-full">Vercel</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-gray-400">
          <p>Control remoto vía Firebase Cloud • {new Date().getFullYear()}</p>
        </footer>
        
        {/* Panel de Log flotante */}
        <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
          <div className="bg-slate-900/95 backdrop-blur-lg rounded-lg shadow-2xl border border-slate-700">
            {/* Header del log */}
            <div 
              className="flex items-center justify-between p-3 border-b border-slate-700 cursor-pointer hover:bg-slate-800/50 transition"
              onClick={() => setShowLog(!showLog)}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-400" />
                <span className="font-semibold text-sm">Log de Actividad</span>
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                  {activityLog.length}
                </span>
              </div>
              <button className="text-gray-400 hover:text-white transition">
                {showLog ? '▼' : '▲'}
              </button>
            </div>
            
            {/* Contenido del log */}
            {showLog && (
              <>
                <div 
                  ref={logRef}
                  className="max-h-96 overflow-y-auto p-3 space-y-2 text-xs font-mono"
                >
                  {activityLog.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>Sin actividad aún</p>
                    </div>
                  ) : (
                    activityLog.map((log) => (
                      <div 
                        key={log.id}
                        className={`p-2 rounded border-l-2 ${
                          log.type === 'error' ? 'bg-red-900/20 border-red-500 text-red-200' :
                          log.type === 'success' ? 'bg-green-900/20 border-green-500 text-green-200' :
                          log.type === 'command' ? 'bg-blue-900/20 border-blue-500 text-blue-200' :
                          log.type === 'response' ? 'bg-purple-900/20 border-purple-500 text-purple-200' :
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
                
                {/* Controles del log */}
                <div className="p-2 border-t border-slate-700 flex items-center justify-between">
                  <button
                    onClick={() => setActivityLog([])}
                    className="text-xs text-gray-400 hover:text-white transition px-2 py-1 rounded hover:bg-slate-800"
                  >
                    🗑️ Limpiar
                  </button>
                  <div className="text-xs text-gray-500">
                    Últimos 100 eventos
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
