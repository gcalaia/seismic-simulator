export async function POST(request) {
  try {
    const { ipAddress, port, seismicData, startTime } = await request.json();

    // Enviar datos sísmicos al ESP32
    const response = await fetch(`http://${ipAddress}:${port}/api/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: seismicData,
        startTime: startTime,
        timestamp: Date.now()
      })
    });

    const result = await response.json();

    return Response.json({
      success: true,
      message: 'Simulación iniciada',
      data: result
    });

  } catch (error) {
    return Response.json({
      success: false,
      message: 'Error al iniciar simulación: ' + error.message
    }, { status: 500 });
  }
}
