/* ------------------------------------------------------------------
   Shop settings and parts catalog. Edit this file to change prices,
   weights, Shopee keywords, and how orders reach you.
   Weights and stiffness are worked out from each part's real size and
   typical material values, so they are estimates, not lab measurements.
------------------------------------------------------------------- */

window.CONFIG = {
  // Shopee link. {kw} is replaced with the search keyword.
  // To earn commission, paste your Shopee Affiliate link pattern here.
  SHOPEE_LINK_TEMPLATE: "https://shopee.co.th/search?keyword={kw}",

  // Ordering and home delivery. Keep false until that phase is ready;
  // the order tab then shows "coming soon". Set true to show prices and the order form.
  ORDERS_OPEN: false,

  // Where orders go once ORDERS_OPEN is true. Leave empty to hide that option.
  LINE_OA_ID: "",      // e.g. "@yourshop"
  ORDER_EMAIL: "",     // e.g. "orders@yourshop.com"

  ASSEMBLY_FEE: 59,    // THB, per wand we assemble
  SHIPPING_FEE: 40,    // THB, flat
  MAX_ATTACH: 6,       // max toys on the line

  // Wrist model. Felt weight (g) = torque about the grip / WRIST_ARM.
  // There is no published standard for cat wands. Published hand-tool guidance
  // allows up to 500 g for precision tools; these targets are 10% and 20% of
  // that, to allow for fast repeated flicking. Change them if you disagree.
  WRIST_ARM: 30,       // cm, about a forearm length
  WRIST_GOOD: 50,      // g felt weight, below this is comfortable
  WRIST_MAX: 100,      // g felt weight, above this tires the wrist quickly

  // Rod flex. A rod carries a tip load until its tip droops by this
  // fraction of the rod length.
  DEFLECT: 0.25
};

window.CATALOG = {
  length: { min: 30, max: 120, step: 5, def: 60 },
  line: { min: 20, max: 80, step: 5, def: 40 },
  handleLen: { min: 8, max: 20, step: 1, def: 14 },

  // Size guide. Person height range in cm. Cats: k scales a typical cat
  // (about 40 cm chest to rump); body is that length in cm.
  person: { min: 140, max: 190, step: 5, def: 160 },
  cats: [
    { id: "kitten", k: 0.55, body: 22, name: { th: "ลูกแมว", en: "Kitten" } },
    { id: "adult", k: 1, body: 40, name: { th: "แมวทั่วไป", en: "Typical cat" } },
    { id: "large", k: 1.3, body: 52, name: { th: "แมวตัวใหญ่", en: "Large cat" } }
  ],

  // Rods. sizes = outer diameters in mm you can buy. wall = tube wall in mm
  // (0 means solid). rho = density in g/cm3. E = stiffness in GPa.
  // Weight per cm and stiffness are calculated from these.
  materials: [
    { id: "bamboo", sizes: [3, 4, 5, 6], dDef: 4, wall: 0, rho: 0.8, E: 15, color: "#C99B45", node: true,
      base: 8, perCm: 0.5, kw: "ไม้ไผ่กลมเส้นเล็ก {d} มม.",
      name: { th: "ไม้ไผ่", en: "Bamboo" },
      feel: { th: "ยืดหยุ่น เบา เป็นธรรมชาติ", en: "Springy, light, natural" } },
    { id: "wood", sizes: [3, 4, 5, 6, 8], dDef: 4, wall: 0, rho: 0.7, E: 12, color: "#A66B3F",
      base: 10, perCm: 0.7, kw: "ไม้เดือยกลม {d} มม.",
      name: { th: "ไม้เดือย", en: "Wood dowel" },
      feel: { th: "แข็งแรง โค้งน้อย", en: "Sturdy, flexes a little" } },
    { id: "fiber", sizes: [2, 3, 4, 5], dDef: 3, wall: 0, rho: 1.9, E: 40, color: "#E9F3F2",
      base: 12, perCm: 0.8, kw: "ก้านไฟเบอร์กลาส {d} มม.",
      name: { th: "ไฟเบอร์กลาส", en: "Fiberglass" },
      feel: { th: "ทนทาน โค้งงอได้ไม่หัก", en: "Tough, bends without breaking" } },
    { id: "carbon", sizes: [1.5, 2, 3, 4], dDef: 2, wall: 0, rho: 1.6, E: 120, color: "#2A3050", hi: true,
      base: 25, perCm: 1.8, kw: "แท่งคาร์บอนไฟเบอร์ {d} มม.",
      name: { th: "คาร์บอนไฟเบอร์", en: "Carbon fiber" },
      feel: { th: "เบามาก แข็งและเด้ง", en: "Very light, stiff and springy" } },
    { id: "tube", sizes: [6, 8, 10, 12], dDef: 8, wall: 1, rho: 0.9, E: 1.5, color: "#B9D9F2",
      base: 5, perCm: 0.3, kw: "ท่อพลาสติก PP {d} มม.",
      name: { th: "ท่อพลาสติกกลวง", en: "Hollow plastic tube" },
      feel: { th: "นิ่ม โค้งง่าย ราคาถูก แบบที่พบในไม้ตกแมวสำเร็จรูป", en: "Soft, bends easily, cheap, like many ready-made wands" } },
    { id: "wire", sizes: [1.5, 2, 3], dDef: 2, wall: 0, rho: 7.85, E: 200, color: "#C9CED8",
      base: 8, perCm: 0.4, kw: "ลวดสปริงเหล็ก {d} มม.",
      name: { th: "ลวดสปริงเหล็ก", en: "Spring steel wire" },
      feel: { th: "เด้งตัวไว ดึงแรงแล้วอาจงอถาวร", en: "Snappy, can bend for good if pulled hard" } }
  ],

  // Handles. d = grip diameter in mm, gpc = grams per cm of handle.
  // "bare" means you hold the rod itself, so d and weight come from the rod.
  handles: [
    { id: "bare", bare: true, color: "#C99B45", price: 0, kw: "",
      name: { th: "ไม่มีด้าม จับที่ก้านตรงๆ", en: "Bare, hold the rod itself" },
      feel: { th: "บางมาก จับแบบหยิบ", en: "Very thin, pinch grip" } },
    { id: "silicone", d: 12, gpc: 0.55, color: "#9B8CE8", price: 18, kw: "ปลอกซิลิโคนหุ้มด้ามจับ",
      name: { th: "ปลอกซิลิโคน", en: "Silicone sleeve" },
      feel: { th: "นุ่ม แต่บาง", en: "Soft but thin" } },
    { id: "plastic", d: 14, gpc: 0.6, slick: true, color: "#DCE6F7", price: 10, kw: "ท่อพลาสติกหุ้มด้ามจับ",
      name: { th: "ปลอกพลาสติก", en: "Plastic cover" },
      feel: { th: "ผิวมัน อาจลื่น", en: "Glossy, can be slippery" } },
    { id: "foam", d: 30, gpc: 0.53, color: "#E8547A", price: 15, kw: "ปลอกโฟมนุ่ม ด้ามจับ 30 มม.",
      name: { th: "โฟมนุ่ม", en: "Soft foam" },
      feel: { th: "หนา เบา กำสบาย", en: "Thick, light, comfortable" } },
    { id: "cork", d: 28, gpc: 1.4, color: "#D2A56B", price: 35, kw: "คอร์กทรงกระบอก ด้ามจับ",
      name: { th: "คอร์ก", en: "Cork" },
      feel: { th: "กันลื่น หนักปานกลาง", en: "Grippy, medium weight" } },
    { id: "wood", d: 25, gpc: 3.1, color: "#A66B3F", price: 30, kw: "ด้ามไม้กลึง ด้ามจับ",
      name: { th: "ไม้กลึง", en: "Turned wood" },
      feel: { th: "หนัก ช่วยถ่วงสมดุล", en: "Heavy, balances a long rod" } },
    { id: "tape", d: 10, gpc: 0.25, color: "#1B2347", price: 12, kw: "เทปกริป พันด้าม",
      name: { th: "พันเทปกริป", en: "Grip tape wrap" },
      feel: { th: "บาง เบามาก", en: "Thin, very light" } },
    { id: "cord", d: 12, gpc: 0.5, color: "#F4B63F", price: 22, kw: "เชือกร่ม paracord 4 มม.",
      name: { th: "ถักเชือกร่ม", en: "Paracord wrap" },
      feel: { th: "กันลื่น ค่อนข้างบาง", en: "Grippy, fairly thin" } }
  ],

  lines: [
    { id: "cotton", gpcm: 0.03, perCm: 0.12, color: "#F6EFE0", kw: "เชือกคอตตอน 3 มม.",
      name: { th: "เชือกคอตตอน", en: "Cotton cord" },
      feel: { th: "นุ่ม ปลอดภัยเมื่อแมวกัด", en: "Soft, gentler if chewed" } },
    { id: "braid", gpcm: 0.05, perCm: 0.15, color: "#DCD8F0", kw: "เชือกไนลอนถัก 2 มม.",
      name: { th: "ไนลอนถัก", en: "Braided nylon" },
      feel: { th: "ทนกว่า หนักขึ้นเล็กน้อย", en: "Tougher, a bit heavier" } }
  ],

  toys: [
    { id: "fish", g: 7, price: 25, kw: "ตุ๊กตาปลาสักหลาด ของเล่นแมว",
      name: { th: "ปลาสักหลาด", en: "Felt fish" } },
    { id: "mouse", g: 10, price: 35, kw: "หนูตุ๊กตา ของเล่นแมว",
      name: { th: "หนูตุ๊กตา", en: "Plush mouse" } },
    { id: "feather", g: 2, price: 20, kw: "ขนนก ของเล่นแมว",
      name: { th: "ขนนก", en: "Feathers" } },
    { id: "bell", g: 3, price: 10, kw: "กระดิ่งเล็ก ของเล่นแมว",
      name: { th: "กระดิ่ง", en: "Bell" } },
    { id: "ribbon", g: 1, price: 8, kw: "ริบบิ้นผ้า เส้นเล็ก",
      name: { th: "ริบบิ้น", en: "Ribbon" } },
    { id: "pompom", g: 2, price: 8, kw: "ปอมปอม DIY",
      name: { th: "ปอมปอม", en: "Pompom" } },
    { id: "nip", g: 6, price: 30, kw: "ถุงแคทนิป ของเล่นแมว",
      name: { th: "ถุงแคทนิป", en: "Catnip pouch" } },
    { id: "crinkle", g: 4, price: 15, kw: "ลูกบอลกรอบแกรบ แมว",
      name: { th: "ลูกบอลกรอบแกรบ", en: "Crinkle ball" } }
  ],

  extras: [
    { id: "glue", kw: "กาวร้อน ปืนกาว",
      name: { th: "กาวร้อนและปืนกาว", en: "Hot glue and gun" } },
    { id: "swivel", kw: "ลูกหมุนตกปลา เบอร์เล็ก",
      name: { th: "ลูกหมุนตกปลาเบอร์เล็ก (เปลี่ยนของเล่นง่าย)", en: "Small fishing swivels (quick toy swaps)" } }
  ]
};
