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
| `app.js` | Weight maths, rod drawing, saving, Shopee list, order flow |
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

- Rod weight = length x grams per cm of the material.
- Tip load = line weight + all toys on the tip.
- Each material carries a tip load before it droops (`tipBase`, at 60 cm). Longer rods carry proportionally less.
- The rod drawing bends in proportion to tip load divided by that limit.
- Total weight above `TOTAL_MAX` (70 g) is flagged as tiring for the wrist.

## How the size guide works

- The picture is drawn at 1 unit = 1 cm. The person is a simple figure scaled to the chosen height, the cat is a typical cat (about 40 cm chest to rump) scaled for kitten or large.
- The suggested rod length is 25% to 50% of the person's height, rounded to 5 cm. This is a rough rule of thumb, not a standard. Change it in `sizeRange()` in `app.js`.
- Cat sizes and the person height range are in `data.js` (`person`, `cats`).

All numbers are estimates in `data.js` to help people decide. Adjust them after you weigh your real parts.

## Orders (later phase)

Ordering is switched off (`ORDERS_OPEN: false`) and the tab says "coming soon". When switched on, there is still no payment system or server. An order is a message with the design, price estimate and shipping details that the visitor sends to your LINE or email. You confirm the price and take payment in chat.
