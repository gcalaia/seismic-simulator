export async function POST(request) {
  try {
    const { ipAddress, port } = await request.json();

    const response = await fetch(`http://${ipAddress}:${port}/api/pause`, {
      method: 'POST',
    }).catch(() => null);

    return Response.json({
      success: true,
      message: 'Pausado'
    });

  } catch (error) {
    return Response.json({
      success: false,
      message: error.message
    }, { status: 500 });
  }
}
