from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

# 1. Define the missing database connection
def get_db_connection():
    conn = sqlite3.connect('factory.db')
    conn.row_factory = sqlite3.Row # Allows accessing columns by name
    return conn

# 2. Get current inventory (Fixed to show GPUs, not laptops)
@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    conn = get_db_connection()
    
    components = conn.execute('SELECT * FROM components').fetchall()
    gpus = conn.execute('SELECT * FROM finished_goods').fetchall()
    conn.close()

    return jsonify({
        "components": {row['id']: row['quantity'] for row in components},
        "warehouse": {row['id']: row['quantity'] for row in gpus}
    })

# 3. Process a manufacturing request
@app.route('/api/produce', methods=['POST'])
def produce_item():
    data = request.json
    gpu_id = data.get('gpu_id')
    machine_id = data.get('machine_id')
    password = data.get('password')
    
    # HARDCODED MACHINE AUTHENTICATION
    valid_machines = {"1": "1", "2": "2", "3": "3"}
    
    if str(machine_id) not in valid_machines or valid_machines[str(machine_id)] != str(password):
        return jsonify({"error": "SECURITY FAULT: Invalid Machine ID or Password."}), 403

    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Look up the recipe
        cursor.execute("SELECT component_id, required_quantity FROM recipes WHERE gpu_id = ?", (gpu_id,))
        recipe = cursor.fetchall()
        
        # Safety Check: Do we have enough parts?
        for row in recipe:
            comp_id = row['component_id']
            req_qty = row['required_quantity']
            
            cursor.execute("SELECT quantity FROM components WHERE id = ?", (comp_id,))
            current_qty = cursor.fetchone()['quantity']
            
            if current_qty < req_qty:
                return jsonify({"error": f"Insufficient {comp_id} for Machine {machine_id}!"}), 400
                
        # Execute Manufacturing (Deduct parts)
        for row in recipe:
            comp_id = row['component_id']
            req_qty = row['required_quantity']
            cursor.execute("UPDATE components SET quantity = quantity - ? WHERE id = ?", (req_qty, comp_id))
            
        # Add the finished GPU to the warehouse
        cursor.execute("UPDATE finished_goods SET quantity = quantity + 1 WHERE id = ?", (gpu_id,))
        
        # Save all changes 
        conn.commit()
        return jsonify({
            "message": f"Authorized: Machine {machine_id} successfully assembled {gpu_id}!"
        }), 200
        
    except Exception as e:
        conn.rollback() 
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# 4. Start the server (MUST be at the very bottom)
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
