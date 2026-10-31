let minAngle = 0
let maxAngle = 0
let servoOn = 0
input.onSwitchMoved(SwitchDirection.Left, function () {
    pins.A1.servoWrite(120)
    servoOn = 0
    light.showRing(
    `green black black black black black black black black green`
    )
})
input.onSwitchMoved(SwitchDirection.Right, function () {
    pins.A1.servoWrite(120)
    servoOn = 1
    light.showRing(
    `red black black black black black black black black red`
    )
})
input.buttonA.onEvent(ButtonEvent.Click, function () {
    pins.A1.servoWrite(maxAngle)
    light.showRing(
    `green green green black black black black black black black`
    )
})
input.buttonB.onEvent(ButtonEvent.Click, function () {
    pins.A1.servoWrite(minAngle)
    light.showRing(
    `black black black black black black black green green green`
    )
})
servoOn = 0
pins.A1.servoSetPulse(1500)
minAngle = 95
maxAngle = 170
forever(function () {
    if (servoOn == 1) {
        pins.A1.servoWrite(maxAngle)
        light.showRing(
        `red red red black black black black black black black`
        )
        pause(500)
        pins.A1.servoWrite(minAngle)
        light.showRing(
        `black black black black black black black red red red`
        )
        pause(200)
    } else {
    	
    }
})
