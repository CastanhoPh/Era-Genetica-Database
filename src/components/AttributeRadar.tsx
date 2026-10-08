import React from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

// Isolado num chunk próprio (carregado via lazy()) pra não engordar o bundle de toda
// ficha só por causa do toggle opcional "Radar" — chart.js+react-chartjs-2 pesam ~200KB.
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface AttributeRadarProps {
  labels: string[];
  values: number[];
}

const AttributeRadar: React.FC<AttributeRadarProps> = ({ labels, values }) => {
  const radarData = {
    labels,
    datasets: [{
      label: 'Atributos',
      data: values,
      fill: true,
      backgroundColor: "rgba(0, 255, 65, 0.25)",
      borderColor: "#00ff41",
      pointBackgroundColor: "#00ff41",
      pointBorderColor: "#00ff41",
      pointHoverBackgroundColor: "#fff",
      pointHoverBorderColor: "#00ff41",
      borderWidth: 2
    }]
  };

  const radarOptions = {
    animation: {
      duration: 1500,
      easing: 'easeOutQuart' as const,
    },
    scales: {
      r: {
        min: 0,
        max: 30,
        ticks: {
          stepSize: 5,
          display: false,
        },
        grid: {
          color: "rgba(0, 255, 65, 0.1)"
        },
        angleLines: {
          color: "rgba(0, 255, 65, 0.15)"
        },
        pointLabels: {
          color: "#00ff41",
          padding: 5,
          font: {
            size: 9,
            family: 'monospace'
          }
        }
      }
    },
    plugins: {
      legend: {
        display: false
      }
    },
    elements: {
      line: {
        borderWidth: 2,
        tension: 0.1
      },
      point: {
        radius: 3,
        hoverRadius: 5
      }
    },
    layout: {
      padding: 10
    },
    maintainAspectRatio: false
  };

  return <Radar data={radarData} options={radarOptions} />;
};

export default AttributeRadar;
