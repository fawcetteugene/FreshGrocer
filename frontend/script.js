// Global state
let currentUser = null;
let cart = [];
let products = [];
let categories = [];
let socket = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing FreshGrocer app...');
    initializeApp();
    loadCategories();
    loadFeaturedProducts();
    setupSocket();
    startCountdownTimer();
});

function initializeApp() {
    const savedUser = localStorage.getItem('freshgrocer_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            updateUserInterface();
            loadCart();
            loadNotifications();
        } catch (e) {
            console.error('Error parsing saved user:', e);
            localStorage.removeItem('freshgrocer_user');
        }
    }
    console.log('App initialized, user:', currentUser ? 'logged in' : 'not logged in');
}

function setupSocket() {
    try {
        socket = io();
        
        socket.on('connect', () => {
            console.log('Connected to server via WebSocket');
            if (currentUser) {
                socket.emit('join_user', currentUser.user_id);
            }
        });
        
        socket.on('new_review', (data) => {
            if (currentUser && data.user_id !== currentUser.user_id) {
                showToast('New review added for a product you viewed!', 'info');
            }
        });
        
        socket.on('order_created', (data) => {
            if (currentUser && data.user_id === currentUser.user_id) {
                showToast('Your order has been confirmed!', 'success');
                loadNotifications();
            }
        });
        
        socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
    } catch (error) {
        console.error('WebSocket setup failed:', error);
    }
}

// Section navigation
function showSection(sectionName) {
    console.log('Showing section:', sectionName);
    
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Find and activate the corresponding nav link
    const activeLink = document.querySelector(`.nav-link[onclick*="${sectionName}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // Load section-specific data
    switch(sectionName) {
        case 'home':
            loadFeaturedProducts();
            break;
        case 'products':
            loadProducts();
            break;
        case 'deals':
            loadDeals();
            break;
        case 'cart':
            loadCart();
            break;
    }
}

// Search functionality
function handleGlobalSearch(event) {
    if (event.key === 'Enter') {
        const searchTerm = event.target.value.trim();
        if (searchTerm) {
            showSection('products');
            setTimeout(() => {
                // This will be handled by the products section filter
                const searchInput = document.querySelector('#globalSearch');
                if (searchInput) {
                    searchInput.value = '';
                }
                // Trigger search in products
                loadProducts({ search: searchTerm });
            }, 100);
        }
    }
}

// API functions with better error handling
async function apiCall(endpoint, options = {}) {
    const url = `/api${endpoint}`;
    console.log('API Call:', url, options);
    
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...(currentUser && { 'Authorization': `Bearer ${currentUser.token}` }),
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API Response:', data);
        return data;
    } catch (error) {
        console.error('API call failed:', error);
        showToast('Network error. Please try again.', 'error');
        return { success: false, message: 'Network error: ' + error.message };
    }
}

// Data loading functions
async function loadCategories() {
    console.log('Loading categories...');
    const data = await apiCall('/categories');
    if (data.success) {
        categories = data.data;
        console.log('Categories loaded:', categories.length);
        renderCategories();
        populateCategoryFilter();
    } else {
        console.error('Failed to load categories:', data.message);
        showToast('Failed to load categories', 'error');
    }
}

async function loadProducts(filters = {}) {
    console.log('Loading products with filters:', filters);
    
    const categoryFilter = document.getElementById('categoryFilter')?.value || filters.category || 'all';
    const sortFilter = document.getElementById('sortFilter')?.value || filters.sort || 'featured';
    const minPrice = document.getElementById('minPrice')?.value || filters.minPrice || '';
    const maxPrice = document.getElementById('maxPrice')?.value || filters.maxPrice || '';
    const searchTerm = filters.search || '';
    
    const params = new URLSearchParams();
    if (categoryFilter && categoryFilter !== 'all') params.append('category', categoryFilter);
    if (sortFilter) params.append('sort', sortFilter);
    if (minPrice) params.append('minPrice', minPrice);
    if (maxPrice) params.append('maxPrice', maxPrice);
    if (searchTerm) params.append('search', searchTerm);
    
    const data = await apiCall(`/products?${params}`);
    if (data.success) {
        products = data.data;
        console.log('Products loaded:', products.length);
        renderProducts(products, 'productsGrid');
    } else {
        console.error('Failed to load products:', data.message);
        showToast('Failed to load products', 'error');
        renderProducts([], 'productsGrid');
    }
}

async function loadFeaturedProducts() {
    console.log('Loading featured products...');
    const data = await apiCall('/products?featured=true&limit=8');
    if (data.success) {
        console.log('Featured products loaded:', data.data.length);
        renderProducts(data.data, 'featuredProducts');
    } else {
        console.error('Failed to load featured products:', data.message);
        renderProducts([], 'featuredProducts');
    }
}

async function loadDeals() {
    console.log('Loading deals...');
    const data = await apiCall('/products');
    if (data.success) {
        const deals = data.data.filter(product => product.original_price && product.original_price > product.price);
        console.log('Deals loaded:', deals.length);
        renderProducts(deals, 'dealsGrid');
    } else {
        console.error('Failed to load deals:', data.message);
        renderProducts([], 'dealsGrid');
    }
}

// Rendering functions
function renderCategories() {
    const grid = document.getElementById('categoriesGrid');
    if (!grid) {
        console.log('Categories grid not found');
        return;
    }
    
    if (categories.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No categories found</p></div>';
        return;
    }
    
    grid.innerHTML = categories.map(category => `
        <div class="category-card" onclick="filterByCategory('${category.category_name}')">
            <img src="${category.category_image}" alt="${category.category_name}" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&q=80'">
            <h3>${category.category_name}</h3>
        </div>
    `).join('');
    
    console.log('Categories rendered:', categories.length);
}

function populateCategoryFilter() {
    const filter = document.getElementById('categoryFilter');
    if (!filter) return;
    
    filter.innerHTML = '<option value="all">All Categories</option>' +
        categories.map(category => `
            <option value="${category.category_name}">${category.category_name}</option>
        `).join('');
    
    console.log('Category filter populated');
}

function renderProducts(productsToRender, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.log('Container not found:', containerId);
        return;
    }
    
    console.log(`Rendering ${productsToRender.length} products in ${containerId}`);
    
    if (productsToRender.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>No products found</p>
                <button class="btn btn-secondary" onclick="loadProducts()">Show All Products</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = productsToRender.map(product => {
        const hasDiscount = product.original_price && product.original_price > product.price;
        const discountPercent = hasDiscount ? Math.round((1 - product.price / product.original_price) * 100) : 0;
        
        return `
            <div class="product-card">
                ${hasDiscount ? `<div class="product-badge">${discountPercent}% OFF</div>` : ''}
                <img src="${product.product_image}" alt="${product.product_name}" class="product-image" 
                     onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&q=80'">
                <div class="product-content">
                    <div class="product-category">${product.category_name || 'Uncategorized'}</div>
                    <h3 class="product-title">${product.product_name}</h3>
                    <p class="product-description">${product.product_description || 'Fresh and delicious product'}</p>
                    <div class="product-price">
                        <span class="current-price">$${product.price}</span>
                        ${hasDiscount ? `<span class="original-price">$${product.original_price}</span>` : ''}
                    </div>
                    <div class="product-rating">
                        ${'★'.repeat(Math.floor(product.rating))}${'☆'.repeat(5 - Math.floor(product.rating))}
                        <span class="rating-count">(${product.review_count})</span>
                    </div>
                    <div class="product-actions">
                        <button class="btn-add-cart" onclick="addToCart(${product.product_id})">
                            <i class="fas fa-shopping-cart"></i> Add to Cart
                        </button>
                        <button class="btn-view" onclick="showProductDetail(${product.product_id})">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Product details and reviews
async function showProductDetail(productId) {
    console.log('Showing product detail for:', productId);
    
    let product = products.find(p => p.product_id === productId);
    if (!product) {
        const productData = await apiCall(`/products/${productId}`);
        if (productData.success) {
            product = productData.data;
        } else {
            showToast('Product not found', 'error');
            return;
        }
    }
    
    const reviewsData = await apiCall(`/products/${productId}/reviews`);
    const reviews = reviewsData.success ? reviewsData.data : [];
    
    const modal = document.getElementById('productModal');
    const detail = document.getElementById('productDetail');
    
    const hasDiscount = product.original_price && product.original_price > product.price;
    const discountPercent = hasDiscount ? Math.round((1 - product.price / product.original_price) * 100) : 0;
    
    detail.innerHTML = `
        <div class="product-detail">
            <div class="product-detail-image">
                <img src="${product.product_image}" alt="${product.product_name}" 
                     onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&q=80'">
            </div>
            <div class="product-detail-info">
                <h2>${product.product_name}</h2>
                <p>${product.product_description || 'Fresh and delicious product'}</p>
                <div class="product-price">
                    <span class="current-price">$${product.price}</span>
                    ${hasDiscount ? `<span class="original-price">$${product.original_price}</span>` : ''}
                </div>
                <div class="product-rating">
                    ${'★'.repeat(Math.floor(product.rating))}${'☆'.repeat(5 - Math.floor(product.rating))}
                    <span>(${product.review_count} reviews)</span>
                </div>
                <button class="btn btn-primary" onclick="addToCart(${product.product_id}); closeProductModal()">
                    <i class="fas fa-shopping-cart"></i> Add to Cart
                </button>
            </div>
        </div>
        <div class="product-reviews">
            <h3>Customer Reviews</h3>
            ${currentUser ? `
                <div class="add-review">
                    <h4>Add Your Review</h4>
                    <select id="reviewRating">
                        <option value="5">★★★★★ Excellent</option>
                        <option value="4">★★★★☆ Very Good</option>
                        <option value="3">★★★☆☆ Good</option>
                        <option value="2">★★☆☆☆ Fair</option>
                        <option value="1">★☆☆☆☆ Poor</option>
                    </select>
                    <textarea id="reviewText" placeholder="Share your experience with this product..."></textarea>
                    <button class="btn btn-primary" onclick="submitReview(${product.product_id})">Submit Review</button>
                </div>
            ` : '<p><a href="#" onclick="toggleAuthModal(); closeProductModal();">Login</a> to add a review</p>'}
            <div class="reviews-list">
                ${reviews.length > 0 ? reviews.map(review => `
                    <div class="review-item">
                        <div class="review-header">
                            <strong>${review.first_name} ${review.last_name}</strong>
                            <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                        </div>
                        <p>${review.review_text || 'No comment provided.'}</p>
                        <small>${new Date(review.created_at).toLocaleDateString()}</small>
                    </div>
                `).join('') : '<p>No reviews yet. Be the first to review!</p>'}
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
}

async function submitReview(productId) {
    if (!currentUser) {
        showToast('Please login to submit a review', 'error');
        return;
    }
    
    const rating = document.getElementById('reviewRating').value;
    const reviewText = document.getElementById('reviewText').value;
    
    if (!rating) {
        showToast('Please select a rating', 'error');
        return;
    }
    
    const data = await apiCall(`/products/${productId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating: parseInt(rating), review_text: reviewText })
    });
    
    if (data.success) {
        showToast('Review submitted successfully!', 'success');
        closeProductModal();
        setTimeout(() => showProductDetail(productId), 500);
    } else {
        showToast(data.message, 'error');
    }
}

function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
}

// Cart functionality
async function loadCart() {
    if (!currentUser) {
        updateCartUI([]);
        return;
    }
    
    console.log('Loading cart for user:', currentUser.user_id);
    const data = await apiCall(`/cart/${currentUser.user_id}`);
    if (data.success) {
        cart = data.data;
        console.log('Cart loaded:', cart.length, 'items');
        updateCartUI(cart);
    } else {
        console.error('Failed to load cart:', data.message);
    }
}

async function addToCart(productId) {
    if (!currentUser) {
        showToast('Please login to add items to cart', 'error');
        toggleAuthModal();
        return;
    }
    
    console.log('Adding to cart:', productId);
    const data = await apiCall('/cart/add', {
        method: 'POST',
        body: JSON.stringify({
            userId: currentUser.user_id,
            productId: productId,
            quantity: 1
        })
    });
    
    if (data.success) {
        showToast('Product added to cart!', 'success');
        loadCart();
    } else {
        showToast(data.message, 'error');
    }
}

async function updateCartQuantity(productId, change) {
    const item = cart.find(item => item.product_id === productId);
    if (!item) return;
    
    const newQuantity = item.quantity + change;
    
    const data = await apiCall('/cart/add', {
        method: 'POST',
        body: JSON.stringify({
            userId: currentUser.user_id,
            productId: productId,
            quantity: newQuantity
        })
    });
    
    if (data.success) {
        loadCart();
    } else {
        showToast(data.message, 'error');
    }
}

async function removeFromCart(productId) {
    const data = await apiCall('/cart/add', {
        method: 'POST',
        body: JSON.stringify({
            userId: currentUser.user_id,
            productId: productId,
            quantity: 0
        })
    });
    
    if (data.success) {
        showToast('Item removed from cart', 'success');
        loadCart();
    } else {
        showToast(data.message, 'error');
    }
}

function updateCartUI(cartItems) {
    const navCartCount = document.getElementById('navCartCount');
    const emptyCart = document.getElementById('emptyCart');
    const cartContent = document.getElementById('cartContent');
    const cartItemsContainer = document.getElementById('cartItems');
    
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    navCartCount.textContent = totalItems;
    
    if (cartItems.length === 0) {
        emptyCart.style.display = 'block';
        cartContent.style.display = 'none';
        return;
    }
    
    emptyCart.style.display = 'none';
    cartContent.style.display = 'grid';
    
    cartItemsContainer.innerHTML = cartItems.map(item => `
        <div class="cart-item">
            <img src="${item.product_image}" alt="${item.product_name}" class="cart-item-image"
                 onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&q=80'">
            <div class="cart-item-details">
                <h4>${item.product_name}</h4>
                <div class="cart-item-price">$${item.price} per ${item.unit}</div>
            </div>
            <div class="quantity-controls">
                <button class="quantity-btn" onclick="updateCartQuantity(${item.product_id}, -1)">-</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn" onclick="updateCartQuantity(${item.product_id}, 1)">+</button>
            </div>
            <div class="cart-item-total">$${(item.price * item.quantity).toFixed(2)}</div>
            <button class="btn-remove" onclick="removeFromCart(${item.product_id})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
    
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const delivery = subtotal > 50 ? 0 : 5.99;
    const total = subtotal + delivery;
    
    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('delivery').textContent = delivery === 0 ? 'FREE' : `$${delivery.toFixed(2)}`;
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
}

// Notifications
async function loadNotifications() {
    if (!currentUser) return;
    
    const data = await apiCall('/notifications');
    if (data.success) {
        renderNotifications(data.data);
    }
}

function renderNotifications(notifications) {
    const list = document.getElementById('notificationsList');
    const count = document.getElementById('notificationCount');
    
    const unreadCount = notifications.filter(n => !n.is_read).length;
    count.textContent = unreadCount;
    
    if (notifications.length === 0) {
        list.innerHTML = '<div class="notification-empty">No notifications</div>';
        return;
    }
    
    list.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.is_read ? '' : 'unread'}">
            <div class="notification-title">${notification.title}</div>
            <div class="notification-message">${notification.message}</div>
            <div class="notification-time">${new Date(notification.created_at).toLocaleString()}</div>
        </div>
    `).join('');
}

async function markAllAsRead() {
    if (!currentUser) return;
    
    const data = await apiCall('/notifications/mark-read', {
        method: 'POST'
    });
    
    if (data.success) {
        loadNotifications();
        showToast('All notifications marked as read', 'success');
    }
}

function toggleNotifications() {
    const panel = document.getElementById('notificationsPanel');
    panel.classList.toggle('show');
    
    if (panel.classList.contains('show')) {
        loadNotifications();
    }
}

// Checkout
async function checkout() {
    if (!currentUser) {
        showToast('Please login to checkout', 'error');
        toggleAuthModal();
        return;
    }
    
    if (cart.length === 0) {
        showToast('Your cart is empty', 'error');
        return;
    }
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const delivery = subtotal > 50 ? 0 : 5.99;
    const total = subtotal + delivery;
    
    const orderData = {
        userId: currentUser.user_id,
        items: cart,
        totalAmount: total,
        shippingAddress: {
            address: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '10001'
        }
    };
    
    console.log('Placing order:', orderData);
    const data = await apiCall('/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
    });
    
    if (data.success) {
        showToast('Order placed successfully!', 'success');
        cart = [];
        updateCartUI([]);
        loadNotifications();
    } else {
        showToast(data.message, 'error');
    }
}

// Utility functions
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function filterByCategory(categoryName) {
    showSection('products');
    setTimeout(() => {
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.value = categoryName;
            loadProducts({ category: categoryName });
        }
    }, 100);
}

function updateUserInterface() {
    const userGreeting = document.getElementById('userGreeting');
    
    if (currentUser) {
        userGreeting.textContent = `Hi, ${currentUser.first_name}`;
    } else {
        userGreeting.textContent = 'Account';
    }
}

// Countdown timer for deals
function startCountdownTimer() {
    function updateCountdown() {
        const now = new Date();
        const endTime = new Date(now);
        endTime.setDate(now.getDate() + 2);
        
        const timeLeft = endTime - now;
        
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        
        const daysEl = document.getElementById('days');
        const hoursEl = document.getElementById('hours');
        const minutesEl = document.getElementById('minutes');
        const secondsEl = document.getElementById('seconds');
        
        if (daysEl) daysEl.textContent = days.toString().padStart(2, '0');
        if (hoursEl) hoursEl.textContent = hours.toString().padStart(2, '0');
        if (minutesEl) minutesEl.textContent = minutes.toString().padStart(2, '0');
        if (secondsEl) secondsEl.textContent = seconds.toString().padStart(2, '0');
    }
    
    setInterval(updateCountdown, 1000);
    updateCountdown();
}

// Close modals when clicking outside
window.onclick = function(event) {
    const modals = document.getElementsByClassName('modal');
    for (let modal of modals) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }
}

// Make functions globally available
window.showSection = showSection;
window.addToCart = addToCart;
window.showProductDetail = showProductDetail;
window.closeProductModal = closeProductModal;
window.submitReview = submitReview;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.checkout = checkout;
window.filterByCategory = filterByCategory;
window.toggleNotifications = toggleNotifications;
window.markAllAsRead = markAllAsRead;
window.loadProducts = loadProducts;
