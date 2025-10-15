'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Upload, Play, Pause, Square, Settings, TrendingUp, 
  Download, AlertCircle, Wifi, WifiOff, FileText,
  Zap, Activity
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

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

  const [espConfig, setEspConfig] = useState({
    ipAddress: '192.168.1.100',
    port: '80',
  });

  const fileInputRef = useRef(null);

  // Cargar archivo CSV
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/seismic/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.success) {
        setSeismicData(result.data);
        setFileName(result.fileName);
        setDuration(result.data[result.data.length - 1]?.time || 0);
        setCurrentTime(0);
      } else {
        alert('Error al cargar archivo: ' + result.message);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Generar onda manual
  const generateManualWave = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/seismic/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualParams)
      });

      const result = await response.json();
      
      if (result.success) {
        setSeismicData(result.data);
        setDuration(result.metadata.duration);
        setCurrentTime(0);
        setFileName(`${manualParams.waveform}_${Date.now()}.csv`);
      }
    } catch (error) {
      alert('Error al generar onda: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Conectar con ESP32
  const connectESP32 = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/esp32/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(espConfig)
      });

      const result = await response.json();
      
      if (result.success) {
        setConnectionStatus('connected');
        alert('Conectado correctamente al ESP32');
      } else {
        setConnectionStatus('error');
        alert('Error de conexión: ' + result.message);
      }
    } catch (error) {
      setConnectionStatus('error');
      alert('Error: ' + error.message);
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
          return duration;
        }
        return next;
      });
    }, 10);

    return () => clearInterval(interval);
  }, [isPlaying, duration, seismicData.length]);

  const handlePlay = async () => {
    if (seismicData.length === 0) return;
    setIsPlaying(true);
    
    try {
      await fetch('/api/esp32/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...espConfig,
          seismicData,
          startTime: currentTime
        })
      });
    } catch (error) {
      console.error('Error al enviar comando:', error);
    }
  };

  const handlePause = async () => {
    setIsPlaying(false);
    try {
      await fetch('/api/esp32/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(espConfig)
      });
    } catch (error) {
      console.error('Error al pausar:', error);
    }
  };

  const handleStop = async () => {
    setIsPlaying(false);
    setCurrentTime(0);
    try {
      await fetch('/api/esp32/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(espConfig)
      });
    } catch (error) {
      console.error('Error al detener:', error);
    }
  };

  const handleDownload = () => {
    if (seismicData.length === 0) return;
    
    const csv = ['time,amplitude', ...seismicData.map(d => `${d.time},${d.amplitude}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'seismic_data.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

 const visibleData = seismicData.filter(d => 
  d.time >= Math.max(0, currentTime - 5) && d.time <= Math.min(duration, currentTime + 5)
);

  const getCurrentAmplitude = () => {
    const point = seismicData.find(d => Math.abs(d.time - currentTime) < 0.01);
    return point ? point.amplitude.toFixed(2) : '0.00';
  };

  return (
    <div className="min-h-screen text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
            <Activity className="w-8 h-8 md:w-10 md:h-10 text-blue-400" />
            Simulador Sísmico
          </h1>
          <p className="text-gray-300 text-sm md:text-base">
            Control profesional de mesa vibratoria con ESP32
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

            {/* Configuración ESP32 */}
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Configuración ESP32</h2>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-300 mb-1 block">Dirección IP</label>
                  <input
                    type="text"
                    value={espConfig.ipAddress}
                    onChange={(e) => setEspConfig({...espConfig, ipAddress: e.target.value})}
                    className="w-full bg-slate-700 px-3 py-2 rounded border border-slate-600 text-white"
                    placeholder="192.168.1.100"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-1 block">Puerto</label>
                  <input
                    type="text"
                    value={espConfig.port}
                    onChange={(e) => setEspConfig({...espConfig, port: e.target.value})}
                    className="w-full bg-slate-700 px-3 py-2 rounded border border-slate-600 text-white"
                    placeholder="80"
                  />
                </div>
                <button
                  onClick={connectESP32}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Wifi className="w-4 h-4" />
                  {loading ? 'Conectando...' : 'Conectar'}
                </button>
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
                  disabled={seismicData.length === 0 || isPlaying || loading}
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
                <TrendingUp className="w-5 h-5" />
                Proyecto Académico
              </h3>
              <p className="text-sm text-gray-300 mb-3">
                Sistema de simulación sísmica para mesa vibratoria controlada por ESP32.
                Desarrollado para pruebas de estructuras y modelos a escala en laboratorio.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-blue-500/20 px-3 py-1 rounded-full">Next.js 14</span>
                <span className="bg-green-500/20 px-3 py-1 rounded-full">ESP32</span>
                <span className="bg-purple-500/20 px-3 py-1 rounded-full">Vercel</span>
                <span className="bg-orange-500/20 px-3 py-1 rounded-full">Arduino</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-gray-400">
          <p>Desarrollado para fines educativos • {new Date().getFullYear()}</p>
        </footer>
      </div>
    </div>
  );
}
