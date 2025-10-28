// InputManager - Unified input system for keyboard and gamepad
// Provides unified interface for both keyboard and ASUS ROG Ally controller controls

class InputManager {
    constructor() {
        this.keyboard = new KeyboardManager();
        this.gamepad = new GamepadManager();
        this.preferGamepad = false; // Prefer gamepad input when available
        
        // Event system
        this.eventListeners = new Map();
        
        // Timing control for edge detection and repeats
        this.lastInputTime = 0;
        this.currentDirection = null;
        this.isFirstInput = true;
        this.initialDelay = 220; // ms before first repeat
        this.repeatRate = 85; // ms per repeat (≈ 12 Hz)
        
        // New timing properties for simplified system
        this._activeDir = null;
        this._nextRepeatAt = 0;
        this._firstDelay = 220;   // ms
        this._repeatDelay = 85;   // ms
        this._deadzone = 0.32;
        
        // Timing control for edge detection and repeats
        this.lastInputTime = 0;
        this.currentDirection = null;
        this.isFirstInput = true;
        this.initialDelay = 220; // ms before first repeat
        this.repeatRate = 85; // ms per repeat (≈ 12 Hz)
        
        // Debug mode
        this.debugMode = window.location.search.includes('debug');
        this.lastDebugInfo = null;
        
        // Previous input states for edge detection
        this.prevGamepadInputs = new Map();
        this.prevKeyboardInputs = new Map();
        
        // Stick deadzone
        this.stickDeadzone = 0.32;
        
        // Setup debug overlay if enabled
        if (this.debugMode) {
            this.setupDebugOverlay();
        }
    }

    // Event system methods
    on(type, callback) {
        if (!this.eventListeners.has(type)) {
            this.eventListeners.set(type, []);
        }
        this.eventListeners.get(type).push(callback);
    }
    
    emit(type, payload) {
        if (this.eventListeners.has(type)) {
            this.eventListeners.get(type).forEach(callback => callback(payload));
        }
        
        // Update debug info
        if (this.debugMode) {
            this.updateDebugInfo(type, payload);
        }
    }
    
    // Helper method for dominant axis detection
    _getDominantDirFromAxes(ax, ay) {
        const axAbs = Math.abs(ax), ayAbs = Math.abs(ay);
        if (axAbs < this._deadzone && ayAbs < this._deadzone) return null;
        if (axAbs >= ayAbs) return ax > 0 ? 'right' : 'left';
        return ay > 0 ? 'down' : 'up';
    }

    // Update both keyboard and gamepad input systems
    update(ts = performance.now()) {
        this.keyboard.update();
        this.gamepad.update();

        // Prefer gamepad if any connected (auto-switch once detected)
        if (this.gamepad.isConnected()) {
            if (!this.preferGamepad) {
                console.log('[INPUT] switched -> gamepad');
            }
            this.preferGamepad = true;
        }

        // ----- SELECT (A button or keyboard) edge only
        const aPressed = this.preferGamepad ? this.gamepad.justPressed('A') : false;
        const kSelect = this.keyboard.justPressed('SELECT');
        if (aPressed || kSelect) {
            console.log('[INPUT] select');
            this.emit('select', { source: this.preferGamepad ? 'gamepad' : 'keyboard' });
            // optional rumble
            if (this.rumble) {
                this.rumble(0.4, 100).catch(() => {});
            }
        }

        // ----- NAV (D-pad / stick OR arrows)
        let dir = null;

        // Prefer D-pad if pressed
        const dpad = this.gamepad.getDpad?.();
        if (this.preferGamepad && dpad) {
            if (dpad.left) dir = 'left';
            else if (dpad.right) dir = 'right';
            else if (dpad.up) dir = 'up';
            else if (dpad.down) dir = 'down';
        }

        // Else use dominant stick axis
        if (!dir && this.preferGamepad) {
            const { x, y } = this.gamepad.getStick('LEFT') || { x: 0, y: 0 };
            dir = this._getDominantDirFromAxes(x, y);
        }

        // Keyboard fallback
        if (!dir) {
            dir = this.keyboard.getArrowDir?.();
        }

        // Repeat/edge handling
        if (!dir) {
            // reset when neutral
            this._activeDir = null;
            this._nextRepeatAt = 0;
        } else {
            if (this._activeDir !== dir) {
                // new direction edge
                this._activeDir = dir;
                this._nextRepeatAt = ts + this._firstDelay;
                console.log('[INPUT] nav edge ->', dir);
                this.emit('nav', { dir, mode: 'edge' });
            } else if (ts >= this._nextRepeatAt) {
                // held repeat
                this._nextRepeatAt = ts + this._repeatDelay;
                // console.log('[INPUT] nav repeat ->', dir);
                this.emit('nav', { dir, mode: 'repeat' });
            }
        }
    }
    
    // Handle automatic switching between gamepad and keyboard
    handleInputPreference() {
        const gamepadConnected = this.gamepad.isConnected();
        
        // Check for keyboard input to switch away from gamepad
        if (this.preferGamepad && this.hasKeyboardInput()) {
            this.preferGamepad = false;
        } else if (gamepadConnected && !this.preferGamepad && this.hasGamepadInput()) {
            this.preferGamepad = true;
        } else if (gamepadConnected && !this.preferGamepad) {
            this.preferGamepad = true;
        }
    }
    
    // Check if keyboard has any input
    hasKeyboardInput() {
        // Check if any navigation keys are pressed
        return this.keyboard.isButtonDown('UP') || 
               this.keyboard.isButtonDown('DOWN') || 
               this.keyboard.isButtonDown('LEFT') || 
               this.keyboard.isButtonDown('RIGHT') ||
               this.keyboard.isButtonDown('A');
    }
    
    // Check if gamepad has any input
    hasGamepadInput() {
        if (!this.gamepad.isConnected()) return false;
        
        // Check D-pad
        if (this.gamepad.isButtonDown('UP') || 
            this.gamepad.isButtonDown('DOWN') || 
            this.gamepad.isButtonDown('LEFT') || 
            this.gamepad.isButtonDown('RIGHT') ||
            this.gamepad.isButtonDown('A')) {
            return true;
        }
        
        // Check left stick
        const stick = this.gamepad.getStick('LEFT');
        return stick.magnitude > this.stickDeadzone;
    }

    
    // Process navigation inputs with proper timing and edge detection
    processNavigationInputs() {
        const now = Date.now();
        let direction = null;
        let source = null;
        
        // Get direction from active input method
        if (this.preferGamepad && this.gamepad.isConnected()) {
            direction = this.getGamepadDirection();
            source = 'gamepad';
        } else {
            direction = this.getKeyboardDirection();
            source = 'keyboard';
        }
        
        // Handle direction input with timing
        if (direction) {
            // Check if direction changed
            if (direction !== this.currentDirection) {
                this.currentDirection = direction;
                this.lastInputTime = now;
                this.isFirstInput = true;
                
                // Emit navigation event immediately
                this.emit('nav', { dir: direction, source });
                
            } else {
                // Same direction held - check for repeat
                const timeSinceLastInput = now - this.lastInputTime;
                const requiredDelay = this.isFirstInput ? this.initialDelay : this.repeatRate;
                
                if (timeSinceLastInput >= requiredDelay) {
                    this.lastInputTime = now;
                    this.isFirstInput = false;
                    
                    // Emit repeat navigation event
                    this.emit('nav', { dir: direction, source });
                }
            }
        } else {
            // No direction input - reset state
            this.currentDirection = null;
            this.isFirstInput = true;
        }
    }
    
    // Get direction from gamepad with stick + D-pad logic
    getGamepadDirection() {
        // Check D-pad first (higher priority)
        if (this.gamepad.isButtonDown('UP')) return 'up';
        if (this.gamepad.isButtonDown('DOWN')) return 'down';
        if (this.gamepad.isButtonDown('LEFT')) return 'left';
        if (this.gamepad.isButtonDown('RIGHT')) return 'right';
        
        // Check left stick with deadzone and dominant axis
        const stick = this.gamepad.getStick('LEFT');
        if (stick.magnitude > this.stickDeadzone) {
            // Determine dominant axis
            if (Math.abs(stick.x) > Math.abs(stick.y)) {
                return stick.x > 0 ? 'right' : 'left';
            } else {
                return stick.y > 0 ? 'up' : 'down';
            }
        }
        
        return null;
    }
    
    // Get direction from keyboard
    getKeyboardDirection() {
        if (this.keyboard.isButtonDown('UP')) return 'up';
        if (this.keyboard.isButtonDown('DOWN')) return 'down';
        if (this.keyboard.isButtonDown('LEFT')) return 'left';
        if (this.keyboard.isButtonDown('RIGHT')) return 'right';
        return null;
    }
    
    // Process select inputs (A button) - edge detection only
    processSelectInputs() {
        let justPressed = false;
        let source = null;
        
        if (this.preferGamepad && this.gamepad.isConnected()) {
            justPressed = this.gamepad.justPressed('A');
            source = 'gamepad';
        } else {
            justPressed = this.keyboard.justPressed('A');
            source = 'keyboard';
        }
        
        if (justPressed) {
            // Trigger rumble for gamepad
            if (source === 'gamepad') {
                this.rumble(0.4, 100);
            }
            
            this.emit('select', { source });
        }
    }
    
    // Setup debug overlay
    setupDebugOverlay() {
        const debugDiv = document.createElement('div');
        debugDiv.id = 'input-debug';
        debugDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10000;
            border-radius: 5px;
            min-width: 200px;
        `;
        document.body.appendChild(debugDiv);
    }
    
    // Update debug info
    updateDebugInfo(type, payload) {
        const debugDiv = document.getElementById('input-debug');
        if (!debugDiv) return;
        
        const now = new Date().toLocaleTimeString();
        this.lastDebugInfo = {
            type,
            payload,
            timestamp: now
        };
        
        const activeMethod = this.getActiveInputMethod();
        const gamepadConnected = this.gamepad.isConnected();
        
        debugDiv.innerHTML = `
            <strong>Input Debug</strong><br>
            Active: ${activeMethod}<br>
            Gamepad: ${gamepadConnected ? 'Connected' : 'Disconnected'}<br>
            <br>
            Last Event: ${type}<br>
            Direction: ${payload.dir || 'N/A'}<br>
            Source: ${payload.source || 'N/A'}<br>
            Time: ${now}<br>
            <br>
            Current Dir: ${this.currentDirection || 'None'}<br>
            Timing: ${this.isFirstInput ? 'First' : 'Repeat'}
        `;
    }

    
    // Legacy methods for compatibility (now using active input method)
    isButtonDown(buttonName) {
        if (this.preferGamepad && this.gamepad.isConnected()) {
            return this.gamepad.isButtonDown(buttonName);
        }
        return this.keyboard.isButtonDown(buttonName);
    }

    // Check if button was just pressed (gamepad first, then keyboard)
    justPressed(buttonName) {
        if (this.preferGamepad && this.gamepad.isConnected()) {
            return this.gamepad.justPressed(buttonName);
        }
        return this.keyboard.justPressed(buttonName);
    }

    // Check if button was just released (gamepad first, then keyboard)
    justReleased(buttonName) {
        if (this.preferGamepad && this.gamepad.isConnected()) {
            return this.gamepad.justReleased(buttonName);
        }
        return this.keyboard.justReleased(buttonName);
    }

    // Get stick value (gamepad first, then keyboard)
    getStick(stickName) {
        if (this.preferGamepad && this.gamepad.isConnected()) {
            return this.gamepad.getStick(stickName);
        }
        return this.keyboard.getStick(stickName);
    }

    // Get trigger value (gamepad first, then keyboard)
    getTrigger(triggerName) {
        if (this.preferGamepad && this.gamepad.isConnected()) {
            return this.gamepad.getTrigger(triggerName);
        }
        return this.keyboard.getTrigger(triggerName);
    }

    // Get all pressed buttons (gamepad first, then keyboard)
    getPressedButtons() {
        if (this.preferGamepad && this.gamepad.isConnected()) {
            return this.gamepad.getPressedButtons();
        }
        return this.keyboard.getPressedButtons();
    }

    // Rumble (only works with gamepad)
    async rumble(intensity = 0.5, duration = 200) {
        if (this.gamepad.isConnected()) {
            return this.gamepad.rumble(intensity, duration);
        }
        return Promise.resolve();
    }

    // Check if gamepad is connected
    isGamepadConnected() {
        return this.gamepad.isConnected();
    }

    // Get active input method
    getActiveInputMethod() {
        return this.preferGamepad && this.gamepad.isConnected() ? 'gamepad' : 'keyboard';
    }

    // Get keyboard controls info
    getKeyboardControls() {
        return this.keyboard.getKeyboardControls();
    }
}
