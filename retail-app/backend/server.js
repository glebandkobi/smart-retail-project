const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

let pool;

async function initDatabase() {
  try {
    pool = mysql.createPool(dbConfig);
    console.log("Connecting to AWS RDS MySQL Database...");

    // 1. Create Raw Materials Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        component VARCHAR(50) PRIMARY KEY,
        in_stock INT NOT NULL
      )
    `);

    // 2. Create Finished Goods Warehouse Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warehouse (
        brand VARCHAR(50) PRIMARY KEY,
        units_manufactured INT NOT NULL
      )
    `);

    // 3. Create Secure Production Audit Log Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS production_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp VARCHAR(50),
        machine_id VARCHAR(50),
        brand VARCHAR(50)
      )
    `);

    // Seed Raw Materials if empty
    const [invRows] = await pool.query("SELECT COUNT(*) as count FROM inventory");
    if (invRows[0].count === 0) {
      await pool.query("INSERT INTO inventory (component, in_stock) VALUES ?, ?, ?", [
        [['microchips', 10]], [['fans', 10]], [['pcbs', 5]]
      ]);
    }

    // Seed Warehouse if empty
    const [whRows] = await pool.query("SELECT COUNT(*) as count FROM warehouse");
    if (whRows[0].count === 0) {
      await pool.query("INSERT INTO warehouse (brand, units_manufactured) VALUES ?, ?, ?, ?", [
        [['asus', 0]], [['msi', 0]], [['gigabyte', 0]], [['pny', 0]]
      ]);
    }

    console.log("Factory State Database Tables Verified & Ready!");
  } catch (err) {
    console.error("Database initialization failed:", err.message);
  }
}

// ENDPOINT 1: Get complete factory state for dashboard rendering
app.get('/api/factory-state', async (req, res) => {
  try {
    const [inv] = await pool.query("SELECT * FROM inventory");
    const [wh] = await pool.query("SELECT * FROM warehouse");
    const [logs] = await pool.query("SELECT * FROM production_log ORDER BY id DESC LIMIT 10");
    
    // Format database arrays back into easy-to-use JS objects for the frontend
    const inventoryObj = inv.reduce((acc, row) => ({ ...acc, [row.component]: row.in_stock }), {});
    const warehouseObj = wh.reduce((acc, row) => ({ ...acc, [row.brand]: row.units_manufactured }), {});
    const formattedLogs = logs.map(l => `[${l.timestamp}] Machine ${l.machine_id} successfully assembled ${l.brand.toUpperCase()}`);

    res.json({ inventory: inventoryObj, warehouse: warehouseObj, productionLog: formattedLogs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ENDPOINT 2: Securely execute assembly and modify SQL stock values
app.post('/api/assemble', async (req, res) => {
  const { brand, machineId, reqChips, reqFans, reqPcbs } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction(); // Protect transactions from data corruption

    // Double check active database inventory stocks
    const [inv] = await connection.query("SELECT * FROM inventory");
    const stock = inv.reduce((acc, row) => ({ ...acc, [row.component]: row.in_stock }), {});

    if (stock.microchips >= reqChips && stock.fans >= reqFans && stock.pcbs >= reqPcbs) {
      // Deduct from materials
      await connection.query("UPDATE inventory SET in_stock = in_stock - ? WHERE component = 'microchips'", [reqChips]);
      await connection.query("UPDATE inventory SET in_stock = in_stock - ? WHERE component = 'fans'", [reqFans]);
      await connection.query("UPDATE inventory SET in_stock = in_stock - ? WHERE component = 'pcbs'", [reqPcbs]);

      // Add to warehouse finished goods
      await connection.query("UPDATE warehouse SET units_manufactured = units_manufactured + 1 WHERE brand = ?", [brand]);

      // Write to audit log
      const timestamp = new Date().toLocaleTimeString();
      await connection.query("INSERT INTO production_log (timestamp, machine_id, brand) VALUES (?, ?, ?)", [timestamp, machineId, brand]);

      await connection.commit();
      res.json({ success: true, message: `Authorized: Machine ${machineId} assembled ${brand.toUpperCase()}!` });
    } else {
      res.status(400).json({ success: false, message: `Fault: Insufficient parts on assembly line!` });
    }
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: "Database transaction crash: " + err.message });
  } finally {
    connection.release();
  }
});

app.listen(PORT, async () => {
  console.log(`Backend running on port ${PORT}`);
  await initDatabase();
});
