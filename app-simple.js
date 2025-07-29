// Simple initialization for debugging
console.log('App.js loading...');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting app...');
    
    // Hide loading spinner
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) {
        loadingSpinner.style.display = 'none';
        console.log('Loading spinner hidden');
    }
    
    // Show login modal
    setTimeout(() => {
        const loginModal = document.getElementById('loginModal');
        if (loginModal && typeof bootstrap !== 'undefined') {
            const modal = new bootstrap.Modal(loginModal);
            modal.show();
            console.log('Login modal shown');
        } else {
            console.error('Bootstrap or login modal not found');
        }
    }, 500);
});

// Simple test login function
function testLogin() {
    console.log('Test login clicked');
    alert('Test login button works! The main app will be restored after debugging.');
}

function showRegisterModal() {
    console.log('Register modal requested');
}

function showLoginModal() {
    console.log('Login modal requested');
}

console.log('App.js loaded successfully');
