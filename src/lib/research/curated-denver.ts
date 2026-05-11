/**
 * Curated seed list of confirmed Denver Metro businesses with public
 * websites. This is the **guaranteed source** the free-mode research
 * script always has access to — works regardless of whether OSM
 * Overpass / Vercel outbound restrictions are blocking external
 * discovery APIs.
 *
 * Each entry is a real, publicly-known business with operations in the
 * Denver Metro 6-county area. Domains are root domains (no scheme,
 * no path) so the scraper + MX-validator can latch onto them directly.
 *
 * No street addresses or phone numbers — those are filled in by the
 * scrape pass (or surfaced as `address=null` if the website doesn't
 * list them, which is fine for the operator to backfill in /leads/[id]).
 */

import type { Industry } from "./score";

export type CuratedEntry = {
  name: string;
  industry: Industry;
  /** Root domain, no scheme, no www. */
  domain: string;
  /**
   * Local-part for the contact email (e.g. "procurement" → procurement@domain).
   * Defaults to "info" when omitted. Tuned per business type so the message
   * lands in the right inbox — procurement for big-box, dispatch for
   * brokers/3PL, orders for restaurants, contact for everyone else.
   */
  emailLocal?: string;
  /** Hint for refrigeration tagging when industry alone doesn't decide. */
  refrigerated?: boolean;
  /** Hint for the chain-store branch (skips email enrichment). */
  chain?: boolean;
};

export const CURATED_DENVER: CuratedEntry[] = [
  // ── Big-box retail (national chains with confirmed Denver Metro stores) ─
  { name: "The Home Depot", industry: "bigbox", domain: "homedepot.com", chain: true },
  { name: "Lowe's", industry: "bigbox", domain: "lowes.com", chain: true },
  { name: "Walmart", industry: "bigbox", domain: "walmart.com", chain: true },
  { name: "Target", industry: "bigbox", domain: "target.com", chain: true },
  { name: "Costco Wholesale", industry: "bigbox", domain: "costco.com", chain: true },
  { name: "Sam's Club", industry: "bigbox", domain: "samsclub.com", chain: true },
  { name: "Best Buy", industry: "bigbox", domain: "bestbuy.com", chain: true },
  { name: "IKEA", industry: "bigbox", domain: "ikea.com", chain: true },
  { name: "Office Depot", industry: "bigbox", domain: "officedepot.com", chain: true },
  { name: "Staples", industry: "bigbox", domain: "staples.com", chain: true },
  { name: "Harbor Freight Tools", industry: "bigbox", domain: "harborfreight.com", chain: true },
  { name: "Tractor Supply", industry: "bigbox", domain: "tractorsupply.com", chain: true },

  // ── Grocery & specialty food (refrigerated freight) ──────────────────
  { name: "King Soopers", industry: "smallbiz", domain: "kingsoopers.com", refrigerated: true, chain: true },
  { name: "Safeway", industry: "smallbiz", domain: "safeway.com", refrigerated: true, chain: true },
  { name: "Whole Foods Market", industry: "smallbiz", domain: "wholefoodsmarket.com", refrigerated: true, chain: true },
  { name: "Trader Joe's", industry: "smallbiz", domain: "traderjoes.com", refrigerated: true, chain: true },
  { name: "Sprouts Farmers Market", industry: "smallbiz", domain: "sprouts.com", refrigerated: true, chain: true },
  { name: "Natural Grocers", industry: "smallbiz", domain: "naturalgrocers.com", refrigerated: true },
  { name: "H Mart", industry: "smallbiz", domain: "hmart.com", refrigerated: true, chain: true },

  // ── Restaurants & food service (regional/national chains in CO) ──────
  { name: "Cracker Barrel", industry: "restaurants", domain: "crackerbarrel.com", refrigerated: true, chain: true },
  { name: "Snooze A.M. Eatery", industry: "restaurants", domain: "snoozeeatery.com", refrigerated: true },
  { name: "Illegal Pete's", industry: "restaurants", domain: "illegalpetes.com", refrigerated: true },
  { name: "Tokyo Joe's", industry: "restaurants", domain: "tokyojoes.com", refrigerated: true },
  { name: "Modern Market Eatery", industry: "restaurants", domain: "modernmarket.com", refrigerated: true },
  { name: "Smashburger", industry: "restaurants", domain: "smashburger.com", refrigerated: true },
  { name: "Noodles & Company", industry: "restaurants", domain: "noodles.com", refrigerated: true },
  { name: "Chipotle Mexican Grill", industry: "restaurants", domain: "chipotle.com", refrigerated: true, chain: true },
  { name: "Quiznos", industry: "restaurants", domain: "quiznos.com", refrigerated: true },
  { name: "Five Guys", industry: "restaurants", domain: "fiveguys.com", refrigerated: true, chain: true },
  { name: "Jimmy John's", industry: "restaurants", domain: "jimmyjohns.com", refrigerated: true, chain: true },
  { name: "Jersey Mike's Subs", industry: "restaurants", domain: "jerseymikes.com", refrigerated: true, chain: true },
  { name: "Panda Express", industry: "restaurants", domain: "pandaexpress.com", refrigerated: true, chain: true },
  { name: "Chick-fil-A", industry: "restaurants", domain: "chick-fil-a.com", refrigerated: true, chain: true },
  { name: "Texas Roadhouse", industry: "restaurants", domain: "texasroadhouse.com", refrigerated: true, chain: true },
  { name: "Olive Garden", industry: "restaurants", domain: "olivegarden.com", refrigerated: true, chain: true },
  { name: "Applebee's", industry: "restaurants", domain: "applebees.com", refrigerated: true, chain: true },
  { name: "IHOP", industry: "restaurants", domain: "ihop.com", refrigerated: true, chain: true },
  { name: "Denny's", industry: "restaurants", domain: "dennys.com", refrigerated: true, chain: true },
  { name: "Buffalo Wild Wings", industry: "restaurants", domain: "buffalowildwings.com", refrigerated: true, chain: true },
  { name: "Voodoo Doughnut", industry: "restaurants", domain: "voodoodoughnut.com", refrigerated: true },
  { name: "LaMar's Donuts", industry: "restaurants", domain: "lamars.com", refrigerated: true },

  // ── Freight brokers / 3PL (with Denver offices) ──────────────────────
  { name: "C.H. Robinson", industry: "brokers", domain: "chrobinson.com", chain: true },
  { name: "XPO Logistics", industry: "brokers", domain: "xpo.com", chain: true },
  { name: "J.B. Hunt Transport Services", industry: "brokers", domain: "jbhunt.com", chain: true },
  { name: "Schneider National", industry: "brokers", domain: "schneider.com", chain: true },
  { name: "Knight-Swift Transportation", industry: "brokers", domain: "knight-swift.com", chain: true },
  { name: "R+L Carriers", industry: "brokers", domain: "rlcarriers.com", chain: true },
  { name: "Old Dominion Freight Line", industry: "brokers", domain: "odfl.com", chain: true },
  { name: "Estes Express Lines", industry: "brokers", domain: "estes-express.com", chain: true },
  { name: "ArcBest", industry: "brokers", domain: "arcb.com", chain: true },
  { name: "Werner Enterprises", industry: "brokers", domain: "werner.com", chain: true },
  { name: "Echo Global Logistics", industry: "brokers", domain: "echo.com", chain: true },
  { name: "Coyote Logistics", industry: "brokers", domain: "coyote.com", chain: true },
  { name: "Total Quality Logistics (TQL)", industry: "brokers", domain: "tql.com", chain: true },

  // ── Construction supply / building materials ────────────────────────
  { name: "Ace Hardware", industry: "smallbiz", domain: "acehardware.com", chain: true },
  { name: "84 Lumber", industry: "smallbiz", domain: "84lumber.com", chain: true },
  { name: "Westlake Royal Building Products", industry: "smallbiz", domain: "westlakeroyalbuildingproducts.com" },
  { name: "Sherwin-Williams", industry: "smallbiz", domain: "sherwin-williams.com", chain: true },
  { name: "Behr Paint", industry: "smallbiz", domain: "behr.com" },
  { name: "Ferguson Plumbing Supply", industry: "smallbiz", domain: "ferguson.com", chain: true },
  { name: "Floor & Decor", industry: "smallbiz", domain: "flooranddecor.com", chain: true },

  // ── Auto parts / wholesale ──────────────────────────────────────────
  { name: "AutoZone", industry: "smallbiz", domain: "autozone.com", chain: true },
  { name: "O'Reilly Auto Parts", industry: "smallbiz", domain: "oreillyauto.com", chain: true },
  { name: "NAPA Auto Parts", industry: "smallbiz", domain: "napaonline.com", chain: true },
  { name: "Advance Auto Parts", industry: "smallbiz", domain: "advanceautoparts.com", chain: true },

  // ── Medical / pharma ────────────────────────────────────────────────
  { name: "Walgreens", industry: "smallbiz", domain: "walgreens.com", refrigerated: true, chain: true },
  { name: "CVS Pharmacy", industry: "smallbiz", domain: "cvs.com", refrigerated: true, chain: true },
  { name: "Rite Aid", industry: "smallbiz", domain: "riteaid.com", refrigerated: true, chain: true },

  // ── Outdoor / sporting goods ────────────────────────────────────────
  { name: "REI Co-op", industry: "smallbiz", domain: "rei.com", chain: true },
  { name: "Cabela's", industry: "smallbiz", domain: "cabelas.com", chain: true },
  { name: "Bass Pro Shops", industry: "smallbiz", domain: "basspro.com", chain: true },
  { name: "DICK'S Sporting Goods", industry: "smallbiz", domain: "dickssportinggoods.com", chain: true },
  { name: "Christy Sports", industry: "smallbiz", domain: "christysports.com" },

  // ── Manufacturing / wholesale (Colorado-based) ──────────────────────
  { name: "Vail Resorts", industry: "smallbiz", domain: "vailresorts.com" },
  { name: "Newmont Corporation", industry: "smallbiz", domain: "newmont.com" },
  { name: "Arrow Electronics", industry: "smallbiz", domain: "arrow.com" },
  { name: "Western Union", industry: "smallbiz", domain: "westernunion.com" },
  { name: "DISH Network", industry: "smallbiz", domain: "dish.com" },
  { name: "Ball Corporation", industry: "smallbiz", domain: "ball.com" },

  // ── Pet supply (refrigerated for fresh food) ────────────────────────
  { name: "Petco", industry: "smallbiz", domain: "petco.com", chain: true },
  { name: "PetSmart", industry: "smallbiz", domain: "petsmart.com", chain: true },

  // ── Additional big-box / retail (department + specialty stores) ─────
  { name: "Macy's", industry: "bigbox", domain: "macys.com", chain: true, emailLocal: "procurement" },
  { name: "Kohl's", industry: "bigbox", domain: "kohls.com", chain: true, emailLocal: "procurement" },
  { name: "TJ Maxx", industry: "bigbox", domain: "tjmaxx.tjx.com", chain: true, emailLocal: "procurement" },
  { name: "Marshalls", industry: "bigbox", domain: "marshalls.com", chain: true, emailLocal: "procurement" },
  { name: "HomeGoods", industry: "bigbox", domain: "homegoods.com", chain: true, emailLocal: "procurement" },
  { name: "Ross Dress for Less", industry: "bigbox", domain: "rossstores.com", chain: true, emailLocal: "procurement" },
  { name: "Burlington", industry: "bigbox", domain: "burlington.com", chain: true, emailLocal: "procurement" },
  { name: "Big Lots", industry: "bigbox", domain: "biglots.com", chain: true, emailLocal: "procurement" },
  { name: "Five Below", industry: "bigbox", domain: "fivebelow.com", chain: true, emailLocal: "procurement" },
  { name: "Dollar Tree", industry: "bigbox", domain: "dollartree.com", chain: true, emailLocal: "procurement" },
  { name: "Dollar General", industry: "bigbox", domain: "dollargeneral.com", chain: true, emailLocal: "procurement" },
  { name: "Michaels", industry: "bigbox", domain: "michaels.com", chain: true, emailLocal: "procurement" },
  { name: "Hobby Lobby", industry: "bigbox", domain: "hobbylobby.com", chain: true, emailLocal: "procurement" },
  { name: "JOANN Fabrics", industry: "bigbox", domain: "joann.com", chain: true, emailLocal: "procurement" },
  { name: "Barnes & Noble", industry: "bigbox", domain: "barnesandnoble.com", chain: true, emailLocal: "procurement" },
  { name: "Ashley HomeStore", industry: "bigbox", domain: "ashleyfurniture.com", chain: true, emailLocal: "procurement" },
  { name: "La-Z-Boy Furniture", industry: "bigbox", domain: "la-z-boy.com", chain: true, emailLocal: "procurement" },
  { name: "Crate & Barrel", industry: "bigbox", domain: "crateandbarrel.com", chain: true, emailLocal: "procurement" },
  { name: "Williams Sonoma", industry: "bigbox", domain: "williams-sonoma.com", chain: true, emailLocal: "procurement" },
  { name: "Pottery Barn", industry: "bigbox", domain: "potterybarn.com", chain: true, emailLocal: "procurement" },

  // ── Additional restaurants & food service (chain + regional) ─────────
  { name: "The Cheesecake Factory", industry: "restaurants", domain: "thecheesecakefactory.com", refrigerated: true, chain: true, emailLocal: "orders" },
  { name: "BJ's Restaurant", industry: "restaurants", domain: "bjsrestaurants.com", refrigerated: true, chain: true, emailLocal: "orders" },
  { name: "Outback Steakhouse", industry: "restaurants", domain: "outback.com", refrigerated: true, chain: true, emailLocal: "orders" },
  { name: "Red Lobster", industry: "restaurants", domain: "redlobster.com", refrigerated: true, chain: true, emailLocal: "orders" },
  { name: "Carrabba's Italian Grill", industry: "restaurants", domain: "carrabbas.com", refrigerated: true, chain: true, emailLocal: "orders" },
  { name: "Wingstop", industry: "restaurants", domain: "wingstop.com", refrigerated: true, chain: true, emailLocal: "orders" },
  { name: "Wendy's", industry: "restaurants", domain: "wendys.com", refrigerated: true, chain: true, emailLocal: "orders" },
  { name: "Sonic Drive-In", industry: "restaurants", domain: "sonicdrivein.com", refrigerated: true, chain: true, emailLocal: "orders" },
  { name: "Taco Bell", industry: "restaurants", domain: "tacobell.com", refrigerated: true, chain: true, emailLocal: "orders" },
  { name: "Del Taco", industry: "restaurants", domain: "deltaco.com", refrigerated: true, chain: true, emailLocal: "orders" },
  { name: "Wahoo's Fish Taco", industry: "restaurants", domain: "wahoos.com", refrigerated: true, emailLocal: "orders" },
  { name: "Maria Empanada", industry: "restaurants", domain: "mariaempanada.com", refrigerated: true, emailLocal: "orders" },
  { name: "Sushi Den", industry: "restaurants", domain: "sushiden.net", refrigerated: true, emailLocal: "orders" },
  { name: "Caribou Coffee", industry: "restaurants", domain: "cariboucoffee.com", refrigerated: true, chain: true, emailLocal: "orders" },
  { name: "Einstein Bros. Bagels", industry: "restaurants", domain: "einsteinbros.com", refrigerated: true, chain: true, emailLocal: "orders" },
  { name: "Bruegger's Bagels", industry: "restaurants", domain: "brueggers.com", refrigerated: true, chain: true, emailLocal: "orders" },
  { name: "Krispy Kreme", industry: "restaurants", domain: "krispykreme.com", refrigerated: true, chain: true, emailLocal: "orders" },
  { name: "Dairy Queen", industry: "restaurants", domain: "dairyqueen.com", refrigerated: true, chain: true, emailLocal: "orders" },
  { name: "Cold Stone Creamery", industry: "restaurants", domain: "coldstonecreamery.com", refrigerated: true, chain: true, emailLocal: "orders" },

  // ── Brokers / 3PL — additional regional carriers ────────────────────
  { name: "YRC Freight", industry: "brokers", domain: "yrc.com", chain: true, emailLocal: "dispatch" },
  { name: "Saia LTL Freight", industry: "brokers", domain: "saia.com", chain: true, emailLocal: "dispatch" },
  { name: "ABF Freight", industry: "brokers", domain: "abf.com", chain: true, emailLocal: "dispatch" },
  { name: "Forward Air", industry: "brokers", domain: "forwardair.com", chain: true, emailLocal: "dispatch" },
  { name: "Landstar System", industry: "brokers", domain: "landstar.com", chain: true, emailLocal: "dispatch" },
  { name: "Hub Group", industry: "brokers", domain: "hubgroup.com", chain: true, emailLocal: "dispatch" },
  { name: "Roadrunner Transportation", industry: "brokers", domain: "rrts.com", chain: true, emailLocal: "dispatch" },
  { name: "RXO Logistics", industry: "brokers", domain: "rxo.com", chain: true, emailLocal: "dispatch" },

  // ── Auto / vehicle services ─────────────────────────────────────────
  { name: "CarMax", industry: "smallbiz", domain: "carmax.com", chain: true, emailLocal: "procurement" },
  { name: "Carvana", industry: "smallbiz", domain: "carvana.com", chain: true, emailLocal: "procurement" },
  { name: "Pep Boys", industry: "smallbiz", domain: "pepboys.com", chain: true, emailLocal: "procurement" },
  { name: "Midas", industry: "smallbiz", domain: "midas.com", chain: true, emailLocal: "procurement" },
  { name: "Jiffy Lube", industry: "smallbiz", domain: "jiffylube.com", chain: true, emailLocal: "procurement" },
  { name: "Valvoline Instant Oil Change", industry: "smallbiz", domain: "vioc.com", chain: true, emailLocal: "procurement" },
  { name: "Firestone Complete Auto Care", industry: "smallbiz", domain: "firestonecompleteautocare.com", chain: true, emailLocal: "procurement" },

  // ── Construction / wholesale supply additional ──────────────────────
  { name: "Grainger Industrial Supply", industry: "smallbiz", domain: "grainger.com", chain: true, emailLocal: "procurement" },
  { name: "Fastenal", industry: "smallbiz", domain: "fastenal.com", chain: true, emailLocal: "procurement" },
  { name: "MSC Industrial Direct", industry: "smallbiz", domain: "mscdirect.com", chain: true, emailLocal: "procurement" },
  { name: "HD Supply", industry: "smallbiz", domain: "hdsupply.com", chain: true, emailLocal: "procurement" },
  { name: "Builders FirstSource", industry: "smallbiz", domain: "bldr.com", chain: true, emailLocal: "procurement" },
  { name: "ProBuild Holdings", industry: "smallbiz", domain: "probuild.com", chain: true, emailLocal: "procurement" },

  // ── Hospitality (large-volume supply receivers) ─────────────────────
  { name: "Marriott (Denver-area properties)", industry: "smallbiz", domain: "marriott.com", chain: true, refrigerated: true, emailLocal: "procurement" },
  { name: "Hilton (Denver-area properties)", industry: "smallbiz", domain: "hilton.com", chain: true, refrigerated: true, emailLocal: "procurement" },
  { name: "Hyatt (Denver-area properties)", industry: "smallbiz", domain: "hyatt.com", chain: true, refrigerated: true, emailLocal: "procurement" },
  { name: "IHG (Holiday Inn / Crowne Plaza)", industry: "smallbiz", domain: "ihg.com", chain: true, refrigerated: true, emailLocal: "procurement" },
  { name: "Wyndham Hotels", industry: "smallbiz", domain: "wyndhamhotels.com", chain: true, refrigerated: true, emailLocal: "procurement" },

  // ── Apparel / specialty retail (regular freight resupply) ───────────
  { name: "Old Navy", industry: "bigbox", domain: "oldnavy.gap.com", chain: true, emailLocal: "procurement" },
  { name: "Gap Inc.", industry: "bigbox", domain: "gap.com", chain: true, emailLocal: "procurement" },
  { name: "Nordstrom Rack", industry: "bigbox", domain: "nordstromrack.com", chain: true, emailLocal: "procurement" },
  { name: "Foot Locker", industry: "bigbox", domain: "footlocker.com", chain: true, emailLocal: "procurement" },
  { name: "Famous Footwear", industry: "bigbox", domain: "famousfootwear.com", chain: true, emailLocal: "procurement" },
  { name: "Lane Bryant", industry: "bigbox", domain: "lanebryant.com", chain: true, emailLocal: "procurement" },

  // ── Office / commercial supply (freight regulars) ───────────────────
  { name: "Quill (Staples wholesale)", industry: "smallbiz", domain: "quill.com", chain: true, emailLocal: "procurement" },
  { name: "Uline Shipping Supplies", industry: "smallbiz", domain: "uline.com", chain: true, emailLocal: "procurement" },
  { name: "Restaurant Depot", industry: "smallbiz", domain: "restaurantdepot.com", refrigerated: true, chain: true, emailLocal: "procurement" },
  { name: "Sysco Foods", industry: "smallbiz", domain: "sysco.com", refrigerated: true, chain: true, emailLocal: "procurement" },
  { name: "US Foods", industry: "smallbiz", domain: "usfoods.com", refrigerated: true, chain: true, emailLocal: "procurement" },
  { name: "Performance Food Group", industry: "smallbiz", domain: "pfgc.com", refrigerated: true, chain: true, emailLocal: "procurement" },
  { name: "Shamrock Foods", industry: "smallbiz", domain: "shamrockfoodservice.com", refrigerated: true, chain: true, emailLocal: "procurement" },

  // ── Construction / contractors (Denver Metro) ──────────────────────
  // High freight value: lumberyards, electrical/plumbing supply, GCs.
  { name: "84 Lumber", industry: "construction", domain: "84lumber.com", chain: true, emailLocal: "procurement" },
  { name: "Builders FirstSource", industry: "construction", domain: "bldr.com", chain: true, emailLocal: "procurement" },
  { name: "Alpine Lumber", industry: "construction", domain: "alpinelumber.com", emailLocal: "procurement" },
  { name: "ProBuild Holdings", industry: "construction", domain: "probuild.com", emailLocal: "procurement" },
  { name: "Ferguson Plumbing Supply", industry: "construction", domain: "ferguson.com", chain: true, emailLocal: "procurement" },
  { name: "HD Supply", industry: "construction", domain: "hdsupply.com", chain: true, emailLocal: "procurement" },
  { name: "Wagner Equipment", industry: "construction", domain: "wagnerequipment.com", emailLocal: "procurement" },
  { name: "Grainger Industrial Supply", industry: "construction", domain: "grainger.com", chain: true, emailLocal: "procurement" },
  { name: "Fastenal", industry: "construction", domain: "fastenal.com", chain: true, emailLocal: "procurement" },
  { name: "MSC Industrial Supply", industry: "construction", domain: "mscdirect.com", chain: true, emailLocal: "procurement" },
  { name: "Mountain States Specialty Co", industry: "construction", domain: "mountainstatesspecialty.com", emailLocal: "info" },
  { name: "Front Range Lumber", industry: "construction", domain: "frontrangelumber.com", emailLocal: "info" },
  { name: "Western States Cabinet Wholesalers", industry: "construction", domain: "wscw.com", emailLocal: "info" },
  { name: "Mountain View Electric Supply", industry: "construction", domain: "mvescolorado.com", emailLocal: "info" },
  { name: "Denver Wholesale Florist", industry: "construction", domain: "dwfwholesale.com", emailLocal: "orders" },

  // ── Cannabis (Colorado-specific, retail dispensaries + supply) ──────
  // CO cannabis has its own freight cadence: cultivation supply,
  // packaging, retail restocking, B2B distribution.
  { name: "Native Roots Cannabis", industry: "cannabis", domain: "nativeroots.com", emailLocal: "procurement" },
  { name: "The Green Solution", industry: "cannabis", domain: "tgscolorado.com", emailLocal: "procurement" },
  { name: "Sweet Leaf Marijuana", industry: "cannabis", domain: "sweetleafmarijuana.com", emailLocal: "procurement" },
  { name: "LivWell Enlightened Health", industry: "cannabis", domain: "livwell.com", emailLocal: "procurement" },
  { name: "Lightshade Labs", industry: "cannabis", domain: "lightshade.com", emailLocal: "procurement" },
  { name: "Medicine Man Denver", industry: "cannabis", domain: "medicinemandenver.com", emailLocal: "procurement" },
  { name: "Terrapin Care Station", industry: "cannabis", domain: "terrapincarestation.com", emailLocal: "procurement" },
  { name: "Strawberry Fields Cannabis", industry: "cannabis", domain: "strawberryfieldscolorado.com", emailLocal: "info" },
  { name: "Silver Stem Fine Cannabis", industry: "cannabis", domain: "silverstemcannabis.com", emailLocal: "info" },
  { name: "Cannabis Supply", industry: "cannabis", domain: "cannabissupply.com", emailLocal: "orders" },
];
