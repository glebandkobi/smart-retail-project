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