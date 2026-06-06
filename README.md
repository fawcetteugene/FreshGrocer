# FreshGrocer 🛒

A modern, full-stack e-commerce platform for online grocery shopping with real-time features and intuitive user experience.

## 🚀 Features

- **User Authentication**: Secure registration and login system with JWT tokens
- **Product Catalog**: Browse and search through fresh groceries and products
- **Shopping Cart**: Add, remove, and manage items with persistent cart functionality
- **Real-time Updates**: Live inventory and order status updates via WebSocket
- **Responsive Design**: Mobile-first design that works across all devices
- **Order Management**: Complete checkout process and order tracking
- **Special Deals**: Featured products and promotional offers

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web application framework
- **SQLite** - Database for data persistence
- **Socket.IO** - Real-time bidirectional communication
- **JWT** - JSON Web Token for authentication
- **bcryptjs** - Password hashing

### Frontend
- **Vanilla JavaScript** - Client-side functionality
- **HTML5/CSS3** - Structure and styling
- **Font Awesome** - Icons and visual elements
- **Responsive CSS Grid/Flexbox** - Layout system

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/freshgrocer.git
   cd freshgrocer
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Start the application**
   ```bash
   npm start
   ```

4. **Access the application**
   - Website: http://localhost:3000
   - API: http://localhost:3000/api

## 🔑 Default Credentials

For testing purposes, use these default login credentials:
- **Email**: demo@freshgrocer.com
- **Password**: password123

## 📁 Project Structure

```
freshgrocer/
├── backend/
│   ├── server.js          # Main server file
│   ├── package.json       # Backend dependencies
│   └── database.db        # SQLite database
├── frontend/
│   ├── index.html         # Main HTML file
│   ├── style.css          # Styling
│   ├── script.js          # Main JavaScript
│   └── auth.js            # Authentication logic
└── README.md
```

## 🌟 Key Functionalities

### Authentication System
- User registration and login
- JWT-based session management
- Secure password hashing

### E-commerce Features
- Product browsing and search
- Category-based filtering
- Shopping cart management
- Checkout and order processing

### Real-time Features
- Live inventory updates
- Real-time notifications
- Dynamic cart synchronization

## 🔧 API Endpoints

### Authentication
- `POST /api/register` - User registration
- `POST /api/login` - User login
- `GET /api/profile` - Get user profile

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get specific product
- `GET /api/categories` - Get product categories

### Cart & Orders
- `POST /api/cart` - Add to cart
- `GET /api/cart` - Get cart items
- `POST /api/checkout` - Process order

## 🚀 Deployment

### Environment Variables
Create a `.env` file in the backend directory:
```env
PORT=3000
JWT_SECRET=your_jwt_secret_here
NODE_ENV=production
```

### Production Setup
1. Build for production
2. Configure reverse proxy (nginx recommended)
3. Set up SSL certificate
4. Configure database backup strategy

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Issues & Support

If you encounter any issues or have questions:
1. Check existing [Issues](../../issues)
2. Create a new issue with detailed description
3. Include steps to reproduce the problem

## 🙏 Acknowledgments

- Font Awesome for icons
- Express.js community for excellent documentation
- Socket.IO for real-time capabilities

---

**Made with ❤️ for modern grocery shopping experience**
