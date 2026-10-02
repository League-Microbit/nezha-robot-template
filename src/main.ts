// A picks a program, B runs it, any button stops it.
diffDrive.setupRobot()

diffDrive.addProgram("circle", SHAPE_CIRCLE, driveCircle)
diffDrive.runSignature("circle", "()")
diffDrive.addProgram("square", SHAPE_SQUARE, driveSquare)
diffDrive.runSignature("square", "()")
diffDrive.addProgram("calwheels", SHAPE_OUT_AND_BACK, runCalWheels)
diffDrive.runSignature("calwheels", "(cm:number=90.5, wheel:number=0)")
diffDrive.addProgram("calturn", SHAPE_SPIN, runCalTurn)
diffDrive.runSignature("calturn", "(edges:number=10)")

diffDrive.emitLine("boot buttons: A=pick program  B=run it")
