// Handheld Controller Boilerplate
// Main JavaScript File - ROG Ally Controller + Keyboard Integration

let inputManager;
let animationFrameId;
let lastInputMethod = null;
let lastButtonState = false;
let navAudio;
let carouselAudio;
let carouselNavAudio;
let lastTick = 0;
let audioUnlocked = false;
// Track whether focus is currently on top navigation or inside a carousel.
// We infer transitions based on vertical movement (up/down) nav events.
let focusRegion = 'nav'; // 'nav' | 'carousel'
let pendingSounds = []; // queue sounds if fired before unlock
const audioDebug = window.location.search.includes('audiodebug');

// Attempt to unlock audio playback after a user gesture (required by autoplay policies)
function attemptUnlockAudio() {
    if (audioUnlocked) return;
    const audios = [navAudio, carouselAudio, carouselNavAudio].filter(Boolean);
    if (!audios.length) return;
    const playPromises = audios.map(a => {
        const originalVolume = a.volume;
        a.volume = 0; // mute during unlock
        try {
            return a.play().then(() => {
                // Immediately pause and reset so real playback later starts at 0
                a.pause();
                a.currentTime = 0;
                a.volume = originalVolume;
            });
        } catch (err) {
            a.volume = originalVolume;
            return Promise.resolve();
        }
    });
    Promise.all(playPromises).then(() => {
        audioUnlocked = true;
        console.log('[AUDIO] Unlocked via priming');
        flushPendingSounds();
    }).catch(() => {
        // If fails (e.g., only gamepad input), prompt user gently
        console.log('[AUDIO] Unlock attempt failed; press any key or tap once to enable sound');
    });
}

// Focus movement function
function moveFocus(dir) {
    // Call the HTML navigation bridge function
    if (typeof window.handleNavigationInput === 'function') {
        console.log('[FOCUS]', dir);
        window.handleNavigationInput(dir);
    }
}

// Activation function
function activateCurrent() {
    // Call the HTML selection bridge function
    if (typeof window.handleSelectInput === 'function') {
        console.log('[ACTIVATE]');
        window.handleSelectInput();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 ROG Ally Controller Boilerplate initialized');
    console.log('⌨️ Keyboard controls enabled!');
    init();
});

function init() {
    // Create input manager (supports both keyboard and gamepad)
    inputManager = new InputManager();
    
    // SUBSCRIBE to semantic events (critical)
    inputManager.on('nav', e => {
        attemptUnlockAudio(); // ensure audio primed before UI may attempt playback
        handleNavSound(e.dir, e.mode); // play appropriate sound for this navigation
        moveFocus(e.dir);
    });
    inputManager.on('select', () => {
        attemptUnlockAudio();
        activateCurrent();
    });
    
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
    
    // Set up gamepad connection detection with better logging
    window.addEventListener('gamepadconnected', (e) => {
        console.log('🎮 ASUS ROG Ally Gamepad Connected!', e.gamepad.id);
        console.log('🎮 Gamepad mapping:', e.gamepad.mapping);
        console.log('🎮 Number of buttons:', e.gamepad.buttons.length);
        console.log('🎮 Number of axes:', e.gamepad.axes.length);
        
        // Test gamepad immediately on connection
        setTimeout(() => {
            console.log('🎮 Testing gamepad input - try moving sticks or pressing buttons...');
        }, 1000);
    });

    window.addEventListener('gamepaddisconnected', (e) => {
        console.log('🎮 Gamepad Disconnected:', e.gamepad.id);
    });
    
    // Make the app visible by adding the ready class
    setTimeout(() => {
        const app = document.getElementById('app');
        if (app) {
            app.classList.add('ready');
            console.log('✅ Application is now visible');
        }
    }, 100);
    
    // Display controls info
    console.log('🎮 ASUS ROG Ally Controller + Keyboard Support Enabled!');
    console.log('📋 Controls:');
    console.log('  🎮 ASUS ROG Ally: D-pad + Left Stick for navigation, A button for selection');
    console.log('  ⌨️ Keyboard: Arrow keys for navigation, A/S/Spacebar for selection');
    console.log('Keyboard Controls:', inputManager.getKeyboardControls());
    
    // Kick the loop unconditionally
    requestAnimationFrame(tick);

    // Attach user gesture listeners (one-shot) to unlock audio as early as possible
    ['keydown','mousedown','pointerdown','touchstart'].forEach(ev => {
        window.addEventListener(ev, attemptUnlockAudio, { once: true, passive: true });
    });

    // Legacy-inspired immediate priming: attempt a muted play/pause very early
    setTimeout(() => {
        [navAudio, carouselAudio, carouselNavAudio].forEach(a => {
            if (!a) return;
            const originalVol = a.volume;
            a.volume = 0;
            a.play().then(() => {
                a.pause();
                a.currentTime = 0;
                a.volume = originalVol;
            }).catch(() => {
                a.volume = originalVol;
            });
        });
    }, 25); // slight delay to ensure elements created

    // Gamepad-first unlock attempt: poll briefly for first button press if user starts with controller only
    window.addEventListener('gamepadconnected', () => {
        let polls = 0;
        const maxPolls = 240; // ~4s at 60fps
        const pollButtons = () => {
            if (audioUnlocked) return; // already ok
            const gp = navigator.getGamepads()[0];
            if (gp && gp.buttons.some(b => b && b.pressed)) {
                attemptUnlockAudio();
                return;
            }
            if (polls++ < maxPolls) {
                requestAnimationFrame(pollButtons);
            }
        };
        requestAnimationFrame(pollButtons);
    }, { once: true });
}

// Decide and play the proper navigation sound.
// dir: 'left' | 'right' | 'up' | 'down'
// mode: 'edge' | 'repeat'
function handleNavSound(dir, mode) {
    // Only play on edge events to avoid overwhelming audio on repeats
    if (mode !== 'edge') return;

    // Vertical movement may switch focus region
    if (dir === 'down' && focusRegion === 'nav') {
        focusRegion = 'carousel';
        queueOrPlay('carousel');
        return;
    } else if (dir === 'up' && focusRegion === 'carousel') {
        focusRegion = 'nav';
        queueOrPlay('nav');
        return;
    }

    // Horizontal movement inside current region
    if (dir === 'left' || dir === 'right') {
        if (focusRegion === 'nav') queueOrPlay('nav'); else queueOrPlay('carouselRow');
    }
}

function queueOrPlay(type) {
    if (audioUnlocked) {
        playType(type);
    } else {
        pendingSounds.push(type);
        if (audioDebug) console.log('[AUDIO] queued', type, 'pending count=', pendingSounds.length);
    }
}

function playType(type) {
    if (audioDebug) console.log('[AUDIO] play', type);
    if (type === 'nav') playNavSound();
    else if (type === 'carousel') playCarouselSound();
    else if (type === 'carouselRow') playCarouselNavSound();
}

function flushPendingSounds() {
    if (!pendingSounds.length) return;
    if (audioDebug) console.log('[AUDIO] flushing', pendingSounds.length, 'sounds');
    const toPlay = pendingSounds.slice();
    pendingSounds.length = 0;
    toPlay.forEach(playType);
}

// Diagnostics helper
window.audioStatus = function() {
    return {
        unlocked: audioUnlocked,
        focusRegion,
        pendingCount: pendingSounds.length,
        navReady: !!navAudio,
        carouselReady: !!carouselAudio,
        carouselRowReady: !!carouselNavAudio,
        contextState: (window.AudioContext ? (window._sharedCtx && window._sharedCtx.state) : 'n/a')
    };
};

function tick(ts) {
    if (!lastTick || ts - lastTick > 1000) {
        console.log('[LOOP OK] ts=', Math.round(ts));
        lastTick = ts;
    }
    inputManager.update(ts);   // pass timestamp through
    requestAnimationFrame(tick);
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

// Handle input events (legacy for A button scaling)
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
