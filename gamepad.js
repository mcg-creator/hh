// GamepadManager - Handles all ASUS ROG Ally controller inputs
// Supports: Joysticks, D-pad, ABXY, Shoulders, Triggers, Menu buttons

class GamepadManager {
    constructor() {
        // Default profile mapping for standard gamepads (Xbox-style / ROG Ally)
        this.defaultProfile = {
            BUTTONS: {
                A: 0,           // Bottom face button
                B: 1,           // Right face button
                X: 2,           // Left face button
                Y: 3,           // Top face button
                LB: 4,          // Left shoulder
                RB: 5,          // Right shoulder
                LT: 6,          // Left trigger (index - often analog)
                RT: 7,          // Right trigger
                VIEW: 8,        // View/Back button
                MENU: 9,        // Menu/Start button
                LS: 10,         // Left stick click
                RS: 11,         // Right stick click
                UP: 12,         // D-pad up
                DOWN: 13,       // D-pad down
                LEFT: 14,       // D-pad left
                RIGHT: 15,      // D-pad right
                HOME: 16        // Home/Guide button (if available)
            },

            // Axis mapping for analog sticks
            AXES: {
                LS_X: 0,        // Left stick X axis
                LS_Y: 1,        // Left stick Y axis
                RS_X: 2,        // Right stick X axis
                RS_Y: 3         // Right stick Y axis
            }
        };

        // Per-gamepad profile overrides (keyed by gamepad.index)
        this.perGamepadProfiles = new Map();

    // Sensitivity and thresholds
    this.deadzone = 0.18;           // Deadzone for analog sticks (higher -> less sensitive)
    this.triggerThreshold = 0.12;    // Threshold for trigger activation
    this.stickThreshold = 0.6;      // Threshold for stick direction detection (higher -> requires more movement)

    // Input debouncing to prevent rapid-fire inputs
    this.inputCooldown = 180;       // Milliseconds between inputs (180ms = ~5.5 inputs/second max)
        this.lastInputTime = new Map(); // Track last input time for each direction/button

        // Current and previous gamepad states
        this.currentState = new Map();
        this.previousState = new Map();

        // D-pad and stick to arrow key mapping
        this.directionToKeyMap = {
            'UP': 'ArrowUp',
            'DOWN': 'ArrowDown',
            'LEFT': 'ArrowLeft',
            'RIGHT': 'ArrowRight'
        };

        // Button to key mapping - A button maps to spacebar and 'a' key
        this.buttonToKeyMap = {
            'A': [' ', 'a', 'A']  // A button maps to spacebar and 'a'/'A' keys
        };

        // Track simulated key states to avoid double events
        this.simulatedKeys = new Set();

        // Listen for gamepad connection/disconnection
        window.addEventListener('gamepadconnected', (e) => {
            console.log('🎮 Gamepad connected:', e.gamepad.id);
            // Apply a profile (if recognized) for this device
            try {
                this.applyProfile(e.gamepad);
            } catch (err) {
                console.warn('Error applying profile for connected gamepad:', err);
            }
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            console.log('🎮 Gamepad disconnected:', e.gamepad.id);
            // Remove per-gamepad profile when disconnected
            this.perGamepadProfiles.delete(e.gamepad.index);
        });
    }

    // Detect and apply a profile for a connected gamepad
    applyProfile(gamepad) {
        if (!gamepad) return;
        const id = (gamepad.id || '').toLowerCase();
        const idx = gamepad.index;

        // Default to using the defaultProfile
        let profile = this.defaultProfile;

        // Recognize ASUS ROG Ally devices by id string
        if (/rog ally|asus ally|ally/i.test(gamepad.id)) {
            console.log('🎮 Detected ASUS ROG Ally - applying tuned profile');
            // Use same button layout but tweak thresholds for Ally hardware
            profile = this.defaultProfile;

            // Slightly less sensitive than original aggressive defaults, but still responsive
            this.deadzone = 0.16;          // a bit lower than default deadzone but still avoids jitter
            this.triggerThreshold = 0.10;  // reasonable trigger threshold
            this.stickThreshold = 0.55;    // require moderate stick deflection
            this.inputCooldown = 160;      // slightly faster than default but still debounced
        }

        // Store profile per-index
        this.perGamepadProfiles.set(idx, profile);
        console.log('🎮 Applied profile for gamepad index', idx, 'profile:', profile);
    }

    // Update gamepad state (call this every frame)
    update() {
        this.previousState = new Map(this.currentState);
        this.currentState.clear();

        const gamepads = navigator.getGamepads();
        let gamepadFound = false;
        for (const gamepad of gamepads) {
            if (gamepad) {
                this.currentState.set(gamepad.index, gamepad);
                gamepadFound = true;
            }
        }

        if (gamepadFound) {
            // Handle d-pad to arrow key mapping
            this.handleDirectionToArrowKeys();
            
            // Handle button to key mapping
            this.handleButtonToKeyMapping();
            
            // Handle analog stick to arrow key mapping
            this.handleAnalogStickToArrowKeys();
        }
    }

    // Simulate keyboard events for gamepad inputs
    simulateKeyboardEvent(keyCode, eventType) {
        // Create a more complete keyboard event that matches real keyboard events
        const event = new KeyboardEvent(eventType, {
            key: keyCode,
            code: keyCode === 'ArrowUp' ? 'ArrowUp' : 
                  keyCode === 'ArrowDown' ? 'ArrowDown' :
                  keyCode === 'ArrowLeft' ? 'ArrowLeft' :
                  keyCode === 'ArrowRight' ? 'ArrowRight' :
                  keyCode === ' ' ? 'Space' :
                  keyCode === 'a' ? 'KeyA' :
                  keyCode === 'A' ? 'KeyA' : keyCode,
            keyCode: keyCode === 'ArrowUp' ? 38 : 
                     keyCode === 'ArrowDown' ? 40 :
                     keyCode === 'ArrowLeft' ? 37 :
                     keyCode === 'ArrowRight' ? 39 :
                     keyCode === ' ' ? 32 :
                     keyCode === 'a' || keyCode === 'A' ? 65 : 0,
            which: keyCode === 'ArrowUp' ? 38 : 
                   keyCode === 'ArrowDown' ? 40 :
                   keyCode === 'ArrowLeft' ? 37 :
                   keyCode === 'ArrowRight' ? 39 :
                   keyCode === ' ' ? 32 :
                   keyCode === 'a' || keyCode === 'A' ? 65 : 0,
            bubbles: true,
            cancelable: true
        });
        
        console.log(`🎮 Simulating ${eventType}: ${keyCode}`);
        document.dispatchEvent(event);
    }

    // Check if enough time has passed since last input for this key
    canProcessInput(inputKey) {
        const now = Date.now();
        const lastTime = this.lastInputTime.get(inputKey) || 0;
        const timeDiff = now - lastTime;
        
        if (timeDiff >= this.inputCooldown) {
            this.lastInputTime.set(inputKey, now);
            console.log(`🎮 Input allowed: ${inputKey} (${timeDiff}ms since last)`);
            return true;
        }
        console.log(`🎮 Input blocked: ${inputKey} (${timeDiff}ms < ${this.inputCooldown}ms)`);
        return false;
    }

    // Handle d-pad to arrow key mapping
    handleDirectionToArrowKeys(gamepadIndex = 0) {
        const gamepad = this.currentState.get(gamepadIndex);
        if (!gamepad) return;

        // Check each d-pad direction
        for (const [dpadButton, arrowKey] of Object.entries(this.directionToKeyMap)) {
            const justPressedNow = this.justPressed(dpadButton, gamepadIndex);

            // Use a shared cooldown key for directions to avoid both d-pad and stick triggering the same direction
            const directionKey = `direction_${dpadButton}`;
            if (justPressedNow && this.canProcessInput(directionKey)) {
                console.log(`🎮 D-pad ${dpadButton} pressed, simulating ${arrowKey} keydown`);
                this.simulateKeyboardEvent(arrowKey, 'keydown');
                // Simulate immediate keyup to prevent holding
                setTimeout(() => {
                    this.simulateKeyboardEvent(arrowKey, 'keyup');
                }, 50);
            }
        }
    }

    // Handle analog stick to arrow key mapping
    handleAnalogStickToArrowKeys(gamepadIndex = 0) {
        const gamepad = this.currentState.get(gamepadIndex);
        if (!gamepad) return;

        const leftStick = this.getStick('LEFT', gamepadIndex);
        
        // Check stick directions and map to arrow keys
        const directions = {
            'UP': leftStick.y > this.stickThreshold,
            'DOWN': leftStick.y < -this.stickThreshold,
            'LEFT': leftStick.x < -this.stickThreshold,
            'RIGHT': leftStick.x > this.stickThreshold
        };

        for (const [direction, isActive] of Object.entries(directions)) {
            const arrowKey = this.directionToKeyMap[direction];
            // Use the same shared cooldown key as D-pad so the stick doesn't double-fire navigation
            const keyStateKey = `direction_${direction}`;

            if (isActive && !this.simulatedKeys.has(keyStateKey) && this.canProcessInput(keyStateKey)) {
                console.log(`🎮 Left stick ${direction}, simulating ${arrowKey} keydown`);
                this.simulatedKeys.add(keyStateKey);
                this.simulateKeyboardEvent(arrowKey, 'keydown');
                // Auto-release after short delay to prevent holding
                setTimeout(() => {
                    this.simulatedKeys.delete(keyStateKey);
                    this.simulateKeyboardEvent(arrowKey, 'keyup');
                }, 50);
            }
        }
    }

    // Handle button to key mapping
    handleButtonToKeyMapping(gamepadIndex = 0) {
        const gamepad = this.currentState.get(gamepadIndex);
        if (!gamepad) return;

        // Check each mapped button
        for (const [buttonName, keyCodes] of Object.entries(this.buttonToKeyMap)) {
            const justPressedNow = this.justPressed(buttonName, gamepadIndex);

            if (justPressedNow && this.canProcessInput(`button_${buttonName}`)) {
                console.log(`🎮 Button ${buttonName} pressed, simulating keys: ${keyCodes.join(', ')}`);
                // Simulate all mapped keys
                keyCodes.forEach(keyCode => {
                    this.simulateKeyboardEvent(keyCode, 'keydown');
                });
                // Auto-release after short delay
                setTimeout(() => {
                    keyCodes.forEach(keyCode => {
                        this.simulateKeyboardEvent(keyCode, 'keyup');
                    });
                }, 50);
            }
        }
    }

    // Temporarily disable/enable debouncing for testing
    setDebouncing(enabled) {
        if (enabled) {
            this.inputCooldown = 100; // Re-enable with 100ms
        } else {
            this.inputCooldown = 0; // Disable debouncing
        }
        console.log(`🎮 Debouncing ${enabled ? 'enabled' : 'disabled'}: cooldown=${this.inputCooldown}ms`);
    }

    // Adjust input sensitivity for ROG Ally
    setSensitivity(mode = 'normal') {
        switch(mode) {
            case 'low':
                this.inputCooldown = 150; // Slower response
                this.stickThreshold = 0.7; // Require more stick movement
                break;
            case 'normal':
                this.inputCooldown = 100; // Default
                this.stickThreshold = 0.5; // Default
                break;
            case 'high':
                this.inputCooldown = 50; // Faster response
                this.stickThreshold = 0.3; // Less stick movement needed
                break;
        }
        console.log(`🎮 Sensitivity set to ${mode}: cooldown=${this.inputCooldown}ms, threshold=${this.stickThreshold}`);
    }

    // Debug function to test gamepad detection
    testGamepadDetection() {
        const gamepads = navigator.getGamepads();
        console.log('🎮 Gamepad detection test:');
        console.log('Navigator.getGamepads():', gamepads);
        
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                console.log(`🎮 Gamepad ${i}:`, {
                    id: gamepads[i].id,
                    buttons: gamepads[i].buttons.length,
                    axes: gamepads[i].axes.length,
                    connected: gamepads[i].connected
                });
                
                // Check for any pressed buttons
                for (let j = 0; j < gamepads[i].buttons.length; j++) {
                    if (gamepads[i].buttons[j].pressed) {
                        console.log(`🎮 Button ${j} is currently pressed`);
                    }
                }
            }
        }
        
        if (!gamepads.some(gp => gp && gp.connected)) {
            console.log('⚠️ No gamepads detected. Check:');
            console.log('- ROG Ally is in Gamepad Mode (ROG + X)');
            console.log('- Browser supports Gamepad API');
            console.log('- You clicked on the page first');
        }
    }

    // Get the first connected gamepad
    getGamepad(index = 0) {
        const gamepads = navigator.getGamepads();
        return gamepads[index] || null;
    }

    // Get effective profile (per-gamepad if available, else default)
    getProfileForIndex(gamepadIndex = 0) {
        return this.perGamepadProfiles.get(gamepadIndex) || this.defaultProfile;
    }

    // Check if a button is currently pressed
    isButtonDown(buttonName, gamepadIndex = 0) {
        const gamepad = this.currentState.get(gamepadIndex);
        if (!gamepad) return false;

        const profile = this.getProfileForIndex(gamepadIndex);
        const buttonIndex = profile.BUTTONS[buttonName];
        if (buttonIndex === undefined) return false;

        const button = gamepad.buttons[buttonIndex];
        if (!button) return false;

        // Triggers are analog, use threshold
        if (buttonName === 'LT' || buttonName === 'RT') {
            return button.value >= this.triggerThreshold;
        }

        return button.pressed;
    }

    // Check if a button was just pressed this frame
    justPressed(buttonName, gamepadIndex = 0) {
        const currentGamepad = this.currentState.get(gamepadIndex);
        const previousGamepad = this.previousState.get(gamepadIndex);
        
        if (!currentGamepad) return false;

    const profile = this.getProfileForIndex(gamepadIndex);
    const buttonIndex = profile.BUTTONS[buttonName];
        if (buttonIndex === undefined) return false;

        const currentButton = currentGamepad.buttons[buttonIndex];
        const previousButton = previousGamepad?.buttons[buttonIndex];

        if (!currentButton) return false;

        const isDownNow = buttonName === 'LT' || buttonName === 'RT' 
            ? currentButton.value >= this.triggerThreshold 
            : currentButton.pressed;

        const wasDownBefore = previousButton 
            ? (buttonName === 'LT' || buttonName === 'RT' 
                ? previousButton.value >= this.triggerThreshold 
                : previousButton.pressed)
            : false;

        return isDownNow && !wasDownBefore;
    }

    // Check if a button was just released this frame
    justReleased(buttonName, gamepadIndex = 0) {
        const currentGamepad = this.currentState.get(gamepadIndex);
        const previousGamepad = this.previousState.get(gamepadIndex);
        
        if (!previousGamepad) return false;

    const profile = this.getProfileForIndex(gamepadIndex);
    const buttonIndex = profile.BUTTONS[buttonName];
        if (buttonIndex === undefined) return false;

        const currentButton = currentGamepad?.buttons[buttonIndex];
        const previousButton = previousGamepad.buttons[buttonIndex];

        if (!previousButton) return false;

        const isDownNow = currentButton 
            ? (buttonName === 'LT' || buttonName === 'RT' 
                ? currentButton.value >= this.triggerThreshold 
                : currentButton.pressed)
            : false;

        const wasDownBefore = buttonName === 'LT' || buttonName === 'RT' 
            ? previousButton.value >= this.triggerThreshold 
            : previousButton.pressed;

        return !isDownNow && wasDownBefore;
    }

    // Get analog stick value with deadzone applied
    getStick(stickName, gamepadIndex = 0) {
        const gamepad = this.currentState.get(gamepadIndex);
        if (!gamepad) return { x: 0, y: 0, magnitude: 0 };

        const profile = this.getProfileForIndex(gamepadIndex);
        let xAxis, yAxis;
        if (stickName === 'LEFT') {
            xAxis = profile.AXES.LS_X;
            yAxis = profile.AXES.LS_Y;
        } else if (stickName === 'RIGHT') {
            xAxis = profile.AXES.RS_X;
            yAxis = profile.AXES.RS_Y;
        } else {
            return { x: 0, y: 0, magnitude: 0 };
        }

        let x = gamepad.axes[xAxis] || 0;
        let y = gamepad.axes[yAxis] || 0;

        // Invert Y axis for intuitive up/down
        y = -y;

        // Calculate magnitude
        const magnitude = Math.hypot(x, y);

        // Apply deadzone
        if (magnitude < this.deadzone) {
            return { x: 0, y: 0, magnitude: 0 };
        }

        // Normalize after removing deadzone
        const normalizedMagnitude = Math.min(1, (magnitude - this.deadzone) / (1 - this.deadzone));
        const scale = normalizedMagnitude / magnitude;

        return {
            x: x * scale,
            y: y * scale,
            magnitude: normalizedMagnitude
        };
    }

    // Get trigger value (0.0 to 1.0)
    getTrigger(triggerName, gamepadIndex = 0) {
        const gamepad = this.currentState.get(gamepadIndex);
        if (!gamepad) return 0;

    const profile = this.getProfileForIndex(gamepadIndex);
    const buttonIndex = profile.BUTTONS[triggerName];
        if (buttonIndex === undefined) return 0;

        const button = gamepad.buttons[buttonIndex];
        return button ? button.value : 0;
    }

    // Get all currently pressed buttons
    getPressedButtons(gamepadIndex = 0) {
        const pressed = [];
        const profile = this.getProfileForIndex(gamepadIndex);
        for (const [name] of Object.entries(profile.BUTTONS)) {
            if (this.isButtonDown(name, gamepadIndex)) {
                pressed.push(name);
            }
        }
        return pressed;
    }

    // Controller vibration/rumble (if supported)
    async rumble(intensity = 0.5, duration = 200, gamepadIndex = 0) {
        const gamepad = this.currentState.get(gamepadIndex);
        if (!gamepad || !gamepad.vibrationActuator) return;

        try {
            await gamepad.vibrationActuator.playEffect('dual-rumble', {
                duration: duration,
                strongMagnitude: intensity,
                weakMagnitude: intensity * 0.7
            });
        } catch (error) {
            console.warn('Rumble not supported:', error);
        }
    }

    // Check if any gamepad is connected
    isConnected(gamepadIndex = 0) {
        return this.currentState.has(gamepadIndex);
    }
}