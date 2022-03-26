const cp = require('child_process');
const { clearInterval } = require('timers');
const events = cp.exec('stdbuf -i0 -o0 -e0 libinput debug-events', { maxBuffer: 1024 * 1024 * 1024 });

class EventMapper {
    constructor() {
        this.rightButtonPressed = false;

        this.touchThresholdTimer = null; 
        this.minBeforeTouch = 100;

        this.strategy = {
            KEY_POWER_PRESSED: () => {
                cp.exec(`surface dtx request`);
            },
        };
    }

    xdotool(command) {
        cp.exec(`xdotool ${command}`);
    }

    handleKeyboard(key, state) {
        const fn = this.strategy[`${key}_${state}`.toUpperCase()];

        try {
            fn(state);
        } catch (e) {}
    };

    handleStylus(pressure, isHWButton, pressed) {
 
    }

    touchBoost() {
        cp.exec(`cpupower frequency-info -l`, (err, output) => {
            const [ , data ] = output.split(':').map(it => it.trim());
            const [ currentMin, currentMax ] = data.split(' ').map(it => it / 1000);

            if (currentMin > 1600)
                return;

            console.log(`Boosting from ${currentMin}MHz-${currentMax}MHz to 1600MHz-4200MHz because of touch event.`);

            if (currentMin !== 1600) {
                this.minBeforeTouch = currentMin;
                this.maxBeforeTouch = currentMax;
            }

            cp.exec(`cpupower frequency-set --min 1600MHz --max 4200MHz`);
            clearTimeout(this.touchThresholdTimer);

            this.touchThresholdTimer = setTimeout(() => {
                if (!this.minBeforeTouch)
                    this.minBeforeTouch = 1600;

                if (!this.maxBeforeTouch)
                    this.maxBeforeTouch = 4200;

                console.log(`Deboosting to ${this.minBeforeTouch}MHz-${this.maxBeforeTouch}MHz.`);
                cp.exec(`cpupower frequency-set --min ${this.minBeforeTouch}MHz --max ${this.maxBeforeTouch}MHz`);
            }, 2500);
        });
    }
}

const mapper = new EventMapper();

events.stdout.on('data', (data) => {
    try {
        const [ event, eventData, additional, modifiers ] = data.split('\t').filter(Boolean);
        const [ id, name, time ] = event.trim().split(' ').filter(Boolean);
        
        switch (name) {
            case 'TOUCH_DOWN':
                mapper.touchBoost();

                break;
            case 'KEYBOARD_KEY':
                const [ key,, state ] = eventData.trim().split(' ').filter(Boolean);
                mapper.handleKeyboard(key, state);

                break;
            case 'TABLET_TOOL_PROXIMITY':
                mapper.touchBoost();

                break;
            case 'TABLET_TOOL_AXIS':
                // const [ , pressureString ] = /pressure: (.+)?\*/.exec(modifiers) || [];

                // if (!pressureString)
                //     return;

                // mapper.handleStylus(parseFloat(pressureString), true);    

                break;
            case 'TABLET_TOOL_TIP':
                // mapper.handleStylus(null, false);

                break;
            case 'TABLET_TOOL_BUTTON':
                // if (data.includes('pressed')) {
                //     // mapper.handleStylus(null, true, true);
                // } else if (data.includes('released')) {
                //     // mapper.handleStylus(null, true, false);
                // }

                break;
            default:
                break;
        }
    } catch (e) {}
});
