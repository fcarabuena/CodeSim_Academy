SELECT orders.id, customers.name, orders.status
FROM orders
JOIN customers ON customers.id = orders.customer_id
WHERE orders.status = 'delivered';
