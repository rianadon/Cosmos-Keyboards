# Battery Tray

Wireless keyboards need a battery. Cosmos can generate a tray for a LiPo pouch cell, placed against the inside of the case wall near the microcontroller. You'll find the option under **Case → Battery** in Basic and Advanced mode.

The tray is an open pocket with low walls. The cell isn't clamped in: hold it down with double-sided tape or a piece of foam. Leaving it loose on top gives LiPo cells room to swell as they age, which is normal and expected.

## Choosing a Cell

LiPo pouch cells are named after their size: the six digits are the thickness in tenths of a millimeter, then the width and length in millimeters. A **502030** cell is 5 mm thick, 20 mm wide and 30 mm long.

The presets cover common sizes: 301230, 402030, 502030, 503035 and 603040. If your cell isn't one of them, or its datasheet lists a size that differs from its name, pick **Custom Size** and enter the length, width and thickness from the datasheet.

!!! tip "Measure your cell"

    Real cells are often a little larger than their nominal size, especially around the protection circuit at the end where the leads come out. Measure yours with calipers and use Custom Size if it's bigger than the preset.

The pocket leaves 0.3 mm of clearance around the cell and 1 mm above it for swelling. Its walls are half as tall as the cell.

## Placement

The tray is placed automatically. Cosmos looks along the inside of the walls for a spot where the tray stands on the bottom plate, touches the wall along its back edge, and stays clear of the switches, screw inserts, the microcontroller holder, and the space behind each connector. Of the spots that fit, it picks the one closest to the microcontroller. The cell either points into the case or lies with its long side against the wall, whichever fits best.

The leads of a LiPo pouch cell come out of one of its short ends, so the tray's wall is left open along the whole short end that faces the microcontroller. When the cell points into the case, that's the end facing away from the wall.

If no spot fits, Cosmos shows an error. Try a smaller cell, or move the tray yourself with the offset settings below.

Split keyboards get a tray on both halves, mirrored. The center piece of a keyboard with a center cluster never gets one.

### Moving the Tray

Advanced mode adds **Battery Offset (X/Y)**, **Battery Offset (Z)** and **Battery Rotation**. They move the tray from its automatic position, measured from the tray's own frame:

- **X** runs along the wall the tray is attached to.
- **Y** is negative into the case, away from the wall.
- **Z** moves the tray up.
- **Rotation** turns the tray around its center, in degrees.

Once you set an offset, you're in charge of the position. Cosmos doesn't check the moved tray for collisions, so check the 3D view. Setting an offset also turns off the fit error: if no spot fits, the tray starts from the spot closest to the microcontroller, and you can move it from there.

## Fused or Separate

**Battery Tray** chooses how the tray is printed.

**Fused to Case** prints the tray as part of the case walls. It reaches down to the bottom of the walls, so it prints on the bed with no overhang, and a short bridge (up to 5 mm) fills any gap between its back edge and a curved or stepped wall.

**Separate Part** prints the tray on its own. Download it from the **Battery Tray** section of the Download dialog; it's also included in the STEP file. It's screwed into the case the same way as the microcontroller holder:

- Each end of the tray gets an arm with a countersunk hole, reaching to a screw insert on the wall next to the tray. The screw goes up through the arm from below, before the bottom plate is attached.
- When there's no room on the wall for an extra insert, the arm reaches further, up to 25 mm, to one of the bottom plate's screw inserts and shares it. That insert is raised to sit on top of the arm, and the plate screw passes through the plate and the arm.

!!! info "Longer plate screws"

    A plate screw that also holds the battery tray passes through the tray's arm as well as the plate, so it needs to be about 2.7 mm longer than the other plate screws.

If neither side has room for an arm, the separate tray is generated without screws. Tape or glue it into the case instead.

## Expert Mode

In Expert mode the tray is set with the `battery` option. See [Expert Mode](expert.md#battery-tray).
