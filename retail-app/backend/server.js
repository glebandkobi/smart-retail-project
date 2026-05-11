const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const products = [
  { id: 1, name: "DevOps Master Laptop", price: 1200, description: "Pre-installed with Docker.", image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=300" },
  { id: 2, name: "Mechanical Keyboard", price: 150, description: "Clicky and loud.", image: "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=300" },
  { id: 3, name: "The 'Gleb' Coffee Mug", price: 25, description: "Caffeine fuel.", image: "https://images.unsplash.com/photo-1517256673644-36ad11246d21?w=300" }
];

app.get('/api/products', (req, res) => res.json(products));
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
