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

// Enable audio debugging by adding ?audiodebug to URL
if (audioDebug) {
    console.log('[AUDIO DEBUG] 🔊 Audio debugging enabled');
}

// Attempt to unlock audio playback after a user gesture (required by autoplay policies)
function attemptUnlockAudio() {
    if (audioUnlocked) return;
    const audios = [navAudio, carouselAudio, carouselNavAudio].filter(Boolean);
    if (!audios.length) return;
    
    console.log('[AUDIO] Attempting to unlock audio context...');
    
    const playPromises = audios.map(a => {
        const originalVolume = a.volume;
        console.log(`[AUDIO] Unlocking ${a.src.split('/').pop()}, original volume: ${originalVolume}`);
        a.volume = 0; // mute during unlock
        try {
            return a.play().then(() => {
                // Immediately pause and reset so real playback later starts at 0
                a.pause();
                a.currentTime = 0;
                a.volume = originalVolume; // RESTORE original volume
                console.log(`[AUDIO] Successfully unlocked ${a.src.split('/').pop()}, volume restored to: ${a.volume}`);
            });
        } catch (err) {
            a.volume = originalVolume; // RESTORE original volume on error too
            console.log('[AUDIO] Audio unlock failed for', a.src, err);
            return Promise.resolve();
        }
    });
    
    Promise.all(playPromises).then(() => {
        audioUnlocked = true;
        console.log('[AUDIO] ✅ Audio unlocked successfully via priming');
        
        // Verify volumes are correct
        console.log('[AUDIO] Final volumes:', {
            nav: navAudio?.volume,
            carousel: carouselAudio?.volume,
            carouselRow: carouselNavAudio?.volume
        });
        
        // Also check if AudioContext is available and create one
        if (window.AudioContext || window.webkitAudioContext) {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                const ctx = new AudioCtx();
                if (ctx.state === 'suspended') {
                    ctx.resume().then(() => {
                        console.log('[AUDIO] ✅ AudioContext resumed');
                    });
                }
                window._audioContext = ctx;
            } catch (e) {
                console.log('[AUDIO] ⚠️ AudioContext creation failed:', e);
            }
        }
        
        flushPendingSounds();
    }).catch(() => {
        // If fails (e.g., only gamepad input), prompt user gently
        console.log('[AUDIO] ⚠️ Unlock attempt failed; press any key or tap once to enable sound');
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
        console.log('[INPUT] Navigation event received:', e);
        attemptUnlockAudio(); // ensure audio primed before UI may attempt playback
        handleNavSound(e.dir, e.mode); // play appropriate sound for this navigation
        moveFocus(e.dir);
    });
    inputManager.on('select', () => {
        console.log('[INPUT] Select event received');
        attemptUnlockAudio();
        activateCurrent();
    });
    
    // Load navigation sound
    navAudio = new Audio('assets/sounds/nav.mp3');
    navAudio.preload = 'auto';
    navAudio.volume = 0.5; // Set volume to 50%
    navAudio.addEventListener('loadeddata', () => {
        console.log('[AUDIO] ✅ Nav audio loaded, volume set to:', navAudio.volume);
    });
    navAudio.addEventListener('error', (e) => console.log('[AUDIO] ❌ Nav audio error:', e));
    window.navAudio = navAudio; // Make available globally for lockscreen
    
    // Load carousel transition sound (nav to carousel)
    carouselAudio = new Audio('assets/sounds/carousel.MP3');
    carouselAudio.preload = 'auto';
    carouselAudio.volume = 0.5; // Set volume to 50%
    carouselAudio.addEventListener('loadeddata', () => {
        console.log('[AUDIO] ✅ Carousel audio loaded, volume set to:', carouselAudio.volume);
    });
    carouselAudio.addEventListener('error', (e) => console.log('[AUDIO] ❌ Carousel audio error:', e));
    
    // Load carousel row navigation sound (left/right in carousel)
    carouselNavAudio = new Audio('assets/sounds/carousel_row.MP3');
    carouselNavAudio.preload = 'auto';
    carouselNavAudio.volume = 0.5; // Set volume to 50%
    carouselNavAudio.addEventListener('loadeddata', () => {
        console.log('[AUDIO] ✅ Carousel nav audio loaded, volume set to:', carouselNavAudio.volume);
    });
    carouselNavAudio.addEventListener('error', (e) => console.log('[AUDIO] ❌ Carousel nav audio error:', e));
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
    ['keydown','mousedown','pointerdown','touchstart','click','focus'].forEach(ev => {
        window.addEventListener(ev, attemptUnlockAudio, { once: true, passive: true });
    });

    // Also try to unlock when tab becomes visible
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !audioUnlocked) {
            console.log('[AUDIO] Tab visible, attempting unlock...');
            attemptUnlockAudio();
        }
    });

    // Legacy-inspired immediate priming: attempt a muted play/pause very early
    setTimeout(() => {
        console.log('[AUDIO] Initial audio priming...');
        [navAudio, carouselAudio, carouselNavAudio].forEach(a => {
            if (!a) return;
            const originalVol = a.volume;
            a.volume = 0;
            a.play().then(() => {
                a.pause();
                a.currentTime = 0;
                a.volume = originalVol;
                console.log('[AUDIO] Primed:', a.src);
            }).catch(() => {
                a.volume = originalVol;
                console.log('[AUDIO] Prime failed for:', a.src);
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
    console.log(`[AUDIO] handleNavSound called: dir=${dir}, mode=${mode}, focusRegion=${focusRegion}`);
    
    // Only play on edge events to avoid overwhelming audio on repeats
    if (mode !== 'edge') {
        console.log('[AUDIO] Skipping repeat event');
        return;
    }

    // Use a small delay to let the HTML navigation system update first
    setTimeout(() => {
        // Check the navigation focus AFTER the HTML has processed the navigation
        const htmlNavigationFocus = window.navigationFocus || 'nav';
        console.log(`[AUDIO] Post-navigation HTML focus: ${htmlNavigationFocus}, previous: ${focusRegion}`);
        console.log(`[AUDIO DEBUG] Raw window.navigationFocus:`, window.navigationFocus);
        console.log(`[AUDIO DEBUG] Type of navigationFocus:`, typeof window.navigationFocus);

        // Detect actual transitions and movements
        if (focusRegion === 'nav' && htmlNavigationFocus === 'carousel') {
            // Transitioned from nav to carousel - play carousel transition sound
            console.log('[AUDIO] Detected transition: nav → carousel');
            queueOrPlay('carousel');
        } else if (focusRegion === 'carousel' && htmlNavigationFocus === 'nav') {
            // Transitioned from carousel to nav - play nav sound
            console.log('[AUDIO] Detected transition: carousel → nav');
            queueOrPlay('nav');
        } else if (htmlNavigationFocus === 'nav') {
            // Movement within nav bar - play nav sound
            console.log('[AUDIO] Movement within nav bar');
            queueOrPlay('nav');
        } else if (htmlNavigationFocus === 'carousel') {
            // Movement within carousel - play carousel row sound
            console.log('[AUDIO] Movement within carousel');
            queueOrPlay('carouselRow');
        }
        
        // Update our tracking
        focusRegion = htmlNavigationFocus;
    }, 50); // Increased delay to let HTML navigation process first
}

function queueOrPlay(type) {
    console.log(`[AUDIO] queueOrPlay called: type=${type}, audioUnlocked=${audioUnlocked}`);
    if (audioUnlocked) {
        playType(type);
    } else {
        pendingSounds.push(type);
        if (audioDebug) console.log('[AUDIO] queued', type, 'pending count=', pendingSounds.length);
    }
}

function playType(type) {
    console.log(`[AUDIO] playType called: type=${type}`);
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
        contextState: (window.AudioContext ? (window._audioContext && window._audioContext.state) : 'n/a'),
        sfxMode: window.sfxMode,
        volumes: {
            nav: navAudio?.volume,
            carousel: carouselAudio?.volume,
            carouselRow: carouselNavAudio?.volume
        }
    };
};

// Debug audio test function
window.testAllSounds = function() {
    console.log('[AUDIO TEST] Testing all sounds...');
    console.log('[AUDIO TEST] Audio status:', window.audioStatus());
    
    // Force unlock if needed
    if (!audioUnlocked) {
        console.log('[AUDIO TEST] Force unlocking audio...');
        attemptUnlockAudio();
    }
    
    setTimeout(() => {
        console.log('[AUDIO TEST] Playing nav sound...');
        playNavSound();
    }, 100);
    
    setTimeout(() => {
        console.log('[AUDIO TEST] Playing carousel sound...');
        playCarouselSound();
    }, 600);
    
    setTimeout(() => {
        console.log('[AUDIO TEST] Playing carousel nav sound...');
        playCarouselNavSound();
    }, 1100);
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
        console.log('[AUDIO] SFX disabled, skipping nav sound');
        return; // SFX is off, don't play sound
    }
    
    // Ensure volume is correct before playing
    if (navAudio && navAudio.volume === 0) {
        navAudio.volume = 0.5;
        console.log('[AUDIO] ⚠️ Nav audio volume was 0, restored to 0.5');
    }
    
    console.log('[AUDIO] Playing nav sound, volume:', navAudio?.volume);
    if (navAudio) {
        navAudio.currentTime = 0; // Reset to beginning
        navAudio.play().then(() => {
            console.log('[AUDIO] Nav sound played successfully');
        }).catch(error => {
            console.log('[AUDIO] Nav audio play failed:', error);
        });
    } else {
        console.log('[AUDIO] Nav audio object not available');
    }
}

// Function to play carousel transition sound (carousel.mp3 - nav to carousel)
function playCarouselSound() {
    // Check if SFX is enabled before playing carousel sounds
    if (window.sfxMode && window.sfxMode === 'sfx_off_focus') {
        console.log('[AUDIO] SFX disabled, skipping carousel sound');
        return; // SFX is off, don't play sound
    }
    
    // Ensure volume is correct before playing
    if (carouselAudio && carouselAudio.volume === 0) {
        carouselAudio.volume = 0.5;
        console.log('[AUDIO] ⚠️ Carousel audio volume was 0, restored to 0.5');
    }
    
    console.log('[AUDIO] Playing carousel sound, volume:', carouselAudio?.volume);
    if (carouselAudio) {
        carouselAudio.currentTime = 0; // Reset to beginning
        carouselAudio.play().then(() => {
            console.log('[AUDIO] Carousel sound played successfully');
        }).catch(error => {
            console.log('[AUDIO] Carousel audio play failed:', error);
        });
    } else {
        console.log('[AUDIO] Carousel audio object not available');
    }
}

// Function to play carousel row navigation sound (carousel_row.mp3 - left/right in carousel)
function playCarouselNavSound() {
    // Check if SFX is enabled before playing carousel navigation sounds
    if (window.sfxMode && window.sfxMode === 'sfx_off_focus') {
        console.log('[AUDIO] SFX disabled, skipping carousel nav sound');
        return; // SFX is off, don't play sound
    }
    
    // Ensure volume is correct before playing
    if (carouselNavAudio && carouselNavAudio.volume === 0) {
        carouselNavAudio.volume = 0.5;
        console.log('[AUDIO] ⚠️ Carousel nav audio volume was 0, restored to 0.5');
    }
    
    console.log('[AUDIO] Playing carousel nav sound, volume:', carouselNavAudio?.volume);
    if (carouselNavAudio) {
        carouselNavAudio.currentTime = 0; // Reset to beginning
        carouselNavAudio.play().then(() => {
            console.log('[AUDIO] Carousel nav sound played successfully');
        }).catch(error => {
            console.log('[AUDIO] Carousel nav audio play failed:', error);
        });
    } else {
        console.log('[AUDIO] Carousel nav audio object not available');
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
