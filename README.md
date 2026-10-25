# ไม้ตกแมว DIY (DIY Cat Wand Builder)

A static website where cat owners design their own cat teaser wand. Pick rod length, material, handle, line and tip toys. The live drawing bends under load, and two gauges show tip load and total weight so people know if the build is too heavy.

When the design is done, the visitor can:

- **Compare size** with a to-scale picture of a person (140 to 190 cm) and a cat (kitten, typical, large) holding or chasing the wand, with a suggested rod length for the person's height.
- **Save** it in their browser, or copy a link that reopens the same design.
- **Buy the parts on Shopee** from a checklist of search links, plus 4 assembly steps.
- **Order from the shop** (coming soon): the tab shows a "coming soon" note for now. The price estimate and order form are built and switched off. Set `ORDERS_OPEN: true` in `data.js` to show them.

Thai and English, switch with the button in the header.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page structure |
| `styles.css` | Look and layout |
| `app.js` | Weight, flex and wrist maths, rod drawing, saving, Shopee list, order flow |
| `data.js` | **Edit this:** prices, weights, Shopee keywords, shop settings |
| `i18n.js` | Thai and English text |

No build step. Open `index.html` in a browser or host the folder anywhere static.

## Before you go live

Edit `window.CONFIG` in `data.js`:

- `ORDERS_OPEN`: leave `false` until ordering and shipping are ready.
- `LINE_OA_ID`: your LINE Official Account ID (for example `@yourshop`). The "Send order on LINE" button only appears when this is set.
- `ORDER_EMAIL`: shows a "Send order by email" button when set.
- `SHOPEE_LINK_TEMPLATE`: links currently go to plain Shopee searches. To earn commission, paste your Shopee Affiliate link pattern with `{kw}` where the search keyword goes. A disclosure line appears automatically once you change it.
- `ASSEMBLY_FEE`, `SHIPPING_FEE`: your fees in THB.

Prices in `CATALOG` (`price`, `base`, `perCm`) are placeholders. Replace them with your real prices.

## How the weight check works

Three separate checks, because a heavy wand and a wand that is hard to hold are different problems.

- **Rod flex.** Each rod's weight and stiffness come from its real diameter, density and stiffness (`sizes`, `rho`, `E`, `wall` in `data.js`), treated as a cantilever beam. A rod is overloaded when the tip load (line + toys) would droop the tip by more than `DEFLECT` (25%) of its length. The page suggests a thicker size or a shorter length.
- **Wrist.** Felt weight = torque about the grip divided by `WRIST_ARM` (30 cm, about a forearm). The wand is played in short bursts of flicking, not held for hours like a fishing rod, so this is a conservative target of `WRIST_GOOD` 50 g (comfortable) and `WRIST_MAX` 100 g (tires quickly). **These two numbers are my own conservative choices, not a published standard.** They sit well under the 500 g that hand-tool ergonomics guidance allows for precision tools. Change them in `data.js`.
- **Handle types.** A *grip sleeve* sits over the rod: it adds no length, the rod stays one piece, and only the rod in front of the grip bends. A *separate handle* is joined behind the rod: it adds length, and the joint is the weak point, so the page warns you to insert the rod at least 3 cm and glue it.
- **Grip.** Handle diameter (about 25 to 35 mm is comfortable; under 10 mm forces a weak pinch grip), handle length (at least 10 cm, wider than a palm) and slippery covers.

Toys can hang anywhere along the line, not only at the end. For rod flex the model counts all line and toy weight at the tip, which is the safe side. For the wrist it counts the whole wand's weight about the grip.

Sources: EHS Today and ILO Encyclopaedia (hand-tool ergonomics), Maddie's Fund (cat play).

## Parts pictures and connectors

The Shopee list shows a small drawn icon for each part. Shopee product photos cannot be fetched from here, so to use a real photo add an `img: "https://..."` field to that item in `data.js`; it replaces the drawing.

Toys attach to the line with a connector you choose (knot, key ring, lobster clasp or swivel). Each connector weighs a little and is counted at the tip, along with a small screw eye (`tipFit`) on the rod tip that the line ties to.

## Prices and cat safety

Each part shows a greyed, read-only price box, and a cost estimate (DIY, without glue, pliers or shop shipping) sits under the gauges. Prices are sample data from `data.js` and show a "sample data" badge. Set `PRICES_URL` in `data.js` to a JSON endpoint from your database and those prices replace the samples (see the comment there for the shape); if the call fails the samples stay.

The cat safety list changes with the build: braided nylon, metal rings, clasps and swivels, wire and plastic-tube rods, and small toy parts each raise a warning, and soft cotton cord is recommended. Source on string and thread swallowing: VCA Animal Hospitals, "Linear Foreign Body in Cats".

## Colours, patterns and fillings

- **Colour.** The rod, handle and line each have a row of 8 standard pastel colours (pink, peach, butter yellow, mint, sky blue, lavender, cream, grey) plus the material's own colour. Every toy except the bell has its own colour row too. The rod and handle are meant to be painted with pet-safe water-based paint or wrapped in washi tape; the safety list says so.
- **Dolls (fish and mouse)** also get an easy pattern (plain, stripes, polka dots, checks) and a filling: regular cotton, catnip, catnip with a zip pocket (so you can refill it), or crinkle paper. Each filling adds a little weight and price, and the zip raises a small-parts warning.
- The choices show in the drawing, the weight check, the price estimate, the Shopee list (colour, pattern and filling are added to the search words) and the order text. They are saved in the share link. Old links without colours still open.
- Colours, patterns and fillings live in `CATALOG.colors`, `CATALOG.patterns` and `CATALOG.fills` in `data.js`. Add `paint: true` or `doll: true` to a toy there to give it these options. A `fills` price can come from `PRICES_URL` like the other prices.

## Market comparison

`CATALOG.market` holds the rod or pole length of 12 ready-made wands from retailer and review listings (checked October 2026): 45 to 100 cm, about 68 cm on average and median. The size guide shows where your rod falls. The default 60 cm and the suggested range sit near the middle of the market. Shops rarely publish handle length or thickness. The only handle figure found was about 16 cm for one wooden-handled wand (a single listing), and cheap wands are often a thin bare stick, so the grip checks here (25 to 35 mm thick, 12 cm or longer) are stricter than most wands on sale.

## No-line wands

Set the line length to 0 and the toys tie straight onto the rod tip, like some ready-made wands. The line type, line price and toy position sliders are hidden, and a short note and safety tip explain it.

## How the size guide works

- The picture is drawn at 1 unit = 1 cm. The person is a simple figure scaled to the chosen height, the cat is a typical cat (about 40 cm chest to rump) scaled for kitten or large.
- The suggested rod length is 25% to 50% of the person's height, rounded to 5 cm. This is a rough rule of thumb, not a standard. Change it in `sizeRange()` in `app.js`.
- Cat sizes and the person height range are in `data.js` (`person`, `cats`).

All numbers are estimates in `data.js` to help people decide. Adjust them after you weigh your real parts.

## Orders (later phase)

Ordering is switched off (`ORDERS_OPEN: false`) and the tab says "coming soon". When switched on, there is still no payment system or server. An order is a message with the design, price estimate and shipping details that the visitor sends to your LINE or email. You confirm the price and take payment in chat.
