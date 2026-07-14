import React, { memo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export const SpendingChart = memo(({ transactions }) => {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Sum expenses per month
  const monthlyExpenses = Array(12).fill(0);

  transactions.forEach(tx => {
    if (tx.type === 'Expense') {
      const dateObj = new Date(tx.date);  // safer parsing
      if (!isNaN(dateObj)) {
        const monthIndex = dateObj.getMonth();
        monthlyExpenses[monthIndex] += Math.abs(tx.amount);
      }
    }
  });

  const data = {
    labels: months,
    datasets: [
      {
        label: 'Total Expenses',
        data: monthlyExpenses,
        backgroundColor: 'rgba(63, 240, 231, 0.6)',
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: false }
    }
  };

  return <Bar data={data} options={options} />;
});
