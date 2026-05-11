import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch data from the Flask Backend
  useEffect(() => {
    axios.get('http://localhost:5000/api/products')
      .then(res => {
        setProducts(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Backend not running yet?", err);
        setLoading(false);
      });
  }, []);

  // Data configuration for Chart.js
  const chartData = {
    labels: products.map(p => p.name),
    datasets: [{
      label: 'Current Stock Level',
      data: products.map(p => p.stock),
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1,
    }]
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'Arial' }}>
      <h1>📦 Smart Retail Inventory</h1>
      <hr />

      {loading ? (
        <p>Connecting to backend...</p>
      ) : (
        <div style={{ display: 'flex', gap: '50px', marginTop: '20px' }}>
          
          {/* List View */}
          <div style={{ flex: 1 }}>
            <h3>Product List</h3>
            <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.stock}</td>
                    <td style={{ color: p.stock < 10 ? 'red' : 'green' }}>
                      {p.stock < 10 ? 'LOW STOCK' : 'OK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Chart View */}
          <div style={{ flex: 1, maxWidth: '500px' }}>
            <h3>Stock Analytics</h3>
            <Bar data={chartData} />
          </div>

        </div>
      )}
    </div>
  );
}

export default App;
