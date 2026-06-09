#Python
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
db = SQLAlchemy(app)

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sku = db.Column(db.String(50), unique=True)
    quantity = db.Column(db.Integer)

@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    items = Product.query.all()
    return jsonify([{"sku": i.sku, "quantity": i.quantity} for i in items])

if __name__ == '__main__':
    with app.app_context():
        db.create_all()

        if Product.query.count() == 0:
            db.session.add(Product(sku='LAPTOP-001', quantity=10))
            db.session.add(Product(sku='MOUSE-002', quantity=25))
            db.session.add(Product(sku='KEYBOARD-003', quantity=15))
            db.session.commit()

    app.run(host='0.0.0.0', port=5000, debug=True)

@app.route('/api/produce', methods=['POST'])
def produce_item():
    data = request.json
    gpu_id = data.get('gpu_id')
    machine_id = data.get('machine_id')
    password = data.get('password')
    
    # 1. HARDCODED MACHINE AUTHENTICATION
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