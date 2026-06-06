const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'freshgrocer_secret_key_2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Database setup
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database
function initializeDatabase() {
  console.log('🔄 Initializing database...');
  
  // Enable foreign keys and better performance
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA journal_mode = WAL');
  
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip_code TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS categories (
      category_id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_name TEXT NOT NULL UNIQUE,
      category_description TEXT,
      category_image TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS products (
      product_id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_name TEXT NOT NULL,
      product_description TEXT,
      category_id INTEGER NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      original_price DECIMAL(10,2),
      unit TEXT NOT NULL,
      stock_quantity INTEGER DEFAULT 0,
      product_image TEXT,
      is_featured BOOLEAN DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      rating DECIMAL(3,2) DEFAULT 4.5,
      review_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS product_reviews (
      review_id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      review_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS shopping_cart (
      cart_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id)
    )`,

    `CREATE TABLE IF NOT EXISTS orders (
      order_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      shipping_address TEXT NOT NULL,
      shipping_city TEXT NOT NULL,
      shipping_state TEXT NOT NULL,
      shipping_zip_code TEXT NOT NULL,
      order_status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'pending',
      payment_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS order_items (
      order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      total_price DECIMAL(10,2) NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS notifications (
      notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  // Create tables one by one
  let tablesCreated = 0;
  
  function createNextTable() {
    if (tablesCreated >= tables.length) {
      console.log('✅ All tables created successfully');
      insertSampleData();
      return;
    }
    
    const sql = tables[tablesCreated];
    db.run(sql, (err) => {
      if (err) {
        console.error(`❌ Error creating table ${tablesCreated + 1}:`, err.message);
      } else {
        console.log(`✅ Table ${tablesCreated + 1} created successfully`);
      }
      tablesCreated++;
      setTimeout(createNextTable, 100);
    });
  }
  
  createNextTable();
}

function insertSampleData() {
  console.log('🔄 Inserting sample data...');
  
  // First, clear any existing data
  const clearTables = [
    'DELETE FROM notifications',
    'DELETE FROM order_items',
    'DELETE FROM orders',
    'DELETE FROM shopping_cart',
    'DELETE FROM product_reviews',
    'DELETE FROM products',
    'DELETE FROM categories',
    'DELETE FROM users'
  ];

  let cleared = 0;
  clearTables.forEach(sql => {
    db.run(sql, (err) => {
      if (err) console.warn('Warning clearing table:', err.message);
      cleared++;
      if (cleared === clearTables.length) {
        console.log('✅ Old data cleared');
        insertCategories();
      }
    });
  });
}

function insertCategories() {
  const categories = [
    ['Fruits & Vegetables', 'Fresh fruits and vegetables from local farms', 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?ixlib=rb-4.0.3&w=500&q=80'],
    ['Dairy & Eggs', 'Fresh dairy products and farm eggs', 'https://images.unsplash.com/photo-1566772940196-0e2e685c67a5?ixlib=rb-4.0.3&w=500&q=80'],
    ['Meat & Seafood', 'Quality meat and fresh seafood', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?ixlib=rb-4.0.3&w=500&q=80'],
    ['Bakery', 'Freshly baked bread and pastries', 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?ixlib=rb-4.0.3&w=500&q=80'],
    ['Beverages', 'Drinks and beverages', 'https://images.unsplash.com/photo-1613478223719-2ab802602423?ixlib=rb-4.0.3&w=500&q=80']
  ];

  let categoriesInserted = 0;
  const categoryIds = {};

  categories.forEach((category, index) => {
    db.run(
      'INSERT INTO categories (category_name, category_description, category_image) VALUES (?, ?, ?)',
      category,
      function(err) {
        if (err) {
          console.error('Error inserting category:', err.message);
        } else {
          categoryIds[category[0]] = this.lastID;
          console.log(`✅ Category inserted: ${category[0]} (ID: ${this.lastID})`);
        }
        
        categoriesInserted++;
        if (categoriesInserted === categories.length) {
          console.log('✅ All categories inserted');
          setTimeout(insertProducts.bind(null, categoryIds), 500);
        }
      }
    );
  });
}

function insertProducts(categoryIds) {
  console.log('Category IDs:', categoryIds);
  
  const products = [
    // Fruits & Vegetables
    ['Organic Apples', 'Fresh and juicy organic apples, perfect for snacking and baking', categoryIds['Fruits & Vegetables'], 4.99, 5.99, 'kg', 50, 'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?ixlib=rb-4.0.3&w=500&q=80', 1, 4.5, 128],
    ['Bananas', 'Sweet and ripe bananas, perfect for smoothies', categoryIds['Fruits & Vegetables'], 2.99, 3.49, 'kg', 60, 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?ixlib=rb-4.0.3&w=500&q=80', 1, 4.3, 95],
    ['Avocados', 'Fresh ripe avocados, perfect for guacamole', categoryIds['Fruits & Vegetables'], 3.99, 4.99, 'each', 35, 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?ixlib=rb-4.0.3&w=500&q=80', 0, 4.6, 212],
    
    // Dairy & Eggs
    ['Fresh Milk', 'Farm-fresh whole milk, rich and creamy', categoryIds['Dairy & Eggs'], 3.99, 4.49, 'liter', 30, 'https://images.unsplash.com/photo-1563636619-e9143da7973b?ixlib=rb-4.0.3&w=500&q=80', 1, 4.6, 156],
    ['Free-Range Eggs', 'Farm-fresh free-range eggs, dozen', categoryIds['Dairy & Eggs'], 5.49, 6.99, 'dozen', 45, 'https://images.unsplash.com/photo-1587335042972-8d7d45ac7735?ixlib=rb-4.0.3&w=500&q=80', 0, 4.8, 203],
    ['Greek Yogurt', 'Creamy Greek yogurt, high in protein', categoryIds['Dairy & Eggs'], 6.99, 8.49, '500g', 20, 'https://images.unsplash.com/photo-1488477181946-6428a0291777?ixlib=rb-4.0.3&w=500&q=80', 1, 4.4, 178],
    
    // Meat & Seafood
    ['Chicken Breast', 'Fresh boneless chicken breast, great for grilling', categoryIds['Meat & Seafood'], 12.99, 14.99, 'kg', 25, 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?ixlib=rb-4.0.3&w=500&q=80', 1, 4.4, 167],
    ['Salmon Fillet', 'Fresh salmon fillet, high in omega-3', categoryIds['Meat & Seafood'], 18.99, 22.99, 'kg', 15, 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?ixlib=rb-4.0.3&w=500&q=80', 1, 4.7, 145],
    
    // Bakery
    ['Whole Wheat Bread', 'Freshly baked whole wheat bread, healthy and delicious', categoryIds['Bakery'], 3.49, 3.99, 'loaf', 40, 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?ixlib=rb-4.0.3&w=500&q=80', 1, 4.3, 234],
    
    // Beverages
    ['Orange Juice', '100% pure orange juice, no added sugar', categoryIds['Beverages'], 4.49, 5.99, '1L', 35, 'https://images.unsplash.com/photo-1613478223719-2ab802602423?ixlib=rb-4.0.3&w=500&q=80', 0, 4.2, 89]
  ];

  let productsInserted = 0;
  
  products.forEach((product) => {
    db.run(
      `INSERT INTO products (product_name, product_description, category_id, price, original_price, unit, stock_quantity, product_image, is_featured, rating, review_count) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      product,
      function(err) {
        if (err) {
          console.error('Error inserting product:', err.message);
        } else {
          console.log(`✅ Product inserted: ${product[0]}`);
        }
        
        productsInserted++;
        if (productsInserted === products.length) {
          console.log('✅ All products inserted');
          setTimeout(insertDemoUser, 500);
        }
      }
    );
  });
}

function insertDemoUser() {
  const hashedPassword = bcrypt.hashSync('password123', 10);
  
  db.run(
    'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)',
    ['John', 'Doe', 'demo@freshgrocer.com', hashedPassword],
    function(err) {
      if (err) {
        console.error('Error inserting demo user:', err.message);
      } else {
        console.log('✅ Demo user inserted');
        
        // Add some sample reviews
        setTimeout(insertSampleReviews, 500);
      }
    }
  );
}

function insertSampleReviews() {
  // Get some product IDs to add reviews to
  db.all('SELECT product_id FROM products LIMIT 3', (err, products) => {
    if (err) {
      console.log('✅ Database initialization complete!');
      return;
    }
    
    const reviews = [
      [products[0].product_id, 1, 5, 'These apples are absolutely delicious! Fresh and crunchy.'],
      [products[0].product_id, 1, 4, 'Good quality apples, will buy again.'],
      [products[1].product_id, 1, 5, 'Best bananas I have ever had! Perfect ripeness.'],
      [products[2].product_id, 1, 4, 'Creamy and delicious avocados. Great for toast!']
    ];
    
    let reviewsInserted = 0;
    
    reviews.forEach(review => {
      db.run(
        'INSERT INTO product_reviews (product_id, user_id, rating, review_text) VALUES (?, ?, ?, ?)',
        review,
        (err) => {
          if (err) console.error('Error inserting review:', err.message);
          reviewsInserted++;
          if (reviewsInserted === reviews.length) {
            console.log('✅ Sample reviews inserted');
            console.log('🎉 Database initialization complete!');
          }
        }
      );
    });
  });
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'FreshGrocer API is running',
    timestamp: new Date().toISOString()
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'FreshGrocer API',
    version: '1.0.0',
    endpoints: {
      products: '/api/products',
      categories: '/api/categories',
      cart: '/api/cart',
      orders: '/api/orders',
      users: '/api/users'
    }
  });
});

// Auth routes
app.post('/api/register', (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    if (row) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run(
      'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)',
      [firstName, lastName, email, hashedPassword],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ success: false, message: 'Database error' });
        }

        const token = jwt.sign({ userId: this.lastID, email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ 
          success: true, 
          message: 'User registered successfully',
          user: { user_id: this.lastID, first_name: firstName, last_name: lastName, email },
          token 
        });
      }
    );
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.user_id, email }, JWT_SECRET, { expiresIn: '24h' });
    const { password_hash, ...userData } = user;
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      user: userData,
      token 
    });
  });
});

// Products routes - FIXED: Added proper error handling and response
app.get('/api/products', (req, res) => {
  const { category, search, minPrice, maxPrice, sort, limit, featured } = req.query;
  
  console.log('Products API called with params:', req.query);
  
  let sql = `
    SELECT p.*, c.category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.category_id 
    WHERE p.is_active = 1
  `;
  let params = [];

  if (category && category !== 'all') {
    sql += ' AND c.category_name = ?';
    params.push(category);
  }

  if (search) {
    sql += ' AND (p.product_name LIKE ? OR p.product_description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (minPrice) {
    sql += ' AND p.price >= ?';
    params.push(parseFloat(minPrice));
  }

  if (maxPrice) {
    sql += ' AND p.price <= ?';
    params.push(parseFloat(maxPrice));
  }

  if (featured === 'true') {
    sql += ' AND p.is_featured = 1';
  }

  switch(sort) {
    case 'price-low': sql += ' ORDER BY p.price ASC'; break;
    case 'price-high': sql += ' ORDER BY p.price DESC'; break;
    case 'rating': sql += ' ORDER BY p.rating DESC'; break;
    case 'name': sql += ' ORDER BY p.product_name ASC'; break;
    default: sql += ' ORDER BY p.is_featured DESC, p.rating DESC';
  }

  if (limit) {
    sql += ' LIMIT ?';
    params.push(parseInt(limit));
  }

  console.log('Executing SQL:', sql, 'with params:', params);

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Database error in products API:', err);
      return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
    console.log(`Found ${rows.length} products`);
    res.json({ success: true, data: rows });
  });
});

app.get('/api/products/featured', (req, res) => {
  const sql = `
    SELECT p.*, c.category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.category_id 
    WHERE p.is_featured = 1 AND p.is_active = 1 
    ORDER BY p.rating DESC 
    LIMIT 8
  `;

  db.all(sql, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    res.json({ success: true, data: rows });
  });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  
  const sql = `
    SELECT p.*, c.category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.category_id 
    WHERE p.product_id = ?
  `;

  db.get(sql, [id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    if (!row) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: row });
  });
});

// Product reviews
app.get('/api/products/:id/reviews', (req, res) => {
  const { id } = req.params;
  
  const sql = `
    SELECT pr.*, u.first_name, u.last_name 
    FROM product_reviews pr 
    LEFT JOIN users u ON pr.user_id = u.user_id 
    WHERE pr.product_id = ? 
    ORDER BY pr.created_at DESC
  `;

  db.all(sql, [id], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    res.json({ success: true, data: rows });
  });
});

app.post('/api/products/:id/reviews', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { rating, review_text } = req.body;
  const userId = req.user.userId;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
  }

  db.run(
    'INSERT INTO product_reviews (product_id, user_id, rating, review_text) VALUES (?, ?, ?, ?)',
    [id, userId, rating, review_text],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      // Update product rating
      updateProductRating(id);
      
      io.emit('new_review', { product_id: id, user_id: userId });
      
      res.json({ success: true, message: 'Review added successfully' });
    }
  );
});

function updateProductRating(productId) {
  const sql = `
    UPDATE products 
    SET rating = (
      SELECT AVG(rating) FROM product_reviews WHERE product_id = ?
    ),
    review_count = (
      SELECT COUNT(*) FROM product_reviews WHERE product_id = ?
    )
    WHERE product_id = ?
  `;
  
  db.run(sql, [productId, productId, productId], (err) => {
    if (err) {
      console.error('Error updating product rating:', err);
    }
  });
}

// Categories route - FIXED: Simple and reliable
app.get('/api/categories', (req, res) => {
  console.log('Categories API called');
  db.all('SELECT * FROM categories WHERE is_active = 1 ORDER BY category_name', (err, rows) => {
    if (err) {
      console.error('Database error in categories:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    console.log(`Found ${rows.length} categories`);
    res.json({ success: true, data: rows });
  });
});

// Cart routes
app.get('/api/cart/:userId', authenticateToken, (req, res) => {
  const { userId } = req.params;
  
  if (parseInt(userId) !== req.user.userId) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const sql = `
    SELECT sc.*, p.product_name, p.price, p.product_image, p.unit, p.stock_quantity
    FROM shopping_cart sc
    LEFT JOIN products p ON sc.product_id = p.product_id
    WHERE sc.user_id = ?
  `;

  db.all(sql, [userId], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    res.json({ success: true, data: rows });
  });
});

app.post('/api/cart/add', authenticateToken, (req, res) => {
  const { userId, productId, quantity = 1 } = req.body;

  if (parseInt(userId) !== req.user.userId) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  db.get(
    'SELECT * FROM shopping_cart WHERE user_id = ? AND product_id = ?',
    [userId, productId],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (row) {
        const newQuantity = row.quantity + quantity;
        if (newQuantity <= 0) {
          db.run(
            'DELETE FROM shopping_cart WHERE user_id = ? AND product_id = ?',
            [userId, productId],
            function(err) {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, message: 'Database error' });
              }
              res.json({ success: true, message: 'Item removed from cart' });
            }
          );
        } else {
          db.run(
            'UPDATE shopping_cart SET quantity = ? WHERE user_id = ? AND product_id = ?',
            [newQuantity, userId, productId],
            function(err) {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, message: 'Database error' });
              }
              res.json({ success: true, message: 'Cart updated successfully' });
            }
          );
        }
      } else {
        if (quantity > 0) {
          db.run(
            'INSERT INTO shopping_cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
            [userId, productId, quantity],
            function(err) {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, message: 'Database error' });
              }
              res.json({ success: true, message: 'Product added to cart' });
            }
          );
        } else {
          res.json({ success: true, message: 'No action needed' });
        }
      }
    }
  );
});

// Notifications
app.get('/api/notifications', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  
  db.all(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
    [userId],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      res.json({ success: true, data: rows });
    }
  );
});

app.post('/api/notifications/mark-read', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  
  db.run(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
    [userId],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      res.json({ success: true, message: 'Notifications marked as read' });
    }
  );
});

// Orders
app.post('/api/orders', authenticateToken, (req, res) => {
  const { userId, items, totalAmount, shippingAddress } = req.body;

  if (parseInt(userId) !== req.user.userId) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'No items in order' });
  }

  db.run(
    `INSERT INTO orders (user_id, total_amount, shipping_address, shipping_city, shipping_state, shipping_zip_code) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, totalAmount, shippingAddress.address, shippingAddress.city, shippingAddress.state, shippingAddress.zipCode],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      const orderId = this.lastID;
      let itemsProcessed = 0;

      items.forEach(item => {
        db.run(
          'INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
          [orderId, item.product_id, item.quantity, item.price, item.price * item.quantity],
          (err) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ success: false, message: 'Database error' });
            }
            
            itemsProcessed++;
            if (itemsProcessed === items.length) {
              // Clear cart
              db.run('DELETE FROM shopping_cart WHERE user_id = ?', [userId], (err) => {
                if (err) {
                  console.error('Error clearing cart:', err);
                }
                
                // Create notification
                db.run(
                  'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
                  [userId, 'Order Confirmed', `Your order #${orderId} has been placed successfully!`, 'success']
                );
                
                io.emit('order_created', { user_id: userId, order_id: orderId });
                
                res.json({ success: true, message: 'Order created successfully', orderId });
              });
            }
          }
        );
      });
    }
  );
});

app.get('/api/orders/user/:userId', authenticateToken, (req, res) => {
  const { userId } = req.params;

  if (parseInt(userId) !== req.user.userId) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const sql = `
    SELECT o.*, 
           COUNT(oi.order_item_id) as item_count
    FROM orders o
    LEFT JOIN order_items oi ON o.order_id = oi.order_id
    WHERE o.user_id = ?
    GROUP BY o.order_id
    ORDER BY o.created_at DESC
  `;

  db.all(sql, [userId], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    res.json({ success: true, data: rows });
  });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Socket.io for real-time features
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_user', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 FreshGrocer server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔍 API info: http://localhost:${PORT}/api`);
});
