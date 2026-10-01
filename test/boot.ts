// boot.ts — bring the wire up and say what this hex can run.
//
// LISTED LAST in pxt.json, deliberately. PXT executes top-level code in
// manifest order, so everything above has finished registering its verbs and
// its menu entries by the time the radio starts carrying commands. Opening
// the link first would leave a window -- small, but real on a robot power-
// cycled while the relay is already sending -- where a RUN: arrives with no
// handler bound to answer it.
//
// That same order is the MENU order, because harness.ts appends each entry as
// the file registering it runs:  diamond (square), snake (line), target
// (sense), then back to the heart.
//
// setupRadio() takes the radio over: MakeCode's own `radio send` /
// `on radio received` blocks stop working in the same program from here on,
// and it cannot be undone without a restart.
//
// Every robot has its OWN radio address, derived from the name burned into
// its chip -- there is no shared fleet channel. (This line once hardcoded
// 55/114, tigez's old address, so every board running this image answered
// on tigez's channel and a relay could not reach one robot alone.)
// To reach one robot, point a relay at it by name: `!N <name>`.
//
// [channel, group] derived from a micro:bit's five-letter name, or [] if the
// name is not one. NORMATIVE SPEC: radio-robot-lib
// docs/design/radio-addressing.md -- the name is DEVICEID[1] in base 5
// (consonants zvgpt at positions 0/2/4, vowels uoiea at 1/3, first letter
// most significant), then channel = 11 + n % 73 (11..83) and
// group = 15 + n % 241 (15..255). The relay's `!N`, mbrelay's registry and
// robot-console compute the same pair, so change it only with the spec.
// (Until 2026-09-14 this was the retired 25-channel map, 25 + 2*(n % 25).)
function nameValue(name: string): number {
    const consonants = "zvgpt"
    const vowels = "uoiea"
    if (name.length != 5) return -1
    let n = 0
    for (let i = 0; i < 5; i++) {
        const alphabet = i % 2 == 0 ? consonants : vowels
        const digit = alphabet.indexOf(name.charAt(i).toLowerCase())
        if (digit < 0) return -1
        n = n * 5 + digit
    }
    return n
}

function radioAddressFromName(name: string): number[] {
    const n = nameValue(name)
    if (n < 0) return []
    return [11 + n % 73, 15 + n % 241]
}

const RADIO_ADDRESS = radioAddressFromName(control.deviceName())
if (RADIO_ADDRESS.length == 2) {
    diffDrive.setupRadio(RADIO_ADDRESS[0], RADIO_ADDRESS[1])
}
// No derivable address leaves the radio to MakeCode rather than guessing one:
// a guessed channel is exactly how the whole fleet ended up sharing one.

// Motor wiring, per robot. The extension's default is left on M1, right on
// M2 -- correct for tigez and the rest of the fleet. tovez is wired
// mirror-image (left on M2, right on M1) and drives backwards on the
// default. Naming the port the other wheel is on swaps the pair, so one
// line fixes it.
//
// Keyed on control.deviceName(), the name burned into the chip, so this
// hex is safe on every board: applied unconditionally it mirror-wired
// tigez, whose correct wiring IS the default.
// MEASURED tovez 2026-09-12: raw encoder delta reverses with the sign
// (pxt-nezha-diffdrive captures/configmotor-hardware-20260912/notes.md).
if (control.deviceName() == "tovez") {
    diffDrive.configureMotor(MotorSide.Left, MotorPort.M2, MotorDirection.Reversed)
    // Wheel travel per shaft degree, MEASURED on tovez 2026-09-15 by cald:
    // one continuous run across the two vertical tape lines, 31.49 cm of
    // odometry against a camera-surveyed 31.35 cm gap (1.4 mm, 0.45% out).
    // Each crossing is the mean over the four channels of (near edge + far
    // edge)/2, which cancels the skew and the sensor's trigger lag. Implies a
    // wheel diameter of 89.86 mm, from the 0.7878 compiled default.
    // Set here rather than left in RAM so it survives a reset.
    diffDrive.setWheelCalibration(0.7842)
    // Effective track width, b = trackWidth / rotationalSlip
    // (motion/motion_engine.h). A rotation's wheel-travel target is
    // PROPORTIONAL to b (motion_engine.cpp:218,
    // yawTarget = rotation * 0.5 * effectiveTrackWidth() * cpm), so too big a b
    // over-rotates and too small a b makes the move finish instantly without
    // turning at all.
    //
    // MEASURED on tovez 2026-09-15 with the overhead camera, two operating
    // points, both over-rotating:
    //   b = 120.0 mm (compiled 114.2/0.952): 360 commanded -> 386.65 actual,
    //       mean of six alternating revolutions, equal both ways
    //       (CCW +25.1/+25.7/+27.3, CW -27.3/-27.0/-27.5 deg). Ratio 1.0740.
    //   b = 128.9 mm (114.2/0.886): 90 -> 105.9, -90 -> -105.3, 180 -> 206.8,
    //       360 -> 420.5. Mean ratio 1.1658.
    // Each gives a true b independently: 120.0/1.0740 = 111.7 mm and
    // 128.9/1.1658 = 110.6 mm -- agreeing to 1%. Take b = 111.1 mm, so
    // slip = 114.2/111.1 = 1.028.
    //
    // A slip above 1 is not a mistake here: it only says the robot rotates as
    // though it were NARROWER than the caliper track width.
    //
    // VERIFIED at this value, on PARTIAL turns (a whole revolution cannot tell
    // a perfect turn from no turn at all): +90 -> +90.40, -90 -> -90.57,
    // +180 -> +181.64, -180 -> -180.18, +360 -> +359.15. Mean ratio 1.0037,
    // i.e. 0.37%, correct both ways and at every magnitude.
    //
    // Set here, not left in RAM: this board was power-cycled mid-session and
    // came back on the compiled defaults with the wire-SET value gone.
    //
    // setTrackWidth() is called EXPLICITLY, not left to the compiled 114.2
    // default it happens to equal. A rotation through move(0, yaw) needs the
    // geometry actually set; relying on the default left `turn 90`/`turn 180`
    // returning instantly without moving (5-6 control cycles, camera confirms
    // 0.3 deg) while whole revolutions still ran. calibrateTurn() in
    // test/calibratel.ts sets it at the top of every round for this reason.
    // CALIPER track width, 111.4 mm (Eric, 2026-09-17), replacing the compiled
    // 114.2 this line used to carry -- see the same note in gopiv's block. tovez
    // is genuinely the narrowest robot in the fleet, so on the old 114.2 anchor
    // its slip had to exceed 1.0 to compensate, and a slip above 1 is REFUSED
    // over the wire: validateCandidate() in config_commands.cpp allows only
    // {0} u [0.5, 1.0], and the 1.028 below survived solely because the baked
    // boot path skips validation. On the caliper width the honest value is
    // 0.998, which is legal -- so tovez's geometry can now be loaded with a
    // wire SET like every other robot's, instead of only by reflashing.
    applyGeometry(11.14, 0.998)   // records the pair -- see geometry.ts
    //
    // calt (test/calibratel.ts) could NOT have found this. It accepts at
    // CALT_TOL = 2 deg, and this robot's heading moves 1.5-11 deg per move on
    // its own (tail dragger, MEASURED same session) -- its tolerance sits
    // inside its own noise, so it would have converged on whatever the line
    // happened to read. Six camera-truthed revolutions measure the same
    // quantity directly and repeat to +-1 deg.
    //
    // calibrateTurn()'s own correction, bNext = b * deg/trueDeg, is CORRECT --
    // it lands on 119.96 * 360/386.65 = 111.7 mm, the same answer as above. An
    // earlier comment here claimed it was inverted; that was wrong, and came
    // from a bad calibration run (see the capture log) that had set b to
    // 0.13 mm and stopped the robot turning at all.
    // MEASURED 2026-09-17 by calc on the alternating iron cross, five runs at
    // 70 deg/s: b = 11.190, 11.163, 11.137, 11.127, 11.197 cm, mean 11.163,
    // sd 0.031 (0.28%, standard error 0.12%). So slip = 11.14/11.163 = 0.998.
    //
    // This SUPERSEDES the 1.028 above, which on the old 11.42 anchor meant
    // b = 11.109 -- 0.49% narrower. Both are camera-era numbers and the gap is
    // small; calc wins because it does not assume a fixed centre of rotation,
    // and tovez walks 1-1.5 cm per revolution (measured by tag 52 this session),
    // which is exactly the assumption the six-revolution camera method rested on.
    //
    // THE CAVEAT, because it is not resolved: calc spins at ~73 mm/s per wheel
    // and the camera turn calibrations that produced 1.028 and the JSON's 1.018
    // ran at 60-188 mm/s. tigez's own config note records that this residual IS
    // speed dependent, so these may not be quite the same quantity. The three
    // values span 1%, which is the size of that effect, not a contradiction.
    //
    // 0.998 is remarkable on its own terms: tovez rotates as though it were
    // almost exactly as wide as the calipers say, i.e. it barely scrubs, where
    // gopiv needs 4.6% more wheel travel than geometry predicts and tigez 3.0%.
    // Eric's explanation (2026-09-17) fits the ordering: tovez carries its
    // wheels in the MIDDLE with a caster at each end, so each caster takes
    // little weight; tigez has one caster on a short arm and is well balanced
    // over the wheels; gopiv and vevov have a long lever to a single trailing
    // caster, loading it hardest. More weight on a caster, more scrub.
    // (slip 0.998 applied by applyGeometry above)
}

if (control.deviceName() == "gopiv") {
    // Wheel travel per shaft degree, MEASURED on gopiv 2026-09-16 by calj:
    // twelve straddled runs of the eye field, mean odometry 90.41 cm against a
    // TAPE-MEASURED 90.2 cm line spacing (sd 0.25 cm, 0.28%; standard error of
    // the mean 0.08%). The robot over-measures by 0.23%, so the compiled 0.7878
    // default is that much too large: 0.7878 * 90.2/90.41 = 0.786, implying a
    // wheel diameter of 90.07 mm against the default's 90.28 mm. At 2.9x the
    // standard error this is a real offset, and it is 4 mm over a 2 m drive.
    //
    // THE LINE SPACING MUST COME FROM A TAPE. It is the one length the whole
    // calibration scales by. The overhead camera called it 90.57 cm -- out by
    // 0.41%, which is larger than the entire 0.28% run-to-run spread, and it
    // turned this correction into "no correction needed" for most of the
    // session (captures/calibratej-gopiv-20260916/bench-log.md).
    diffDrive.setWheelCalibration(0.786)
    // Effective track width, MEASURED on gopiv 2026-09-16 by calt (Calibrate T,
    // test/calibratet.ts), which defines 180 degrees from the TAPE rather than
    // from the odometry being calibrated: pivoting on the stripe edge, the four
    // channels go dark in sequence and the midpoint of a symmetric pair IS 180.
    //
    // Six CCW/CW pairs, all from starts that line-followed 35cm and held the
    // steering deadband before pivoting: mean 179.18 deg for a true 180. The
    // three best-settled (60-85 ticks in deadband) agree to +-0.08 deg and give
    // 179.04. So b = 12.0 * 179.04/180 = 11.93 cm, slip = 11.42/11.93 = 0.957,
    // a 0.53% correction from the compiled default.
    //
    // PAIRING IS NOT OPTIONAL. A single pivot carries the robot's unknown
    // heading error at the moment it starts, which adds to CCW and subtracts
    // from CW; the within-pair splits were 6.29/2.72/3.40/1.75 deg and that IS
    // that error, doubled. The pair mean cancels it. Individual pivots scattered
    // across 161-186 deg before pairing and settling were enforced.
    // TRACK WIDTH IS THE CALIPER MEASUREMENT, 113.6 mm (Eric, 2026-09-17), not
    // the compiled 114.2 default this line used to carry. A spin measures only
    // the EFFECTIVE track b = trackWidth/slip, so any (trackWidth, slip) pair
    // with the right ratio drives identically -- but only the caliper pair
    // means anything physically, and only it can be compared against
    // radio-robot-lib's config/robots/gopiv.json, which has always stored the
    // caliper value. Keeping 11.42 here forced a different slip for the same
    // robot in the two files, which read like a disagreement and was not one.
    applyGeometry(11.36, 0.956)   // records the pair -- see geometry.ts
    // REFINED 2026-09-17 by calc (Calibrate C, test/calibratec.ts) on the
    // alternating iron cross: b = 11.879 cm, so slip = 11.36/11.879 = 0.9563,
    // a 0.45% correction to the 0.957 calt gave. (On the old 11.42 anchor the
    // same b was slip 0.9613; the ratio, and so the robot's behaviour, is
    // unchanged by this rewrite.)
    //
    // Three runs at 70 deg/s: 11.869, 11.899, 11.870 -- sd 0.017 cm (0.14%).
    // Five earlier runs at 30 deg/s spread 11.628..11.835, sd 0.093 (0.79%),
    // and their MEAN was 1.3% lower. That gap is a bias, not scatter: below
    // ~60 deg/s the reversing wheel does not break away (see calibratec.ts's
    // CC_SPIN note), the robot arcs about the stalled wheel instead of
    // pivoting, and a stalled wheel inflates (dRight - dLeft) for a given real
    // rotation. Averaging those runs could never have found it.
    //
    // WHY THIS IS TRUSTWORTHY WHERE THE EARLIER NUMBERS WERE NOT: calt measured
    // 11.93 from stripe-edge entry angles on 180 deg pivots, calc measures
    // 11.879 from radial sector crossings. The two share no assumptions -- calc
    // does not involve the lever arm at all, and its eight sectors sum to 360
    // whatever the centring -- and they now agree to 0.43%, against 1.5% when
    // calc ran too slowly. Independent methods converging is the evidence here;
    // neither number alone was.
    // 0.956, not 0.9563: setConfigValue stores Math.round(value*1000), so three
    // decimals is all the firmware can hold. That rounding moves b by 0.03%,
    // against a 0.14% run-to-run spread -- below the noise, and written out at
    // the value that will actually survive rather than one that silently won't.
    // (slip 0.956 applied by applyGeometry above)
}

if (control.deviceName() == "vevov") {
    // WIRING. vevov is NOT wired like the rest of the fleet, and the
    // calibration image's default (left M1, right M2, both forward) drives it
    // MIRRORED -- every steering correction lands on the wrong wheel, in the
    // wrong direction. radio-robot-lib's config/robots/vevov.json is explicit:
    //     left_port = 2   right_port = 1
    //     fwd_sign_left = 1   fwd_sign_right = -1
    // so left is on M2, right is on M1, and the RIGHT motor runs reversed.
    //
    // Naming the port the other wheel is on swaps the pair (configureMotor's
    // own doc), so the first line alone moves left to M2 and right to M1. The
    // second line then only sets the right-hand direction, because right is
    // already on M1 by then.
    // THESE TWO LINES MATCH THE EXTENSION'S COMPILED DEFAULT EXACTLY, and are
    // kept only to say so out loud. pxt-nezha-diffdrive's shims.cpp already
    // declares, for vevov specifically:
    //     NezhaMotorPort left{1, -1};    // left = M1, mirrored
    //     NezhaMotorPort right{2, +1};   // right = M2
    // camera-verified there on 2026-08-20. Setting them again is a no-op.
    //
    // DO NOT "CORRECT" THIS FROM radio-robot-lib's vevov.json. That file says
    // left_port 2 / right_port 1 / fwd_sign_right -1, which is NOT the same
    // convention as the extension's MotorPort labels, and a guard written
    // faithfully from it puts left on M2 and right on M1 -- swapping the side
    // labels against an already-correct default.
    //
    // MEASURED 2026-09-17, the cost of doing exactly that: the robot drove
    // straight correctly and turned the WRONG WAY (`turn 20` reported odom
    // +21.67 deg while the camera measured -18.26). Equal wheel speeds are
    // identical under a side swap, so nothing that drives in a line can detect
    // it -- and with the steering sign inverted every calj correction drives
    // the error OUTWARD: err 0.6 -> 1.2 -> 3.6, steer pinned at the clamp,
    // until the blind-stripe guard stopped the run 6 cm off the line.
    //
    // shims.cpp's own comment explains why no sign flip can fix it ("forward
    // and rotation flip together, so no sign pair gives both; the free variable
    // is which port is called left") and records the same fault found by camera
    // on 2026-08-19. That comment predates this session by a month. Read the
    // firmware for the robot's name before characterising its behaviour.
    diffDrive.configureMotor(MotorSide.Left, MotorPort.M1, MotorDirection.Reversed)
    diffDrive.configureMotor(MotorSide.Right, MotorPort.M2, MotorDirection.Forward)
    // Straddle gains for vevov's SHORT sensor arm. PXT compiles every file into
    // one scope, so these assign calibratej.ts's own tunables directly, and
    // pxt.json lists that file before this one so they are initialised first.
    //
    // These are baked rather than left to `caltune` because the tune verbs write
    // RAM only. A power cycle silently reverted them on 2026-09-17 and calj then
    // ran on gopiv's speed=8 kp=1.1 -- the wrong gains for a 2 cm arm, and the
    // run announced exactly that in its own CALJ:begin line before driving.
    //
    // vevov's bar sits ~2 cm ahead of the axle against gopiv's ~17, and damping
    // is zeta = (L/2)*sqrt(Kp/v), so the arm alone costs a factor of ~8. Kp here
    // is what `calzeta` picks for zeta = 1 at lever 1.9 and speed 5.
    // ARM LENGTHENED 2026-09-17 to ~10 cm (stakeholder), from the ~4.3 cm the
    // calt outer channels had measured. The tuning below is gopiv's, which is
    // proven on a long arm (17 cm) -- not the speed 5 / Kp 2.0 worked out for
    // the short mount, which was chosen to fight a damping deficit that no
    // longer exists.
    //
    // Superseded reasoning, kept because it was wrong in an instructive way:
    // Kp 2.0, NOT the 5.54 calzeta computes for zeta = 1 at this lever. The
    // theory ignores the steering clamp: at Kp 5.54 any error past 0.45 cm
    // saturates CALJ_MAX_STEER, which at speed 5 means wheels at 7.5 and 2.5 --
    // a turning radius near 5.6 cm. The loop stops being proportional and
    // becomes bang-bang, and MEASURED vevov 2026-09-17 it spiralled off the
    // line (err 0.6 -> 1.2 -> 3.6, steer pinned, encoder counts 1066 vs 455).
    //
    // Kp 2.0 needs 1.0 cm of error to clamp instead of 0.45, and completed the
    // course: measured 90.5 cm against a TAPE-MEASURED 90.2, rms 0.78 cm,
    // acq 0 ticks. zeta is then 0.6 -- underdamped on paper, and the 9.9
    // crossings/m says so -- but a gain the actuator can actually deliver beats
    // a gain that is correct only until it saturates.
    CALJ_SPEED = 8
    CALJ_KP = 1.1
    CALJ_MAX_STEER = 2.5
    CALJ_LEVER = 10
    // Wheel travel per shaft degree, MEASURED on vevov 2026-09-17 by calj:
    // three straddled runs of the eye field against a TAPE-MEASURED 90.2 cm,
    // measuring 90.5 / 90.35 / 90.5 and giving 0.7852 / 0.7865 / 0.7852. Mean
    // 0.7856, sd 0.00075 (0.096%), standard error 0.055% -- a 0.28% correction
    // to the compiled 0.7878 default, implying a 90.03 mm wheel.
    //
    // Corroborated across the fleet: gopiv measured 90.07 mm and tigez 90.1 mm,
    // so three robots agree inside 0.08%. radio-robot-lib's vevov.json claims
    // 80.77 mm -- boilerplate shared with two other configs, wrong by 11%.
    //
    // Supersedes 0.79324 from calibratel 2026-09-15. calj sets its own baseline
    // at the start of every run, so this affects ordinary driving only, never
    // the calibration's own answer.
    diffDrive.setWheelCalibration(0.7856)
    // Track width CALIPER-MEASURED by Eric 2026-09-16: 111.6 mm. The config had
    // carried 128.0, which is about one tyre width larger and reads as an
    // outside-to-outside span. With the true width the slip falls to
    // 111.6/116.2 = 0.96 -- back inside config.proto's legal {0} u [0.5, 1.0],
    // which the old baked 1.1013 violated outright.
    applyGeometry(11.16, 0.969)   // records the pair -- see geometry.ts
    // MEASURED 2026-09-17 by calc on the alternating iron cross: b = 11.516 cm,
    // so slip = 11.16/11.516 = 0.969, a 0.94% correction to the 0.96 above.
    // Fifteen single-revolution runs; the numbers and the caveats are in
    // radio-robot-lib config/robots/vevov.json under geometry.calc_20260917.
    //
    // THE LEAST PRECISE RESULT IN THE FLEET, and the reason is worth knowing:
    // sd 1.22% against gopiv's 0.14%, tovez's 0.28% and tigez's 0.34% on the
    // SAME cross. Two hypotheses were tested and BOTH FAILED, so this is not
    // yet explained --
    //   - not the sensor. All four channels agree on the mean to 0.11 deg while
    //     each carries 7.6-9.8 deg of within-run scatter. That is common mode:
    //     a thresholding fault would make the channels disagree independently.
    //     (vevov's learned line/background references do read a degenerate
    //     9,9,9,9, but the channel agreement rules it out as the cause.)
    //   - not centring. Recentring on the cross before every run made it very
    //     slightly WORSE, 1.45% over 5 runs against 1.15% over the 10 that were
    //     allowed to drift out to r = 4.5 cm.
    // What is left is the pivot itself.
    //
    // DO NOT RAISE THE REVOLUTION COUNT TO AVERAGE IT DOWN. Tried, and it makes
    // things worse, because vevov's walk is SYSTEMATIC rather than random: it
    // creeps ~0.5 cm outward in the same direction every revolution. Three
    // revolutions per run gave 11.602, 11.051 and 13.93 cm -- that last one a
    // mean gap of 52.3 deg for a true 45, which is missed transitions, not
    // scatter. Those three runs are discarded and are not in the 15.
    // (slip 0.969 applied by applyGeometry above)
    // NOTE: the straddle lever arm (CALJ_LEVER, calibratej.ts) is deliberately
    // NOT set here. vevov's sensor bar is much shorter than gopiv's ~17cm but
    // has not been measured, and guessing it would put a wrong number into the
    // damping. Set it over the wire with `RUN caltune`, then let `RUN calzeta`
    // pick Kp for it -- that is what those verbs exist for.
}

if (control.deviceName() == "tigez") {
    // Measured on the SECONDARY playfield 2026-09-17 against a TAPE-MEASURED
    // 75.8 cm between the crossbars (captures/calibratej-tigez-20260917/).
    //
    // WHEEL TRAVEL: no correction. calj over ten runs measured 75.865 cm mean
    // against the tape's 75.8 -- an error of +0.09%, with a standard error of
    // 0.157%. The compiled default of 0.7878 mm/deg (a 90.28 mm wheel) is
    // already right to better than this method can resolve here, so there is
    // nothing to bake and `setWheelCalibration` is deliberately NOT called.
    // The fleet agrees: gopiv 90.07 mm, vevov 90.03, tigez 90.20 +- 0.14.
    //
    // The ten runs split into two clusters by how the robot was staged (76.23
    // +- 0.15 by the robot's own return leg, 75.71 +- 0.33 by the camera), and
    // that 0.7% systematic is larger than the correction being looked for. It
    // is why no correction is baked rather than a small one: see the bench log,
    // which also records the sensor-bar skew behind it.
    //
    // THE SENSOR BAR IS MOUNTED SKEW, about 7 deg. Driven square to the start
    // crossbar the four channels meet it 0.7 cm apart (1.5, 1.9, 2.0, 2.2 cm),
    // a least-squares 6.6 deg; rotating the chassis until the camera read 8 deg
    // made all four trigger in the same tick. calj takes both its triggers on
    // the same event so a CONSTANT skew cancels in the difference -- but it also
    // means "square by the camera" and "square to the tape" are different poses
    // on this robot, and the staging has to choose one deliberately.
    CALJ_LEVER = 9              // cm, axle to sensor bar (Eric, measured). With
                                // the compiled speed 8 and Kp 1.1 that is
                                // zeta 1.67 -- near enough to critical that
                                // nothing needed tuning, unlike gopiv (3.15) or
                                // vevov (0.6). Tracking bears it out: 0-1.3
                                // crossings/m against gopiv's 2.2-5.5 and
                                // vevov's 7.7-9.9.
    // EFFECTIVE TRACK WIDTH, measured by calt (Calibrate T) from a
    // sensor-defined 180: five well-settled pairs read 176.53, 174.47, 176.05,
    // 173.08 and 173.68 deg of odometry for a true 180 -- mean 174.76, sd 1.49,
    // standard error 0.67 deg. So b = 12.0 * 174.76/180 = 11.647 cm, a 2.9%
    // correction from the compiled 11.996 and about 8 sigma.
    //
    // Corroborated independently by the overhead camera on this robot's own
    // turns: a commanded -30 read -33.15 deg of odometry against -35.0 by
    // camera, and a -76 read -76.72 against -78.7. Those ratios (0.947, 0.975)
    // put a true 180 at 170-176 deg of odometry, which is where calt landed.
    //
    // A SIXTH pair read 169.23 and is excluded: it settled only 25 ticks (the
    // minimum) and its two halves split 4.63 deg. Settle quality is the
    // discriminator here exactly as it was on gopiv -- and it matters MORE on
    // tigez, because the pivot's sensitivity to a lateral offset is
    // arcsin(d/r) and this robot's r is 9 cm against gopiv's 17. The same
    // half-centimetre of offset is twice the error.
    // CALIPER track width, 114.4 mm (Eric, 2026-09-17), replacing the compiled
    // 114.2 anchor this line used to carry -- see gopiv's block for why the
    // caliper pair is the one worth storing.
    applyGeometry(11.44, 0.971)   // records the pair -- see geometry.ts
    // SUPERSEDES calt's 11.647, measured 2026-09-17 by calc on the alternating
    // iron cross: three runs at 70 deg/s gave b = 11.808, 11.732, 11.792 cm,
    // mean 11.777, sd 0.040 (0.34%). So slip = 11.44/11.777 = 0.971.
    //
    // BE HONEST ABOUT WHAT THIS SETTLES: it does not confirm either earlier
    // number, it splits them. calt (above) said 11.647; radio-robot-lib's
    // tigez.json, from camera-truthed pivots on 2026-09-03, implies 11.896.
    // Those two disagree by 2.1%, and calc lands almost exactly halfway.
    // Preferred anyway, because calc's estimator is the only one of the three
    // that needs neither a fixed centre of rotation nor the lever arm: a RADIAL
    // sector boundary puts a sensor's own consecutive crossings 45 deg apart
    // whatever its radius or offset, and eight sectors sum to 360 so a centring
    // error cancels over a whole revolution. That independence matters most on
    // THIS robot, whose sensor bar is mounted ~7 deg skew (see above) and whose
    // short 9 cm lever doubles calt's arcsin(d/r) sensitivity relative to gopiv.
    //
    // Scatter was the fleet's tightest per-channel: sd 1.7-3.7 deg against
    // gopiv's 7.0-7.6 on the SAME cross, and tigez walked only ~0.25 cm per
    // revolution against gopiv's ~0.5 and tovez's ~1.3. That ordering held on
    // all three robots, which is what retired the earlier guess that the sd was
    // the hand-cut tape's own sector irregularity -- it is pivot quality.
    // (slip 0.971 applied by applyGeometry above)
}

//radio.setGroup(11)
//let channel = "J"
//radio.setFrequencyBand(parseInt(channel, 36) + 10)

diffDrive.enableStoredWifiLink()

// A STORED CALIBRATION BEATS THE COMPILED ONE, and this is the line that makes
// that true. It runs AFTER every per-robot block above: those are what the
// fleet measured at some point in the past, this is what the robot in your
// hands measured itself, most recently, on the wheels it is wearing now.
//
// A robot with nothing stored is untouched and boots exactly as it did before
// calstore.ts existed.
calApplyStored()

// One line per thing a bench operator would otherwise have to read the source
// for, so `mbdeploy connect` shows it at boot.
diffDrive.emitLine("boot tests ready")
diffDrive.emitLine(RADIO_ADDRESS.length == 2
    ? "boot radio " + control.deviceName() + " ch " + RADIO_ADDRESS[0] + " grp " + RADIO_ADDRESS[1]
    : "boot radio off: " + control.deviceName() + " has no derived address")
// The calibration image carries only what calibration needs. On 2026-09-13
// cala was missing from every robot's function list over WiFi: FUNCS writes
// one line per verb, and pxt-nezha-diffdrive before v1.20260913.1 dropped any
// reply line that did not fit its 8-line WiFi transmit ring, so only the first
// seven registered names ever arrived. v1.20260913.1 makes a reply line wait
// for room, so the list is complete again. If you ever pin an OLDER extension,
// keep this image to seven RUN verbs or the later ones vanish from the list.
// SEVEN VERBS, and the list is the spec. Two calibrations -- calwheels measures
// distance on the eye-shaped field, calturn measures rotation on the iron cross
// -- square and circle as the demo drives, calshow/calclear for the stored
// calibration (calstore.ts), and reboot (provision.ts). Everything else was
// unregistered 2026-09-18 so the console has exactly two calibrations to
// present and no near-misses beside them. Plain driving goes through the
// console's own MOVE_X rather than a `turn`/`nudge` RUN verb.
//
// Seven is the ceiling the note above describes, and it binds only on an
// extension older than v1.20260913.1. This image pins v1.20260914.1, which
// makes a reply line wait for room -- but an eighth verb is the point at which
// pinning an older extension starts silently truncating FUNCS, so weigh one.
diffDrive.emitLine("boot verbs: calwheels[:cm[:wheel]] calturn[:edges] square circle"
    + " calshow calclear reboot")
// What this robot is running, and whether it came from flash or the compiler.
// At boot, so the console's calibrate menu can render on connect instead of
// after a round trip.
diffDrive.emitLine(calBootLine())
diffDrive.emitLine("boot buttons: A=pick program  B=run it")


// ---- program menu ---------------------------------------------------------
// A steps through the programs, showing each one's picture; B runs whichever
// picture is up. To add a program, append its picture and its function to the
// two arrays below -- nothing else changes.
//
// Drawn as images rather than IconNames, which has neither a square nor a
// circle in it.
//
// These are the ONLY A, B and A+B handlers in the build, and they have to be:
// onButtonPressed registers against one (source, value) pair and the later
// registration DELETES the earlier one (registerWithDal, core/codal.cpp), so a
// button handler in square.ts or circle.ts would silently win or lose
// depending on pxt.json order. Those files keep their RUN verbs instead.
//
// ALL THREE CANCEL A RUNNING PROGRAM, and none of them does anything else while
// one is running: see runhelp.ts for why the cancel is a flag plus an immediate
// stop rather than either on its own.
const PROGRAM_PICTURES = [
    images.createImage(`
        . # # # .
        # . . . #
        # . . . #
        # . . . #
        . # # # .
        `),
    images.createImage(`
        # # # # #
        # . . . #
        # . . . #
        # . . . #
        # # # # #
        `),
    // cal-wheels: a double-headed arrow, out and back along the course. The
    // picture says what the robot will DO when B is pressed -- drive away and
    // drive back -- which is the thing a student needs to know before it moves.
    //
    // It replaced a plan view of the field (two verticals joined by a
    // crossbar). That was a good drawing of the apparatus and a poor drawing of
    // the action, and at five by five it also read as a capital I.
    images.createImage(`
        . . # . .
        . # # # .
        . . # . .
        . # # # .
        . . # . .
        `),
    // cal-turn: an open circle with an arrowhead, for going around. The ring
    // breaks at the top right and the corner beside the break is thickened into
    // a head, which is as much arrow as five by five will hold.
    //
    // It replaced an X, drawn for the iron cross the robot spins on -- the
    // apparatus again rather than the action, and indistinguishable at a glance
    // from a failure cross, which is what this same matrix shows when the run
    // does not work.
    images.createImage(`
        . # # . #
        # . . # #
        # . . . #
        # . . . #
        . # # # .
        `)
]
// TWO CALIBRATIONS, and that is the whole point of this image.
//
// calj measures wheel travel (mm per shaft degree, so a wheel diameter) by
// straddling a stripe edge between two lines a TAPE-MEASURED distance apart.
// calc measures the effective track width b by spinning on an alternating iron
// cross. Between them they pin the two constants odometry actually runs on, and
// they are independent: neither uses the other's answer.
//
// calx, cala, call, calt and cald were deleted on 2026-09-17. Every one of them
// measured something calj or calc now measures better, and several were
// actively misleading -- calt's tolerance sat inside its own noise on a tail
// dragger, and cala assumed a fixed centre of rotation that no robot in this
// fleet holds. Keeping a worse method next to a better one invites someone to
// run it.
const PROGRAM_RUNS: (() => void)[] = [driveCircle, driveSquare, calibrateJ, calibrateC]
const PROGRAM_NAMES = ["circle", "square", "cal-wheels", "cal-turn"]

// -1 is "nothing picked yet", so the first A press lands on the circle.
let programIndex = -1

// What the B press asked for, picked up by the background runner below. -1 is
// "nothing asked for". The handler sets this INSTEAD of running the program,
// which is what keeps it free to cancel one.
let programRequest = -1

input.onButtonPressed(Button.A, function () {
    if (programRunning()) { programCancel(); return }
    programIndex = (programIndex + 1) % PROGRAM_RUNS.length
    // interval 0: showImage otherwise holds the matrix for 400 ms, which makes
    // stepping through the list feel stuck.
    PROGRAM_PICTURES[programIndex].showImage(0, 0)
    diffDrive.emitLine("menu " + PROGRAM_NAMES[programIndex])
})

input.onButtonPressed(Button.B, function () {
    if (programRunning()) { programCancel(); return }
    if (programIndex < 0) return
    // MARKED BUSY HERE, not in the runner. The runner picks the request up
    // within 20 ms, and a press landing inside that window would otherwise see
    // an idle robot: A would step the menu under a program about to start, and
    // B would queue a second one. Claiming it in the handler closes the window
    // -- a cancel arriving before the program starts is seen by its first loop
    // check, which stops it immediately rather than never.
    programBegin()
    programRequest = programIndex
})

// A+B is its own event, so it needs its own handler to cancel. It does nothing
// when idle: there is no third thing for it to start, and a student pressing
// both to stop a robot should not get a program instead.
input.onButtonPressed(Button.AB, function () {
    if (programRunning()) programCancel()
})

// THE PROGRAM RUNNER. A fiber of its own, so a program never occupies a button
// handler -- the whole reason B can now stop what B started. See runhelp.ts.
//
// The 20 ms poll is a fifth of the drive's own 24 ms control cadence, so the
// delay between pressing B and the wheels moving is below what anyone can see,
// and an idle robot spends nothing else on it.
control.inBackground(function () {
    while (true) {
        if (programRequest >= 0) {
            const i = programRequest
            programRequest = -1
            diffDrive.emitLine("run " + PROGRAM_NAMES[i])
            // programBegin() was called by the B handler that made the request.
            PROGRAM_RUNS[i]()
            programEnd()
        }
        basic.pause(20)
    }
})
