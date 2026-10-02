// Per-robot wiring and geometry, keyed on the name burned into the micro:bit.
// A calibration stored in flash overrides the wheel and turn values here.

function setGeometry(trackWidth: number, slip: number) {
    diffDrive.setTrackWidth(trackWidth)
    diffDrive.setConfigValue(ConfigField.RotationalSlip, slip)
}

function applyFleetSettings() {
    const name = control.deviceName()
    if (name == "tovez") {
        diffDrive.configureMotor(MotorSide.Left, MotorPort.M2, MotorDirection.Reversed)
        diffDrive.setWheelCalibration(0.7842)
        setGeometry(11.14, 0.998)
    } else if (name == "gopiv") {
        diffDrive.setWheelCalibration(0.786)
        setGeometry(11.36, 0.956)
    } else if (name == "vevov") {
        diffDrive.configureMotor(MotorSide.Left, MotorPort.M1, MotorDirection.Reversed)
        diffDrive.configureMotor(MotorSide.Right, MotorPort.M2, MotorDirection.Forward)
        diffDrive.setWheelCalibration(0.7856)
        setGeometry(11.16, 0.969)
    } else if (name == "tigez") {
        setGeometry(11.44, 0.971)
    }
}
