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
    this._lastPadId = null; // for connection change logging
    this._lastLogTs = 0;    // throttle diagnostic logs

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
        const pads = (navigator.getGamepads && navigator.getGamepads()) ? navigator.getGamepads() : [];
        const connected = Array.from(pads).filter(p => p && p.connected);
        this.pad = connected[0] || null;

        // Basic diagnostics (throttled to ~1/sec) when debug query present
        const debug = window.location.search.includes('debug');
        const now = performance.now();

        if (this.pad) {
            if (this.pad.id !== this._lastPadId) {
                console.log('🎮 [Gamepad] Connected:', this.pad.id, 'Buttons:', this.pad.buttons.length, 'Axes:', this.pad.axes.length);
                this._lastPadId = this.pad.id;
            } else if (debug && now - this._lastLogTs > 1000) {
                // Log a tiny snapshot (first 4 buttons + axes)
                const sampleBtns = this.pad.buttons.slice(0, 6).map((b,i)=> (b.pressed?`#${i}`:'')).filter(Boolean).join(',') || 'none';
                const ax = this.pad.axes.slice(0, 2).map(v=> v.toFixed(2));
                console.log(`🎮 [Gamepad] Poll ok; pressed:[${sampleBtns}] axes:[${ax}]`);
                this._lastLogTs = now;
            }

            // cache buttons
            const btns = this.pad.buttons.map(b => !!b.pressed);
            this._justPressed = btns.map((now, i) => now && !this._prevButtons[i]);
            this._prevButtons = btns;
            // axes
            this.axes = this.pad.axes.slice(0); // [lx, ly, rx, ry]
        } else {
            if (this._lastPadId) {
                console.log('🎮 [Gamepad] Disconnected');
                this._lastPadId = null;
            } else if (debug && now - this._lastLogTs > 1500) {
                console.log('🎮 [Gamepad] No connected pads detected');
                this._lastLogTs = now;
            }
            this._prevButtons = [];
            this._justPressed = [];
            this.axes = [0,0,0,0];
        }
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
        const map = { A:0, B:1, X:2, Y:3, LB:4, RB:5, LT:6, RT:7, VIEW:8, MENU:9 };
        const i = map[name];
        return i != null ? !!this._justPressed[i] : false;
    }
    // Get trigger value (0.0 to 1.0) using simple button value
    getTrigger(triggerName) {
        if (!this.pad) return 0;
        const idx = this.BUTTONS[triggerName];
        if (idx == null) return 0;
        const btn = this.pad.buttons[idx];
        return btn ? (btn.value !== undefined ? btn.value : (btn.pressed ? 1 : 0)) : 0;
    }

    // Get all currently pressed buttons (simple snapshot)
    getPressedButtons() {
        if (!this.pad) return [];
        const pressed = [];
        for (const [name, idx] of Object.entries(this.BUTTONS)) {
            const b = this.pad.buttons[idx];
            if (b && (b.pressed || (b.value && b.value > this.triggerThreshold))) {
                pressed.push(name);
            }
        }
        return pressed;
    }

    // Controller vibration/rumble (if supported)
    async rumble(intensity = 0.5, duration = 200) {
        if (!this.pad || !this.pad.vibrationActuator) return;
        try {
            await this.pad.vibrationActuator.playEffect('dual-rumble', {
                duration: duration,
                strongMagnitude: intensity,
                weakMagnitude: intensity * 0.7
            });
        } catch (err) {
            // Fail silently; not all browsers support
        }
    }
}