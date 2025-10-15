export async function POST(request) {
  try {
    const { data, operation } = await request.json();

    let processedData = [...data];

    switch (operation) {
      case 'normalize':
        // Normalizar amplitudes
        const maxAmp = Math.max(...data.map(d => Math.abs(d.amplitude)));
        processedData = data.map(d => ({
          ...d,
          amplitude: (d.amplitude / maxAmp) * 100
        }));
        break;

      case 'filter':
        // Filtro de media móvil simple
        const windowSize = 5;
        processedData = data.map((d, i) => {
          const start = Math.max(0, i - Math.floor(windowSize / 2));
          const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
          const window = data.slice(start, end);
          const avg = window.reduce((sum, p) => sum + p.amplitude, 0) / window.length;
          return { ...d, amplitude: avg };
        });
        break;

      case 'amplify':
        // Amplificar señal
        processedData = data.map(d => ({
          ...d,
          amplitude: d.amplitude * 1.5
        }));
        break;

      case 'reduce':
        // Reducir señal
        processedData = data.map(d => ({
          ...d,
          amplitude: d.amplitude * 0.5
        }));
        break;

      default:
        return Response.json({
          success: false,
          message: 'Operación no válida'
        }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: `Procesamiento '${operation}' aplicado`,
      data: processedData
    });

  } catch (error) {
    return Response.json({
      success: false,
      message: 'Error al procesar datos: ' + error.message
    }, { status: 500 });
  }
}
