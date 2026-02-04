# Trackballs

As optical imaging sensors[^1] have been (relatively) cheap and abundant, many hobby and commercial ergonomic keyboards have begun integrating trackballs into the keyboard itself. As long as you have room for one, a built-in trackball can reduce finger movement and strain when switching between typing and navigating.

Before you get too excited, in terms of speed and accuracy you're not going to beat a mouse. You'd be trading these for better ergonomics, better looks, or just a chance to try something new (or retro depending what way you look at it).

Trackball sockets in Cosmos are generated parametrically, so a very large number of permutations of trackballs and sensor are supported.

## Trackball Sizes

Initially Cosmos launched with just a 34mm trackball holder. Afterwards I added 25, then 55, then a whole lot more as people requested them. Here's the reasoning behind each size:

- **34mm**: The brand Perixx sells replacement trackballs in many different colors in this size. If you're in the US, this is a 1.34 inch trackball. You'll easily find these on Amazon, either under the Perixx brand or Sanwa (which seems to be a copycat but I've heard they're just as reliable).

      This is the size most open-source ergonomic keyboards use (e.g. [BastardKB Charybdis](https://github.com/Bastardkb/Charybdis), [Yowkees's keyball series](https://github.com/Yowkees/keyball), other Dactyl generators) use.

- **25mm**: What's even more plentiful than replacement trackballs? Mini pool ball sets! (I'm not kidding). These work so well as trackballs and are fairly standardized to 25mm that if you're looking for a small trackball, mini pool (billiard) balls are the best option.

      The [Oddball keyboard](https://atulloh.github.io/oddball/) was my introduction to the idea, and there's a few other examples of pool ball keyboards on GitHub.

- **55mm**: Another common size of trackball sold by the usual suspects Perixx and Sanwa and perhaps others. Good if you like the feel of a really big trackball, bad if you'd like to fit some other stuff on your keyboard.

As for the other sizes (in numerical order this time):

- **40mm**: Comes from the Kensington Orbit trackball.
- **43mm**: Used in the Logitech Trackman T-RB22.
- **44mm**: Used in Kensington and Elecom DEFT trackballs.
- **45mm**: The size used in the Ploopy classic.
- **46mm**: Used in the Microsoft Trackball Explorer.
- **50mm**: Pretty niche but used in some stuff.

If you're buying a new trackball in these dimensions, search `<product> replacement trackball` instead of searching for the size. You'll get better results that way.

## Trackball Sensors

This really needs my attention, because for now the sensor options are not ideal.

Most PCBs are built around one of three sensors from PixArt Imaging Inc (A Taiwanese imaging sensor company):

- PMW3360: A high-performance sensor.
- PMW3389: An upgraded version of the PMW3360 with better specs.
- PMW3610: A lower-performance but much more power efficient sensor.

Wired keyboards typically use PMW3360/PMW3389, whereas wireless keyboards use PMW3610. The PMW3360 and PMW3389 are interchangeable, so you'll see both used a lot.

The two current options are the Joe's (found on some Tindie store online which is where I bought mine, but they aren't accessible in a lot of places) or Siderakb's [PMW3610 PCB](https://github.com/siderakb/pmw3610-pcb) that TheBigSkree unofficially manufactures and sells. The [Ogen Lite PCB](https://github.com/ghostlybutterfly/Ogen) is close enough in dimensions to the Joe's sensor that it's a great open-source alternative. TheBigSkree also sells this one.

I'm currently working with Skree to produce a VIK-compatible trackball sensor with a better mounting mechanism, so sensor options will improve in the future.

[^1]: I say _imaging sensor_ instead of _trackball sensor_ because trackball and mice actually use the same sensors. These sensors take thousands of pictures every second and use computer vision to detect which way the image is moving. This works whether you're rolling the sensor on a mousepad or rolling a trackball over the sensor.
