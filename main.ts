// The calibration image: two calibrations and two demo drives on the button
// menu. A picks a program, B runs it, any button stops it.

applyFleetSettings()
diffDrive.setupRobot()

diffDrive.addProgram("circle", images.createImage(`
    . # # # .
    # . . . #
    # . . . #
    # . . . #
    . # # # .
    `), driveCircle)
diffDrive.runSignature("circle", "()")

diffDrive.addProgram("square", images.createImage(`
    # # # # #
    # . . . #
    # . . . #
    # . . . #
    # # # # #
    `), driveSquare)
diffDrive.runSignature("square", "()")

diffDrive.addProgram("calwheels", images.createImage(`
    . . # . .
    . # # # .
    . . # . .
    . # # # .
    . . # . .
    `), runCalWheels)
diffDrive.runSignature("calwheels", "(cm:number=90.5, wheel:number=0)")

diffDrive.addProgram("calturn", images.createImage(`
    . # # . #
    # . . # #
    # . . . #
    # . . . #
    . # # # .
    `), runCalTurn)
diffDrive.runSignature("calturn", "(edges:number=10)")

diffDrive.emitLine("boot buttons: A=pick program  B=run it")
