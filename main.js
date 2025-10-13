// Handheld Controller Boilerplate
// Main JavaScript File - ROG Ally Controller + Keyboard Integration

let inputManager;
let animationFrameId;
let lastInputMethod = null;
let lastButtonState = false;
let navAudio;
let carouselAudio;
let carouselNavAudio;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 ROG Ally Controller Boilerplate initialized');
    console.log('⌨️ Keyboard controls enabled!');
    init();
});

function init() {
    // Create input manager (supports both keyboard and gamepad)
    inputManager = new InputManager();
    
    // Load navigation sound
    navAudio = new Audio('assets/sounds/nav.mp3');
    navAudio.preload = 'auto';
    navAudio.volume = 0.5; // Set volume to 50%
    window.navAudio = navAudio; // Make available globally for lockscreen
    
    // Load carousel transition sound (nav to carousel)
    carouselAudio = new Audio('assets/sounds/carousel.MP3');
    carouselAudio.preload = 'auto';
    carouselAudio.volume = 0.5; // Set volume to 50%
    
    // Load carousel row navigation sound (left/right in carousel)
    carouselNavAudio = new Audio('assets/sounds/carousel_row.MP3');
    carouselNavAudio.preload = 'auto';
    carouselNavAudio.volume = 0.5; // Set volume to 50%
    window.carouselAudio = carouselNavAudio; // Make available globally for lockscreen
    
    // Start update loop
    update();
    
    // Display controls info
    console.log('🎮 ASUS ROG Ally Controller + Keyboard Support Enabled!');
    console.log('📋 Controls:');
    console.log('  🎮 ASUS ROG Ally: D-pad + Left Stick for navigation, A button for selection');
    console.log('  ⌨️ Keyboard: Arrow keys for navigation, A/S/Spacebar for selection');
    console.log('Keyboard Controls:', inputManager.getKeyboardControls());
}

// Setup arrow key event listeners for testing
function setupArrowKeyListeners() {
    document.addEventListener('keydown', (e) => {
        if (e.key.startsWith('Arrow')) {
            console.log(`⌨️ Arrow key detected: ${e.key}`);
            
            // Don't play any sounds here - let the navigation system in HTML handle all audio
            // The HTML navigation system already has the correct audio logic:
            // - Nav bar left/right = nav.mp3
            // - Nav to carousel (down) = carousel2.mp3  
            // - Carousel to nav (up) = nav.mp3
            // - Carousel left/right = carousel.mp3
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key.startsWith('Arrow')) {
            // Visual indicators removed
        }
    });
}

// Main update loop
function update() {
    // Update input state (keyboard and gamepad)
    inputManager.update();
    
    // Debug: Log input method changes
    const inputMethod = inputManager.getActiveInputMethod();
    if (inputMethod !== lastInputMethod) {
        console.log(`🔄 Active input method changed to: ${inputMethod}`);
        if (inputMethod === 'gamepad') {
            console.log('🎮 ASUS ROG Ally controller detected and active!');
        } else {
            console.log('⌨️ Using keyboard input');
        }
        lastInputMethod = inputMethod;
    }
    
    // Handle button presses
    handleInput();
    
    // Continue loop
    animationFrameId = requestAnimationFrame(update);
}

// These UI update functions are no longer needed since we removed the UI elements
function updateConnectionStatus() { }
function updateButtons() { }
function updateTriggers() { }
function updateSticks() { }
function updateActiveButtons() { }

// Handle input events
function handleInput() {
    // Handle main input
    handleMainInput();
}

function handleMainInput() {
    const appContainer = document.getElementById('app-container');
    
    // Check for keyboard key 'A' press for app scaling
    if (inputManager.isButtonDown('A') && !lastButtonState) {
        handleScale();
    }
    
    // Update last button state
    lastButtonState = inputManager.isButtonDown('A');
}

function handleScale() {
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
        const isScaled = appContainer.classList.contains('scaled');
        appContainer.classList.toggle('scaled');
        console.log('Container scaled:', !isScaled);
    } else {
        console.error('App container not found - check HTML structure');
    }
}

// Function to play navigation sound (nav.mp3)
function playNavSound() {
    // Check if SFX is enabled before playing navigation sounds
    if (window.sfxMode && window.sfxMode === 'sfx_off_focus') {
        return; // SFX is off, don't play sound
    }
    
    if (navAudio) {
        navAudio.currentTime = 0; // Reset to beginning
        navAudio.play().catch(error => {
            console.log('Audio play failed:', error);
        });
    }
}

// Function to play carousel transition sound (carousel.mp3 - nav to carousel)
function playCarouselSound() {
    // Check if SFX is enabled before playing carousel sounds
    if (window.sfxMode && window.sfxMode === 'sfx_off_focus') {
        return; // SFX is off, don't play sound
    }
    
    if (carouselAudio) {
        carouselAudio.currentTime = 0; // Reset to beginning
        carouselAudio.play().catch(error => {
            console.log('Carousel audio play failed:', error);
        });
    }
}

// Function to play carousel row navigation sound (carousel_row.mp3 - left/right in carousel)
function playCarouselNavSound() {
    // Check if SFX is enabled before playing carousel navigation sounds
    if (window.sfxMode && window.sfxMode === 'sfx_off_focus') {
        return; // SFX is off, don't play sound
    }
    
    if (carouselNavAudio) {
        carouselNavAudio.currentTime = 0; // Reset to beginning
        carouselNavAudio.play().catch(error => {
            console.log('Carousel navigation audio play failed:', error);
        });
    }
}

// Make sound functions available globally
window.playNavSound = playNavSound;
window.playCarouselSound = playCarouselSound;
window.playCarouselNavSound = playCarouselNavSound;

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
});
