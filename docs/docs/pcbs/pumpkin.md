# Pumpkin Patch PCB

The Pumpkin Patch PCB is a flexible circuit board complete with diodes and RGB LEDs to connect your keyboard's switches to your chosen microcontroller with minimal soldering.

If you haven't already, I suggest you check out the [Pumpkin Landing page](https://ryanis.cool/cosmos/pumpkin/) to see it in action.

!!!tip "Fit Check"

    I've made a website for [calculating how to connect your Pumpkin Patch PCB](https://ryanis.cool/cosmos/pumpkin/wiring). It takes into account maximum stretch in all dimensions, so it's a great tool to check whether the Pumpkin Patch PCB will fit your design and to calculate the most efficient way of connecting it.

    If there are a few keys in the thumb cluster that the PCB won't reach, you can use the [Skree Toe Beans](https://cosmos-store.ryanis.cool/products/skree-toe-beans) I re-sell to wire the thumb cluster separately.

    <figure markdown>
    ![Screenshot of fit checking website](../../assets/fitcheck.png){ width=500 .center }
    <figcaption>Here's the wiring for a pretty standard keyboard I put together. See how a Pumpkin Patch covers the whole thing, even the thumb cluster! The different colors are the columns in the PCB, and the red 0x0 is where the connector of the PCB should be.</figcaption>
    </figure>

## Specifications

### Spacing

The PCBs naturally rest at a 20mm vertical spacing and 24mm horizontal spacing. You can compress them to a minimum of 16mm vertically by 18.5mm horizontally or stretch them vertically to a whopping 42mm between centers, more than double their resting length! Each pumpkin is connected with a thin strip of polyimide and copper, so there is little resistance even at full stretch.

The bottom 2 rows are connected with polyimide as well, enabling a maximum horizontal stretch of 50mm. The other rows have no restriction.

From the first PCB to the microcontroller, there is 160mm of stretch. This is likely way longer than you will ever require.

### Sizing

The PCBs are wired under the assumption that every column will have at least 2 keys (so that both rows of vines are always used). The only situation where you can use only the bottom vine is if you 1) have 4 or fewer columns and 2) will not use the LEDs. For such extremely small boards, the [Plum Twists](https://ryanis.cool/cosmos/plum-twist/) or directly soldering to the switches are a better fit.

If you are using this PCB together with a PCB for the thumb cluster, you will either have to use all 7 columns or solder a jumper wire onto the LEDs themselves. This will be fixed in future revisions.

### Electrical

Pumpkin Patch PCBs are pin-compatible with TheBigSkree's flex PCBs, so you can interchange them. However, Pumpkin Patch PCBs are different in that they are wired in ROW2COL manner (this is what happens when you paste footprints from the Plum Twists while forgetting to change diode direction).

### Required Hardware

The Pumpkin Patch PCBs terminate in a flex connector. They are suited for connecting directly to the Lemon Microcontrollers. To wire them to a different microcontroller, you can use the [Skree Translator](https://cosmos-store.ryanis.cool/products/skree-translator) to connect them. You cannot solder directly to the flex connector. It is way too tiny.

If they won't cover your thumb cluster, you can use the Pumpkin Patch PCB alongside [Skree Toe Beans](https://cosmos-store.ryanis.cool/products/skree-toe-beans) to connect all your keys. Both of these flexible PCBs plug side by side into the Lemon Microcontrollers or Skree Translator.

## Cosmos Sockets

Currently, there is no backstop to prevent the PCBs from falling out when you remove a switch from your keyboard. This is a work-in-progress effort, but until it's finished, the goal of the socket is to tightly hold onto the PCB so that it does not detach when shaking/moving your keyboard.

The Cosmos socket for the Pumpkin PCB has two types of guides:

![Labeled Pumpkin PCB socket](../../assets/pumpkin-socket.png){ width=400 .center }

- **Inner Guides**: There are holes for the hotswap socket to fit into printed just below where the switch goes. In practice, I find these require very tight tolerances for a snug print. While these alone will likely not hold onto your PCBs, they provide a good area between the two holes for the hotswap socket to add a dab of glue.

      Because these guides are flush with the underside of the keyboard, I have not any any issue printing these. Supports come off easily and the holes are consistent.

- **Bottom Guides**: These are mounting guides printed on the underside of the keyboard to align the PCB. These fit pretty tightly, so they will do a good job of keeping in the PCB.

      However, because the features are very small and extruded down from the underside, print quality is mediocre. They also require more supports on the underside and make it more difficult to remove supports.

I recommend choosing _Inner Guides & Bottom Guides_, because you get the best of both. If your bottom guides print well, they will help keep in the PCBs. However, if they don't print well and you have to cut them off, you'll still have the inner guides. Before printing any keyboard, I recommend you print the test model from the downloads page so that you can examine the print quality of the socket.

## Cutting

!!!warning "Pay Attention!"

    This is the trickiest part–not because it's difficult to make the cuts, but because if you cut the wrong thing you will break your PCB! Be careful that if you are using scissors, you do not cut part where you intend.

The PCBs come attached in sheets so that everything stays together during shipping. The first step to using them is cutting out all the areas marked in red in this image. I personally like using diagonal cutters for this so you can snip real close to the edge of the pumpkin, but scissors will do. There should not leave any tab remaining: any leftover will cause the pumpkin to not fit into recessed areas.

![Areas to be cut from Pumpkin PCB](../../assets/pumpkin-cuts.jpg)

Afterwards, the PCB should look like this (pardon my bad photoshopping–I'll get a better picture my next build).

![Areas cut from Pumpkin PCB](../../assets/pumpkin-cutout.jpg)

As you cut everything out, it will become easy for the circuit to tangle itself. If you know the size to which you will cut each of your columns, I recommend you do some pruning first so it is easier to handle.

## Installation

With the switches already inserted, plug in the Pumpkin Patch from the rear. Also plug it into the FPC connector on your microcontroller.

!!!warning "Pay More Attention!"

    The connectors connecting each pumpkin are delicate. I will probably make them larger next revision because I have damaged a few pumpkins by bending the wavy parts too much. If you do craese or even snap a connector, you can handwire directly to hotswap socket side or top of the diode to create row/column connections.

Trim off any remaining unused Pumpkins. For columns that you cut down, there will be a solder jumpers on the tops of the columns that you cut. Solder these so that data signals can correctly flow from the LEDs on one column to the next. In the example below the jumpers are highlighted in green.

![Locations of solder jumpers on Pumpkin PCB](../../assets/pumpkin-solder.jpg){ width=500 .center }
