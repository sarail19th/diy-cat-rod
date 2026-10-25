/* ------------------------------------------------------------------
   Shop settings and parts catalog. Edit this file to change prices,
   weights, Shopee keywords, and how orders reach you.
   All weights are estimates (grams) to help people decide; they are
   not lab measurements.
------------------------------------------------------------------- */

window.CONFIG = {
  // Shopee link. {kw} is replaced with the search keyword.
  // To earn commission, paste your Shopee Affiliate link pattern here.
  SHOPEE_LINK_TEMPLATE: "https://shopee.co.th/search?keyword={kw}",

  // Where orders go. Leave empty to hide that option.
  LINE_OA_ID: "",      // e.g. "@yourshop"
  ORDER_EMAIL: "",     // e.g. "orders@yourshop.com"

  ASSEMBLY_FEE: 59,    // THB, per wand we assemble
  SHIPPING_FEE: 40,    // THB, flat
  MAX_ATTACH: 6,       // max toys on the tip

  TOTAL_MAX: 70        // g, above this tires the wrist
};

window.CATALOG = {
  length: { min: 30, max: 120, step: 5, def: 60 },
  line: { min: 20, max: 80, step: 5, def: 40 },

  // gpc = grams per cm. tipBase = grams of tip load the rod carries
  // at 60 cm before it droops; longer rods carry less.
  materials: [
    { id: "bamboo", gpc: 0.15, tipBase: 14, color: "#C99B45", node: true,
      base: 8, perCm: 0.5, kw: "ไม้ไผ่กลม 5 มม. ยาว 1 เมตร",
      name: { th: "ไม้ไผ่", en: "Bamboo" },
      feel: { th: "ยืดหยุ่น เบา เป็นธรรมชาติ", en: "Springy, light, natural" } },
    { id: "wood", gpc: 0.22, tipBase: 18, color: "#A66B3F",
      base: 10, perCm: 0.7, kw: "ไม้เดือยกลม 6 มม.",
      name: { th: "ไม้เดือย", en: "Wood dowel" },
      feel: { th: "แข็งแรง ไม่ค่อยโค้ง", en: "Sturdy, barely flexes" } },
    { id: "fiber", gpc: 0.18, tipBase: 16, color: "#E9F3F2",
      base: 12, perCm: 0.8, kw: "ก้านไฟเบอร์กลาส 6 มม.",
      name: { th: "ไฟเบอร์กลาส", en: "Fiberglass" },
      feel: { th: "โค้งงอทน ไม่หัก", en: "Bends a lot, rarely breaks" } },
    { id: "carbon", gpc: 0.12, tipBase: 22, color: "#2A3050", hi: true,
      base: 25, perCm: 1.8, kw: "แท่งคาร์บอนไฟเบอร์ 6 มม.",
      name: { th: "คาร์บอนไฟเบอร์", en: "Carbon fiber" },
      feel: { th: "เบาและแข็ง รับปลายหนักได้ดี", en: "Light and stiff, carries more" } }
  ],

  handles: [
    { id: "foam", g: 6, w: 20, color: "#E8547A", price: 15, kw: "ปลอกโฟมนุ่ม ด้ามจับ",
      name: { th: "โฟมนุ่ม", en: "Soft foam" } },
    { id: "cork", g: 9, w: 18, color: "#D2A56B", price: 25, kw: "คอร์กทรงกระบอก ด้ามจับ",
      name: { th: "คอร์ก", en: "Cork" } },
    { id: "wood", g: 14, w: 17, color: "#A66B3F", price: 20, kw: "ด้ามไม้กลึง ด้ามจับ",
      name: { th: "ไม้กลึง", en: "Turned wood" } },
    { id: "tape", g: 5, w: 14, color: "#1B2347", price: 12, kw: "เทปกริป พันด้าม",
      name: { th: "พันเทปกริป", en: "Grip tape wrap" } },
    { id: "cord", g: 12, w: 17, color: "#F4B63F", price: 22, kw: "เชือกร่ม paracord 4 มม.",
      name: { th: "ถักเชือกร่ม", en: "Paracord wrap" } }
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
