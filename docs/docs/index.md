# Getting Started

## Getting Help

You'll get the most help in the [Discord Server](https://discord.gg/nXjqkfgtGy), especially if you have questions related to using the generator or ergonomics. You may also report bugs through GitHub Issues, but I recommend you ask in the Discord Server first if you encouter problems.

## Contributing

Are you good at CAD and have a part you'd like to integrate into the generator? Or are you interested in improving the website? There are surely many people who would benefit from your contributions.

Check the [GitHub Repository](https://github.com/rianadon/Cosmos-Keyboards) and [Contributing Guide](./contributing.md) for instructions on how you can add to the generator.

## Frequently Asked Questions

There's so many settings! How do I know what to choose for them?

**Keycaps**: XDA, DSA, and MT3 are probably the easiest to find & buy. Drop also sometimes offers really good deals on OEM keycaps. Choose Choc if you want a low-profile keyboard.

The generator will adapt to the keycap you choose so that the top surface remains smooth, so the choice is really based on 1) aesthetics and 2) feel. Highly contoured keycaps like MT3 are great for column curvatures of at least 20°.

**Switches**: If you're willing to spend I recommend Skree and Cyboard's flex PCBs. These will save you the the time of soldering all your switches. Otherwise, if you'd like hotswap I recommend the Plum Twists Cosmos sells or the 3D-printed hotswap socket options. The hotswap sockets will let you easily disassemble and reassemble your keyboard if you 3d print a new case. Otherwise, you can choose to solder directly to the switches. The specific switch you choose to use in your keyboard will depend on your preferred feel and sound/clickiness

**Curvature**: Do what feels right to you. The defaults are a mere suggestion and not backed by any thorough testing or science. Once you scan your hand, you can visualize how fitting your settings are. And don't be afraid to use negative curvatures, especially for the thumb cluster.

**Thumb Cluster**: I recommend the curved preset, either 3 or 5 keys. Of all the different presets, this one lays out the keys in the way that it's probably most comfortable to press them. If you want a trackball, I recommend turning one of the keys in the curved preset into the trackball and moving it into place. I don't recommend the Orbyl layout. Ideally, you can easily press the thumb cluster keys & use your index/middle finger for moving the trackball.

**Microcontroller**: _Adafruit KB2040_ - it's more expensive than the RP2040 boards on AliExpress but it's smaller & has more peripherals. _Pro Micro_ - easily available. _Nice!Nano_ - if you want wireless.

**Fasten Base with Screws**: Even if you don't plan on adding a bottom plate to the model & buying the extra hardware for it, I recommend you leave this option on. You might change your mind later.

**Rounded Top and Sides**: You'll need to pay the one-time fee for pro access in order to download models with these settings. They don't affect the functionality or ergonomics in any way. They simply look nice.

**Stagger**: This is over in the advanced tab but I think it's very important you at least play around with these values before exporting a model. These settings are the easiest way to correct thin spots on the model (check the Thickness tab!) and make the keyboard fit your fingers.

**Thumb Cluster > Custom**: In addition to moving the thumb cluster around through stagger settings, you may also wish to rotate it to a more comfortable position. The interface for doing this isn't easy to use right now, so you might find it easier to edit the rotations through code in the Expert mode.

## I Finished! What Next?

First, check your thicknesses in the Thickness tab. Ideally all parts of the model should be at least 2 mm thick.

**Adding Finishing Touches**: Then export your model! If you like you can [use another program](./cad.md) to add finishing touches to your keyboard before you export. If you export the STEP file, you can load it into a CAD program like Fusion or Onshape and modify it any way you like. You can also load the STL file into a program like Blender or Meshmixer to sculpt the mesh.

**Printing**: I recommend printing with at least 2 perimeters and 20-50% infill. If you're using PrusaSlicer (the only slicer I've tested with Cosmos), try both "snug" and "organic" supports and choose whichever uses the least material. You should also add support blockers underneath where the screw inserts go. These areas don't need supports & they'll be hard to remove.

**Wiring**: Save yourself the headache of fighting your wires and buy thin wire (called wire wrap wire) Try to buy 28-30 gauge. An alternative to needing to strip the wire in the middle or cutting small pieces when working with PCBs is to use magnet wire. This stuff is awesome because the enamel melts away when heated (i.e. when soldered to). So you can run a long strip across all your switch contacts or holes in your PCBs then solder each point.

If you're using PCBs, stack them up then run the magnet wire through all the holes at once. You can even build yourself a matrix before putting them all on the case. Just make sure you solder really well else you'll spend time debugging.

For TRRS connectors, wire ground and power to opposite ends to avoid part damage.

**Programming**: I recommend using QMK with Via. Soon I'll build support for generating the necessary files into the generator.

Finally, share your model! I would love to see it in #show-and-tell on Discord. Even the in-progress pictures, otherwise we may be waiting a month to see what it finally looks like 😈
