export async function POST(request) {
  try {
    const { ipAddress, port } = await request.json();

    const response = await fetch(`http://${ipAddress}:${port}/api/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    return Response.json({
      success: true,
      message: 'Simulación pausada'
    });

  } catch (error) {
    return Response.json({
      success: false,
      message: 'Error al pausar: ' + error.message
    }, { status: 500 });
  }
}
