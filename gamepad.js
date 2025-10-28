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

        // Current and previous gamepad states
        this.pad = null;
        this._prevButtons = [];
        this._justPressed = [];
        this.axes = [];

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
        const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
        this.pad = pads.find(p => p && p.connected) || null;

        if (!this.pad) { 
            this._prevButtons = []; 
            return; 
        }

        // cache buttons
        const btns = this.pad.buttons.map(b => !!b.pressed);
        this._justPressed = btns.map((now, i) => now && !this._prevButtons[i]);
        this._prevButtons = btns;

        // axes
        this.axes = this.pad.axes.slice(0); // [lx, ly, rx, ry]
    }

    isConnected() { 
        return !!this.pad; 
    }
    
    getStick(name) {
        if (!this.pad) return {x:0, y:0};
        const x = this.axes[0] || 0, y = this.axes[1] || 0;
        return name === 'LEFT' ? {x, y} : {x:0, y:0};
    }
    
    getDpad() {
        if (!this.pad) return null;
        const b = this.pad.buttons;
        return { 
            up: !!b[12]?.pressed, 
            down: !!b[13]?.pressed, 
            left: !!b[14]?.pressed, 
            right: !!b[15]?.pressed 
        };
    }
    
    justPressed(name) {
        if (!this.pad) return false;
        const map = { A:0, B:1, X:2, Y:3 };
        const i = map[name];
        return i != null ? !!this._justPressed[i] : false;
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