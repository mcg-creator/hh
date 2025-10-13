// GamepadManager - Handles all ASUS ROG Ally controller inputs
// Supports: Joysticks, D-pad, ABXY, Shoulders, Triggers, Menu buttons

class GamepadManager {
    constructor() {
        // Button mapping for standard gamepad (Xbox/ROG Ally layout)
        this.BUTTONS = {
            A: 0,           // Bottom face button
            B: 1,           // Right face button
            X: 2,           // Left face button
            Y: 3,           // Top face button
            LB: 4,          // Left shoulder
            RB: 5,          // Right shoulder
            LT: 6,          // Left trigger
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
        };

        // Axis mapping for analog sticks
        this.AXES = {
            LS_X: 0,        // Left stick X axis
            LS_Y: 1,        // Left stick Y axis
            RS_X: 2,        // Right stick X axis
            RS_Y: 3         // Right stick Y axis
        };

        this.deadzone = 0.15;           // Deadzone for analog sticks
        this.triggerThreshold = 0.1;    // Threshold for trigger activation
        this.stickThreshold = 0.5;      // Threshold for stick direction detection

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
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            console.log('🎮 Gamepad disconnected:', e.gamepad.id);
        });
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
        const event = new KeyboardEvent(eventType, {
            key: keyCode,
            code: keyCode,
            bubbles: true,
            cancelable: true
        });
        
        document.dispatchEvent(event);
    }

    // Handle d-pad to arrow key mapping
    handleDirectionToArrowKeys(gamepadIndex = 0) {
        const gamepad = this.currentState.get(gamepadIndex);
        if (!gamepad) return;

        // Check each d-pad direction
        for (const [dpadButton, arrowKey] of Object.entries(this.directionToKeyMap)) {
            const justPressedNow = this.justPressed(dpadButton, gamepadIndex);
            const justReleasedNow = this.justReleased(dpadButton, gamepadIndex);

            if (justPressedNow) {
                console.log(`🎮 D-pad ${dpadButton} pressed, simulating ${arrowKey} keydown`);
                this.simulateKeyboardEvent(arrowKey, 'keydown');
            }

            if (justReleasedNow) {
                console.log(`🎮 D-pad ${dpadButton} released, simulating ${arrowKey} keyup`);
                this.simulateKeyboardEvent(arrowKey, 'keyup');
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
            const keyStateKey = `stick_${direction}`;
            
            if (isActive && !this.simulatedKeys.has(keyStateKey)) {
                console.log(`🎮 Left stick ${direction}, simulating ${arrowKey} keydown`);
                this.simulatedKeys.add(keyStateKey);
                this.simulateKeyboardEvent(arrowKey, 'keydown');
            } else if (!isActive && this.simulatedKeys.has(keyStateKey)) {
                console.log(`🎮 Left stick ${direction} released, simulating ${arrowKey} keyup`);
                this.simulatedKeys.delete(keyStateKey);
                this.simulateKeyboardEvent(arrowKey, 'keyup');
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
            const justReleasedNow = this.justReleased(buttonName, gamepadIndex);

            if (justPressedNow) {
                console.log(`🎮 Button ${buttonName} pressed, simulating keys: ${keyCodes.join(', ')}`);
                // Simulate all mapped keys
                keyCodes.forEach(keyCode => {
                    this.simulateKeyboardEvent(keyCode, 'keydown');
                });
            }

            if (justReleasedNow) {
                console.log(`🎮 Button ${buttonName} released, simulating keys release: ${keyCodes.join(', ')}`);
                // Simulate all mapped keys release
                keyCodes.forEach(keyCode => {
                    this.simulateKeyboardEvent(keyCode, 'keyup');
                });
            }
        }
    }

    // Get the first connected gamepad
    getGamepad(index = 0) {
        const gamepads = navigator.getGamepads();
        return gamepads[index] || null;
    }

    // Check if a button is currently pressed
    isButtonDown(buttonName, gamepadIndex = 0) {
        const gamepad = this.currentState.get(gamepadIndex);
        if (!gamepad) return false;

        const buttonIndex = this.BUTTONS[buttonName];
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

        const buttonIndex = this.BUTTONS[buttonName];
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

        const buttonIndex = this.BUTTONS[buttonName];
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

        let xAxis, yAxis;
        if (stickName === 'LEFT') {
            xAxis = this.AXES.LS_X;
            yAxis = this.AXES.LS_Y;
        } else if (stickName === 'RIGHT') {
            xAxis = this.AXES.RS_X;
            yAxis = this.AXES.RS_Y;
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

        const buttonIndex = this.BUTTONS[triggerName];
        if (buttonIndex === undefined) return 0;

        const button = gamepad.buttons[buttonIndex];
        return button ? button.value : 0;
    }

    // Get all currently pressed buttons
    getPressedButtons(gamepadIndex = 0) {
        const pressed = [];
        for (const [name, index] of Object.entries(this.BUTTONS)) {
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