'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function SeismicChartJS({ data, currentTime }) {
  if (!data || data.length === 0) return null;

  // Preparar datos para Chart.js
  const chartData = {
    labels: data.map(d => d.time.toFixed(2)),
    datasets: [
      {
        label: 'Amplitud (mm)',
        data: data.map(d => d.amplitude),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
        fill: false
      }
    ]
  };

  // Encontrar el índice del tiempo actual
  const currentIndex = data.findIndex(d => Math.abs(d.time - currentTime) < 0.05);

  // Opciones del gráfico
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        titleColor: 'rgb(226, 232, 240)',
        bodyColor: 'rgb(59, 130, 246)',
        borderColor: 'rgb(71, 85, 105)',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          title: function(context) {
            const time = parseFloat(context[0].label);
            return `Tiempo: ${time.toFixed(2)}s`;
          },
          label: function(context) {
            const value = context.parsed.y;
            return `Amplitud: ${value.toFixed(2)}mm`;
          }
        }
      },
      annotation: currentIndex >= 0 ? {
        annotations: {
          line1: {
            type: 'line',
            xMin: currentIndex,
            xMax: currentIndex,
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 2,
            label: {
              display: true,
              content: 'Actual',
              position: 'start',
              backgroundColor: 'rgb(239, 68, 68)',
              color: 'white'
            }
          }
        }
      } : {}
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Tiempo (s)',
          color: 'rgb(156, 163, 175)'
        },
        ticks: {
          color: 'rgb(156, 163, 175)',
          maxTicksLimit: 10,
          callback: function(value, index) {
            // Mostrar solo algunos labels
            if (index % Math.ceil(data.length / 10) === 0) {
              return parseFloat(this.getLabelForValue(value)).toFixed(1);
            }
            return '';
          }
        },
        grid: {
          color: 'rgba(55, 65, 81, 0.5)',
          drawBorder: false
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Amplitud (mm)',
          color: 'rgb(156, 163, 175)'
        },
        ticks: {
          color: 'rgb(156, 163, 175)'
        },
        grid: {
          color: 'rgba(55, 65, 81, 0.5)',
          drawBorder: false
        }
      }
    }
  };

  return (
    <div className="w-full h-[300px]">
      <Line data={chartData} options={options} />
    </div>
  );
}
