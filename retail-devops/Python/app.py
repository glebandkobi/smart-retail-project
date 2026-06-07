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
