export async function POST(request) {
  try {
    const { ipAddress, port } = await request.json();
    
    // Intentar conectar con el ESP32
    const response = await fetch(`http://${ipAddress}:${port}/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const data = await response.json();
      return Response.json({
        success: true,
        message: 'Conectado correctamente',
        deviceInfo: data
      });
    }

    return Response.json({
      success: false,
      message: 'No se pudo conectar con el ESP32'
    }, { status: 400 });

  } catch (error) {
    return Response.json({
      success: false,
      message: 'Error de conexión: ' + error.message
    }, { status: 500 });
  }
}
