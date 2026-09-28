/* Catalogue data for the index page.
   Only layout matters here, so every entry is text + price metadata —
   no image URLs anywhere in this project.

   Card counts mirror the live index page: 4 sections × 12 products = 48 cards. */

export const categories = [
  "Ready Stock",
  "Women shoes collection",
  "Men shoes collection",
  "Slipper",
  "Block Heels",
  "Sneakers",
  "Sandals",
  "Bags & Accessories",
];

/* ---------------- Ready Stock — real product codes & prices ---------------- */
const readyStock = [
  ["CT080", 2190, 1790],
  ["CT109", 2490, 2090],
  ["CT314", 2190, 1790],
  ["CT148", 1990, 1590],
  ["CT100", 2690, 2290],
  ["CT232", 3390, 2990],
  ["BOXH913", 2490, 2090],
  ["BOXH007", 2390, 1990],
  ["STK - PH362", 1990, 1690],
  ["STK - BS215", 2890, 2490],
  ["STK - SL714", 2190, 1890],
  ["STK - BS218", 2890, 2590],
];

/* ---------------- Women shoes collection (real titles) ---------------- */
const womenShoes = [
  "SL1155 2025 Summer Korean Style Polka Dot Slippers for Women, Fashionable Thick-Soled Crossover Style, Waterproof and Non-Slip Beach Sandals",
  "SL1153 ③Y3082026 New European and American Style Elegant Summer Sandals/Slippers - Cross-border Dropshipping",
  "BOXH1086 Retro-style hollowed-out sandals for women with bow and back strap, new summer fashion closed-toe single buckle Roman sandals 2035-7",
  "BOXH1085 Summer New Style Woven Closed-Toe Sandals, Low Heel, Fashionable Single Buckle Strap, Retro Roman Style, Versatile Women's Shoes 833-205",
  "BH1204 Women's wedge sandals, 2026 summer fashion, peep-toe bohemian Roman sandals, women's 1418-672",
  "BOXH1083 Cross-Border Large Size Patent Leather Pointed Toe Chunky Heel Mules for Women 2026 New European and American Style Fashionable Versatile High-Heeled Sandals",
  "BOXH1082 High-Heeled Shoes for Women 2026 Spring and Summer New Style, Comfortable Pointed Toe, Elegant Professional Work Shoes, Versatile Rhinestone Flats",
  "Women's Casual Pointed Toe Flat Shoes, 2026 Spring New Style, Shallow Mouth, Soft Sole, Comfortable All-match Ladies Shoes Y-25",
  "MQ Women's Square Toe Leather Pumps, 2026 New Spring Style, Thick Heel, Retro British Style, Versatile Work Shoes 6188",
  "Ladies Fashion Ankle Strap Sandals, Summer New Style, Open Toe, Chunky Heel, Comfortable Non-Slip Beach Shoes 3392",
  "New Style Women's Fisherman Sandals, Closed Toe, Hollow Out, Soft Sole, Casual Flat Roman Shoes for Summer 7701",
  "Women's Soft Leather Loafers, Spring and Autumn New Style, Slip-On, Shallow Mouth, Non-Slip Casual Walking Shoes 2260",
];

/* ---------------- Slipper ---------------- */
const slipper = [
  "Indoor & Outdoor Soft Sole Anti-Slip Slippers for Women, Summer New Style Fashionable Home Bathroom Slippers 8821",
  "Men's Thick Sole Non-Slip Beach Slippers, Fashionable Two-Way Wear Flip Flops, Cross-Border Summer Hot Sale 5501",
  "Korean Style Cute Bear Cartoon Slippers for Couples, Winter Warm Plush Cotton Home Shoes, Non-Slip 1102",
  "Summer Slippers for Women, Fashion Soft Bottom Slides, Lightweight Anti-Skid Home Sandals, Cross-Border 6603",
  "Men's Leather Flip Flops, New Season Casual Beach Slippers, Wear-Resistant Soft Sole, Outdoor Non-Slip 7715",
  "Women's Bow Decor Plush Home Slippers, Autumn Winter Warm Cotton Slides, Silent Sole Indoor Shoes 4482",
  "EVA Cloud Slippers for Women and Men, Thick Platform, Quick Dry Bath Sandals, Non-Slip Shower Shoes 9904",
  "Girls' Cute Rabbit Ear Cotton Slippers, Winter Warm Non-Slip Indoor Floor Shoes, Soft Plush 3376",
  "Men's Summer Outdoor Slippers, Comfortable Soft Sole, Anti-Slip Bath Slippers, Fashion Simple Style 2231",
  "Women's Summer Hollow Out Slippers, Fashion Comfortable Sandals, Home Outdoor Dual-Use Non-Slip 5560",
  "Unisex Home Slippers, Breathable Mesh Upper, Anti-Slip Silent Sole, Four Seasons Indoor Shoes 8123",
  "Kids' Cute Cartoon Slippers, Soft EVA Non-Slip Indoor Shoes, Lightweight Summer Slides 6645",
];

/* ---------------- Block Heels ---------------- */
const blockHeels = [
  "High-Heeled Sandals for Women 2026 New Style, Chunky Heel, Square Toe, Fashionable All-match Dress Shoes, Back Strap 7712",
  "Women's Thick Heel Shoes, Autumn New Style, Comfortable Soft Leather, Shallow Mouth, Professional Workplace Block Heels 3360",
  "Elegant Chunky Heel Pumps for Women, Patent Leather Round Toe, Slip-On Style, Party & Office Wear 9021",
  "Women's Fashion Thick Heel Sandals, Summer New Style, Peep Toe, Buckle Strap, Bohemian Beach Shoes 4188",
  "Large Size Block Heel Shoes for Women, 2026 Spring New Style, Pointed Toe, Soft Sole, Versatile Commuter Pumps 6620",
  "Women's Retro Chunky Heel Loafers, Square Toe, Slip-On, Comfortable Soft Leather, Autumn Winter 5507",
  "Fashion Women's High Heel Sandals, Ankle Strap, Chunky Heel, Elegant Party Shoes, New Summer Collection 8834",
  "Women's Thick Heel Mules, Backless Slip-On, Pointed Toe, Patent Leather, Casual & Formal 7709",
  "New Style Women's Block Heel Boots, Ankle Height, Side Zip, Soft Leather, Autumn Winter Fashion 3391",
  "Women's Chunky Heel Dress Shoes, Square Toe, Buckle Decor, Comfortable Office & Party Pumps 2264",
  "Summer Women's Thick Heel Slippers, Open Toe, Non-Slip, Fashionable Outdoor Beach Slides 5518",
  "Elegant Women's Block Heel Sandals with Rhinestone Decor, New Style, Party & Wedding Shoes 9942",
];

const womenPrices = [
  [1790, 1590],
  [2490, 2190],
  [3090, 2790],
  [3090, 2990],
  [3190, 2990],
  [2590, 2390],
  [2690, 2490],
  [1990, 1790],
  [2890, 2590],
  [2190, 1890],
  [2390, 2090],
  [3390, 2990],
];

function buildProducts(titles, idBase) {
  return titles.map((title, i) => ({
    id: idBase - i,
    title,
    oldPrice: womenPrices[i % womenPrices.length][0],
    price: womenPrices[i % womenPrices.length][1],
    colors: (i % 3) + 1,
    status: "PRE-BOOK",
  }));
}

export const sections = [
  {
    title: "Ready Stock",
    href: "/frontEnd/ready-stock",
    products: readyStock.map(([title, oldPrice, price], i) => ({
      id: 1153 - i,
      title,
      oldPrice,
      price,
      colors: 1,
      status: "IN-STOCK",
    })),
  },
  {
    title: "Women shoes collection",
    href: "/frontEnd/women-shoes-collection",
    products: buildProducts(womenShoes, 1112),
  },
  {
    title: "Slipper",
    href: "/frontEnd/slipper",
    products: buildProducts(slipper, 1046),
  },
  {
    title: "Block Heels",
    href: "/frontEnd/block-heels",
    products: buildProducts(blockHeels, 986),
  },
];

export const navLinks = [
  { label: "Home", href: "/", active: true },
  { label: "Shop", href: "/frontEnd/shop" },
  { label: "About Us", href: "/frontEnd/about_us" },
];

export const footerBoxes = [
  {
    heading: "shop",
    links: [
      { label: "All Products", href: "/frontEnd/shop" },
      { label: "New Arrivals", href: "/" },
      { label: "Best Sellers", href: "/" },
    ],
  },
  {
    heading: "support",
    links: [
      { label: "Privacy Policy", href: "/frontEnd/privacy_policy" },
      { label: "Returns & Exchanges", href: "/frontEnd/return_policy" },
      { label: "Size Guide", href: "/size-guide" },
    ],
  },
  {
    heading: "company",
    links: [
      { label: "About Us", href: "/frontEnd/about_us" },
      { label: "Our Story", href: "/" },
      { label: "Careers", href: "/" },
    ],
  },
];
