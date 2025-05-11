???info "What are Column Flex PCBs?"

    Column Flex PCBs affix hotswap sockets, diodes, RGB Leds, and copper traces to a flexible polyimide backing. All the wiring is already done for you, and the polyimide is flexible enough that you can shift every socket up to 20mm in any direction.

    ![Image of Pumpkin PCBs](../../assets/pumpkins.jpg){ width=400 .center }

    There are two kinds of column flex PCBs. The fullly interconnected one I've pictured above is the Pumpkin PCB, which I plan to sell soon. All sockets come connected to each other. You need to be very careful with it, because if you break a connection you will either need to bridge the gap with wire or buy a whole new PCB. TheBigSkree also sells connected-column ones, where every row in a column is connected, but you will need a second flexible PCB to wire the columns together.

???info "What's VIK?"

    [VIK](https://github.com/sadekbaroudi/vik) is a standard for how keyboard modules connect to one another. It combines SPI, I2C, power, and GPIO into a single connector. The idea is that the Cosmos benefits from VIK modules for other keyboards, and any VIK modules created specifically for Cosmos will benefit the wider keyboard community,
