// Authentication functions with enhanced features
let authModal = null;
let currentAuthForm = 'login';

function toggleAuthModal() {
    if (!authModal) {
        authModal = document.getElementById('authModal');
    }
    
    if (authModal.style.display === 'block') {
        closeAuthModal();
    } else {
        openAuthModal();
    }
}

function openAuthModal() {
    if (!authModal) {
        authModal = document.getElementById('authModal');
    }
    
    authModal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    
    // Reset forms
    resetAuthForms();
    
    // Show current form
    showAuthForm(currentAuthForm);
    
    // Add escape key listener
    document.addEventListener('keydown', handleEscapeKey);
}

function closeAuthModal() {
    if (authModal) {
        authModal.style.display = 'none';
        document.body.style.overflow = ''; // Re-enable scrolling
    }
    
    // Remove escape key listener
    document.removeEventListener('keydown', handleEscapeKey);
    
    // Reset forms
    resetAuthForms();
}

function handleEscapeKey(event) {
    if (event.key === 'Escape') {
        closeAuthModal();
    }
}

function showAuthForm(formType) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    // Hide all forms
    loginForm.classList.remove('active');
    registerForm.classList.remove('active');
    
    // Show selected form
    if (formType === 'login') {
        loginForm.classList.add('active');
        currentAuthForm = 'login';
    } else {
        registerForm.classList.add('active');
        currentAuthForm = 'register';
    }
    
    // Reset validation states
    resetFormValidation();
}

function resetAuthForms() {
    // Clear all input fields
    const inputs = document.querySelectorAll('#loginForm input, #registerForm input');
    inputs.forEach(input => {
        input.value = '';
        input.classList.remove('error', 'success');
    });
    
    // Clear error messages
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(error => error.remove());
    
    // Reset button states
    const buttons = document.querySelectorAll('.btn-auth');
    buttons.forEach(button => {
        button.disabled = false;
        button.innerHTML = button.getAttribute('data-original-text') || button.innerHTML;
    });
}

function resetFormValidation() {
    const inputs = document.querySelectorAll('.form-input');
    inputs.forEach(input => {
        input.classList.remove('error', 'success');
    });
    
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(error => error.remove());
}

// Enhanced input validation
function setupInputValidation() {
    const inputs = document.querySelectorAll('.form-input');
    
    inputs.forEach(input => {
        // Real-time validation
        input.addEventListener('input', function() {
            validateField(this);
        });
        
        // Focus effects
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
            validateField(this);
        });
    });
}

function validateField(field) {
    const value = field.value.trim();
    const fieldName = field.name || field.id;
    
    // Remove existing error messages
    const existingError = field.parentElement.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    field.classList.remove('error', 'success');
    
    // Skip validation if field is empty
    if (!value) {
        return true;
    }
    
    let isValid = true;
    let errorMessage = '';
    
    switch (fieldName) {
        case 'loginEmail':
        case 'registerEmail':
            isValid = validateEmail(value);
            errorMessage = 'Please enter a valid email address';
            break;
            
        case 'registerPassword':
            isValid = validatePassword(value);
            errorMessage = 'Password must be at least 6 characters with letters and numbers';
            break;
            
        case 'confirmPassword':
            const password = document.getElementById('registerPassword').value;
            isValid = value === password;
            errorMessage = 'Passwords do not match';
            break;
            
        case 'firstName':
        case 'lastName':
            isValid = value.length >= 2;
            errorMessage = 'Name must be at least 2 characters long';
            break;
    }
    
    if (!isValid && value) {
        field.classList.add('error');
        showFieldError(field, errorMessage);
        return false;
    } else if (value) {
        field.classList.add('success');
    }
    
    return isValid;
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    // At least 6 characters, containing letters and numbers
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;
    return passwordRegex.test(password);
}

function showFieldError(field, message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    errorElement.style.cssText = `
        color: var(--error-color);
        font-size: 0.8rem;
        margin-top: 0.5rem;
        font-weight: 500;
    `;
    
    field.parentElement.appendChild(errorElement);
}

// Enhanced login function
async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const loginButton = document.querySelector('#loginForm .btn-auth');
    
    // Validate inputs
    if (!validateAllFields('login')) {
        return;
    }
    
    // Show loading state
    const originalText = loginButton.innerHTML;
    loginButton.innerHTML = '<div class="loading"></div> Signing In...';
    loginButton.disabled = true;
    
    try {
        const data = await apiCall('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        if (data.success) {
            // Success
            currentUser = data.user;
            currentUser.token = data.token;
            localStorage.setItem('freshgrocer_user', JSON.stringify(currentUser));
            
            showToast('Welcome back! Login successful! 🎉', 'success');
            
            // Update UI
            updateUserInterface();
            closeAuthModal();
            loadCart();
            loadNotifications();
            
            // Join user room for real-time notifications
            if (socket) {
                socket.emit('join_user', currentUser.user_id);
            }
            
            // Reset form
            resetAuthForms();
            
        } else {
            // Error
            showToast(data.message || 'Login failed. Please try again.', 'error');
            loginButton.innerHTML = originalText;
            loginButton.disabled = false;
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showToast('Network error. Please check your connection.', 'error');
        loginButton.innerHTML = originalText;
        loginButton.disabled = false;
    }
}

// Enhanced register function
async function register() {
    const firstName = document.getElementById('registerFirstName').value.trim();
    const lastName = document.getElementById('registerLastName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const registerButton = document.querySelector('#registerForm .btn-auth');
    
    // Validate inputs
    if (!validateAllFields('register')) {
        return;
    }
    
    // Check password confirmation
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    // Show loading state
    const originalText = registerButton.innerHTML;
    registerButton.setAttribute('data-original-text', originalText);
    registerButton.innerHTML = '<div class="loading"></div> Creating Account...';
    registerButton.disabled = true;
    
    try {
        const data = await apiCall('/register', {
            method: 'POST',
            body: JSON.stringify({ firstName, lastName, email, password })
        });
        
        if (data.success) {
            // Success
            showToast('Account created successfully! Welcome to FreshGrocer! 🎉', 'success');
            
            // Switch to login form
            showAuthForm('login');
            
            // Pre-fill email in login form
            document.getElementById('loginEmail').value = email;
            
        } else {
            // Error
            showToast(data.message || 'Registration failed. Please try again.', 'error');
        }
        
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Network error. Please check your connection.', 'error');
    } finally {
        // Reset button state
        registerButton.innerHTML = originalText;
        registerButton.disabled = false;
    }
}

function validateAllFields(formType) {
    let isValid = true;
    
    if (formType === 'login') {
        const email = document.getElementById('loginEmail');
        const password = document.getElementById('loginPassword');
        
        if (!email.value.trim()) {
            showFieldError(email, 'Email is required');
            email.classList.add('error');
            isValid = false;
        }
        
        if (!password.value) {
            showFieldError(password, 'Password is required');
            password.classList.add('error');
            isValid = false;
        }
        
    } else if (formType === 'register') {
        const fields = [
            { id: 'registerFirstName', name: 'First Name' },
            { id: 'registerLastName', name: 'Last Name' },
            { id: 'registerEmail', name: 'Email' },
            { id: 'registerPassword', name: 'Password' },
            { id: 'confirmPassword', name: 'Confirm Password' }
        ];
        
        fields.forEach(field => {
            const element = document.getElementById(field.id);
            if (!element.value.trim()) {
                showFieldError(element, `${field.name} is required`);
                element.classList.add('error');
                isValid = false;
            }
        });
    }
    
    return isValid;
}

function logout() {
    // Show confirmation dialog
    if (confirm('Are you sure you want to log out?')) {
        currentUser = null;
        localStorage.removeItem('freshgrocer_user');
        cart = [];
        
        updateUserInterface();
        updateCartUI([]);
        
        showToast('You have been logged out successfully', 'success');
        
        if (socket) {
            socket.disconnect();
            socket = null;
            setupSocket();
        }
        
        // Redirect to home
        showSection('home');
    }
}

function updateUserInterface() {
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const userGreeting = document.getElementById('userGreeting');
    const loginBtn = document.querySelector('.login-btn');
    
    if (currentUser) {
        // User is logged in
        if (authButtons) authButtons.style.display = 'none';
        if (userInfo) userInfo.style.display = 'block';
        if (userGreeting) userGreeting.textContent = `Hi, ${currentUser.first_name}`;
        if (loginBtn) {
            loginBtn.innerHTML = `<i class="fas fa-user"></i> ${currentUser.first_name}`;
            loginBtn.onclick = () => showUserMenu();
        }
    } else {
        // User is not logged in
        if (authButtons) authButtons.style.display = 'block';
        if (userInfo) userInfo.style.display = 'none';
        if (userGreeting) userGreeting.textContent = 'Account';
        if (loginBtn) {
            loginBtn.innerHTML = '<i class="fas fa-user"></i> Login';
            loginBtn.onclick = () => toggleAuthModal();
        }
    }
}

function showUserMenu() {
    // Create or show user dropdown menu
    let userDropdown = document.getElementById('userDropdown');
    
    if (!userDropdown) {
        userDropdown = document.createElement('div');
        userDropdown.id = 'userDropdown';
        userDropdown.className = 'user-dropdown';
        userDropdown.innerHTML = `
            <div class="user-dropdown-content">
                <div class="user-info">
                    <strong>${currentUser.first_name} ${currentUser.last_name}</strong>
                    <span>${currentUser.email}</span>
                </div>
                <div class="dropdown-divider"></div>
                <button onclick="showSection('profile')" class="dropdown-item">
                    <i class="fas fa-user-circle"></i> My Profile
                </button>
                <button onclick="showSection('orders')" class="dropdown-item">
                    <i class="fas fa-shopping-bag"></i> My Orders
                </button>
                <button onclick="logout()" class="dropdown-item logout">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            </div>
        `;
        
        document.querySelector('.user-menu').appendChild(userDropdown);
        
        // Add styles for dropdown
        const style = document.createElement('style');
        style.textContent = `
            .user-dropdown {
                position: absolute;
                top: 100%;
                right: 0;
                background: var(--background-white);
                border-radius: var(--border-radius);
                box-shadow: var(--shadow-xl);
                min-width: 200px;
                z-index: 1001;
                border: 1px solid var(--border-color);
                display: none;
            }
            
            .user-dropdown.show {
                display: block;
                animation: dropdownFadeIn 0.2s ease;
            }
            
            @keyframes dropdownFadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .user-dropdown-content {
                padding: 1rem 0;
            }
            
            .user-info {
                padding: 0 1rem 1rem;
                border-bottom: 1px solid var(--border-light);
                margin-bottom: 0.5rem;
            }
            
            .user-info strong {
                display: block;
                color: var(--text-dark);
                margin-bottom: 0.25rem;
            }
            
            .user-info span {
                color: var(--text-light);
                font-size: 0.8rem;
            }
            
            .dropdown-divider {
                height: 1px;
                background: var(--border-light);
                margin: 0.5rem 0;
            }
            
            .dropdown-item {
                width: 100%;
                padding: 0.75rem 1rem;
                border: none;
                background: none;
                text-align: left;
                cursor: pointer;
                transition: var(--transition);
                color: var(--text-dark);
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .dropdown-item:hover {
                background: var(--background-light);
            }
            
            .dropdown-item.logout {
                color: var(--error-color);
            }
            
            .dropdown-item.logout:hover {
                background: #fef2f2;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Toggle dropdown
    userDropdown.classList.toggle('show');
    
    // Close dropdown when clicking outside
    setTimeout(() => {
        const closeDropdown = (e) => {
            if (!userDropdown.contains(e.target) && !e.target.closest('.user-btn')) {
                userDropdown.classList.remove('show');
                document.removeEventListener('click', closeDropdown);
            }
        };
        document.addEventListener('click', closeDropdown);
    }, 0);
}

// Password visibility toggle
function setupPasswordToggle() {
    const passwordToggles = document.querySelectorAll('.password-toggle');
    
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fas fa-eye-slash';
                this.setAttribute('aria-label', 'Hide password');
            } else {
                input.type = 'password';
                icon.className = 'fas fa-eye';
                this.setAttribute('aria-label', 'Show password');
            }
        });
    });
}

// Auto-login with demo credentials
function autoLoginWithDemo() {
    document.getElementById('loginEmail').value = 'demo@freshgrocer.com';
    document.getElementById('loginPassword').value = 'password123';
    
    // Trigger validation
    validateField(document.getElementById('loginEmail'));
    validateField(document.getElementById('loginPassword'));
    
    showToast('Demo credentials loaded! Click "Sign In" to continue.', 'info');
}

// Initialize authentication system
function initializeAuth() {
    setupInputValidation();
    setupPasswordToggle();
    
    // Close modal when clicking outside
    if (authModal) {
        authModal.addEventListener('click', function(event) {
            if (event.target === authModal) {
                closeAuthModal();
            }
        });
    }
    
    // Check for authentication on page load
    const savedUser = localStorage.getItem('freshgrocer_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            updateUserInterface();
        } catch (error) {
            console.error('Error loading saved user:', error);
            localStorage.removeItem('freshgrocer_user');
        }
    }
}

// Make functions globally available
window.toggleAuthModal = toggleAuthModal;
window.closeAuthModal = closeAuthModal;
window.showAuthForm = showAuthForm;
window.login = login;
window.register = register;
window.logout = logout;
window.autoLoginWithDemo = autoLoginWithDemo;
window.showUserMenu = showUserMenu;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeAuth();
});
