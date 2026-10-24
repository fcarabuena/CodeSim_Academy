-- "Online shop" sample database used by the SQL track (SQLite).
-- Every SQL lesson starts from a fresh copy, so students can't break it.

CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  joined_on TEXT NOT NULL -- ISO date, e.g. '2024-03-15'
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  stock INTEGER NOT NULL
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  ordered_on TEXT NOT NULL,
  status TEXT NOT NULL -- 'pending' | 'shipped' | 'delivered' | 'cancelled'
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL
);

INSERT INTO customers (id, name, email, city, country, joined_on) VALUES
  (1, 'Amara Okafor', 'amara@example.com', 'Lagos', 'Nigeria', '2024-01-12'),
  (2, 'Liam Murphy', 'liam@example.com', 'Dublin', 'Ireland', '2024-02-03'),
  (3, 'Sofia Rossi', 'sofia@example.com', 'Milan', 'Italy', '2024-02-21'),
  (4, 'Kenji Tanaka', 'kenji@example.com', 'Osaka', 'Japan', '2024-03-08'),
  (5, 'Maria Santos', 'maria@example.com', 'Manila', 'Philippines', '2024-03-30'),
  (6, 'Noah Schmidt', 'noah@example.com', 'Berlin', 'Germany', '2024-04-17'),
  (7, 'Priya Patel', 'priya@example.com', 'Mumbai', 'India', '2024-05-05'),
  (8, 'Lucas Silva', 'lucas@example.com', 'Sao Paulo', 'Brazil', '2024-06-11'),
  (9, 'Emma Dubois', 'emma@example.com', 'Lyon', 'France', '2024-07-02'),
  (10, 'Jose Reyes', 'jose@example.com', 'Cebu', 'Philippines', '2024-08-19');

INSERT INTO products (id, name, category, price, stock) VALUES
  (1, 'Wireless Mouse', 'Electronics', 24.99, 120),
  (2, 'Mechanical Keyboard', 'Electronics', 79.0, 45),
  (3, 'USB-C Charger', 'Electronics', 19.5, 200),
  (4, 'Noise-Cancelling Headphones', 'Electronics', 149.0, 30),
  (5, 'Python Crash Course', 'Books', 29.95, 60),
  (6, 'Eloquent JavaScript', 'Books', 34.5, 40),
  (7, 'SQL for Beginners', 'Books', 18.0, 75),
  (8, 'Steel Water Bottle', 'Home', 15.0, 150),
  (9, 'Desk Lamp', 'Home', 32.0, 55),
  (10, 'Ceramic Mug', 'Home', 9.5, 300),
  (11, 'Laptop Backpack', 'Accessories', 49.99, 80),
  (12, 'Sticker Pack', 'Accessories', 4.99, 500);

INSERT INTO orders (id, customer_id, ordered_on, status) VALUES
  (1, 1, '2024-09-01', 'delivered'),
  (2, 3, '2024-09-03', 'delivered'),
  (3, 2, '2024-09-07', 'shipped'),
  (4, 5, '2024-09-10', 'delivered'),
  (5, 1, '2024-09-15', 'cancelled'),
  (6, 7, '2024-09-18', 'shipped'),
  (7, 4, '2024-09-22', 'pending'),
  (8, 5, '2024-09-25', 'pending'),
  (9, 9, '2024-09-28', 'delivered'),
  (10, 6, '2024-10-02', 'shipped');

INSERT INTO order_items (id, order_id, product_id, quantity) VALUES
  (1, 1, 1, 1),
  (2, 1, 5, 1),
  (3, 2, 4, 1),
  (4, 3, 2, 1),
  (5, 3, 12, 3),
  (6, 4, 10, 2),
  (7, 4, 8, 1),
  (8, 5, 9, 1),
  (9, 6, 6, 1),
  (10, 6, 7, 1),
  (11, 7, 11, 1),
  (12, 8, 3, 2),
  (13, 9, 5, 1),
  (14, 9, 10, 4),
  (15, 10, 1, 2);
