/**
 * Curated seed list of confirmed Front Range businesses with public
 * websites. This is the **guaranteed source** the free-mode research
 * script always has access to — works regardless of whether OSM
 * Overpass / Vercel outbound restrictions are blocking external
 * discovery APIs.
 *
 * Coverage: Denver Metro 6-county (Denver, Adams, Arapahoe, Boulder,
 * Broomfield, Douglas, Jefferson), Boulder, Fort Collins, Loveland,
 * Greeley, Colorado Springs, Pueblo, and mountain resort towns
 * (Vail, Aspen, Telluride, Steamboat, Crested Butte, Estes Park,
 * Breckenridge). The list mixes national-chain Denver branches (top
 * section, kept for legacy compatibility) with a much larger block of
 * locally-owned independents added 2026-05 — the latter is the
 * higher-quality outreach target for a regional freight carrier.
 *
 * Each entry is a real, publicly-known business. Domains are root
 * domains (no scheme, no path) so the scraper + MX-validator can latch
 * onto them directly.
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

  // ╔════════════════════════════════════════════════════════════════╗
  // ║ FRONT RANGE INDEPENDENTS                                       ║
  // ║                                                                ║
  // ║ Locally-owned operators across Denver Metro + Boulder + Fort   ║
  // ║ Collins + Loveland + Greeley + Colorado Springs + mountain     ║
  // ║ resort towns. Skews to single-/multi-location independents     ║
  // ║ where the owner or GM is the right freight-outreach            ║
  // ║ decision-maker. National chains intentionally excluded — they  ║
  // ║ gate procurement corporate-side and rarely engage with cold    ║
  // ║ outbound from a regional carrier.                              ║
  // ╚════════════════════════════════════════════════════════════════╝

  // ── Denver independent restaurants & restaurant groups ──────────
  { name: "Root Down", industry: "restaurants", domain: "rootdownrestaurant.com", refrigerated: true, emailLocal: "orders" },
  { name: "Linger", industry: "restaurants", domain: "lingerdenver.com", refrigerated: true, emailLocal: "orders" },
  { name: "Ophelia's Electric Soapbox", industry: "restaurants", domain: "opheliasdenver.com", refrigerated: true, emailLocal: "orders" },
  { name: "El Five", industry: "restaurants", domain: "elfivedenver.com", refrigerated: true, emailLocal: "orders" },
  { name: "Vital Root", industry: "restaurants", domain: "vitalrootdenver.com", refrigerated: true, emailLocal: "orders" },
  { name: "Sam's No. 3", industry: "restaurants", domain: "samsno3.com", refrigerated: true, emailLocal: "orders" },
  { name: "Cherry Cricket", industry: "restaurants", domain: "cherrycricket.com", refrigerated: true, emailLocal: "orders" },
  { name: "Park Burger", industry: "restaurants", domain: "parkburger.com", refrigerated: true, emailLocal: "orders" },
  { name: "Highland Tap & Burger", industry: "restaurants", domain: "tapandburger.com", refrigerated: true, emailLocal: "orders" },
  { name: "Steuben's", industry: "restaurants", domain: "steubens.com", refrigerated: true, emailLocal: "orders" },
  { name: "City O' City", industry: "restaurants", domain: "cityocitydenver.com", refrigerated: true, emailLocal: "orders" },
  { name: "Watercourse Foods", industry: "restaurants", domain: "watercoursefoods.com", refrigerated: true, emailLocal: "orders" },
  { name: "Avanti Food & Beverage", industry: "restaurants", domain: "avantifandb.com", refrigerated: true, emailLocal: "orders" },
  { name: "Mercantile Dining & Provision", industry: "restaurants", domain: "mercantiledenver.com", refrigerated: true, emailLocal: "orders" },
  { name: "Tavernetta", industry: "restaurants", domain: "tavernettadenver.com", refrigerated: true, emailLocal: "orders" },
  { name: "Pizzeria Locale", industry: "restaurants", domain: "pizzerialocale.com", refrigerated: true, emailLocal: "orders" },
  { name: "Annette", industry: "restaurants", domain: "annettescratchtotable.com", refrigerated: true, emailLocal: "orders" },
  { name: "Hop Alley", industry: "restaurants", domain: "hopalleydenver.com", refrigerated: true, emailLocal: "orders" },
  { name: "ChoLon Modern Asian", industry: "restaurants", domain: "cholon.com", refrigerated: true, emailLocal: "orders" },
  { name: "Sushi Sasa", industry: "restaurants", domain: "sushisasa.com", refrigerated: true, emailLocal: "orders" },
  { name: "Beast + Bottle", industry: "restaurants", domain: "beastandbottle.com", refrigerated: true, emailLocal: "orders" },
  { name: "Coperta", industry: "restaurants", domain: "copertadenver.com", refrigerated: true, emailLocal: "orders" },
  { name: "Domo Restaurant", industry: "restaurants", domain: "domorestaurant.com", refrigerated: true, emailLocal: "orders" },
  { name: "Mizuna", industry: "restaurants", domain: "mizunadenver.com", refrigerated: true, emailLocal: "orders" },
  { name: "Fruition Restaurant", industry: "restaurants", domain: "fruitionrestaurant.com", refrigerated: true, emailLocal: "orders" },
  { name: "The Kitchen Restaurant Group", industry: "restaurants", domain: "thekitchen.com", refrigerated: true, emailLocal: "orders" },
  { name: "Casa Bonita", industry: "restaurants", domain: "casabonitadenver.com", refrigerated: true, emailLocal: "orders" },
  { name: "Work & Class", industry: "restaurants", domain: "workandclassdenver.com", refrigerated: true, emailLocal: "orders" },
  { name: "Ace Eat Serve", industry: "restaurants", domain: "aceeatserve.com", refrigerated: true, emailLocal: "orders" },
  { name: "White Pie", industry: "restaurants", domain: "whitepiedenver.com", refrigerated: true, emailLocal: "orders" },
  { name: "The Plimoth", industry: "restaurants", domain: "theplimoth.com", refrigerated: true, emailLocal: "orders" },
  { name: "Bonanno Concepts", industry: "restaurants", domain: "bonannoconcepts.com", refrigerated: true, emailLocal: "orders" },
  { name: "Cart-Driver", industry: "restaurants", domain: "cart-driver.com", refrigerated: true, emailLocal: "orders" },
  { name: "Tacos Tequila Whiskey", industry: "restaurants", domain: "tacostequilawhiskey.com", refrigerated: true, emailLocal: "orders" },
  { name: "Vesta", industry: "restaurants", domain: "vestadenver.com", refrigerated: true, emailLocal: "orders" },
  { name: "Spuntino", industry: "restaurants", domain: "spuntinodenver.com", refrigerated: true, emailLocal: "orders" },
  { name: "Pete's Kitchen", industry: "restaurants", domain: "peteskitchencolfax.com", refrigerated: true, emailLocal: "orders" },
  { name: "Bigsby's Folly Winery", industry: "restaurants", domain: "bigsbysfolly.com", refrigerated: true, emailLocal: "orders" },

  // ── Boulder / Fort Collins independent restaurants ──────────────
  { name: "Frasca Food and Wine", industry: "restaurants", domain: "frascafoodandwine.com", refrigerated: true, emailLocal: "orders" },
  { name: "Mountain Sun Pub & Brewery", industry: "restaurants", domain: "mountainsunpub.com", refrigerated: true, emailLocal: "orders" },
  { name: "Black Cat Bistro", industry: "restaurants", domain: "blackcatboulder.com", refrigerated: true, emailLocal: "orders" },
  { name: "Bramble & Hare", industry: "restaurants", domain: "brambleandhare.com", refrigerated: true, emailLocal: "orders" },
  { name: "River and Woods", industry: "restaurants", domain: "riverandwoods.com", refrigerated: true, emailLocal: "orders" },
  { name: "The Mediterranean Restaurant", industry: "restaurants", domain: "themedboulder.com", refrigerated: true, emailLocal: "orders" },
  { name: "Acreage by Stem Ciders", industry: "restaurants", domain: "acreageco.com", refrigerated: true, emailLocal: "orders" },
  { name: "Pizza Casbah", industry: "restaurants", domain: "pizzacasbah.com", refrigerated: true, emailLocal: "orders" },
  { name: "Coopersmith's Pub & Brewing", industry: "restaurants", domain: "coopersmithspub.com", refrigerated: true, emailLocal: "orders" },

  // ── Colorado Springs / Pueblo independent restaurants ──────────
  { name: "The Famous Steakhouse", industry: "restaurants", domain: "thefamoussteakhouse.net", refrigerated: true, emailLocal: "orders" },
  { name: "Adam's Mountain Cafe", industry: "restaurants", domain: "adamsmountain.com", refrigerated: true, emailLocal: "orders" },
  { name: "Walter's Bistro", industry: "restaurants", domain: "waltersbistro.com", refrigerated: true, emailLocal: "orders" },
  { name: "The Margarita at PineCreek", industry: "restaurants", domain: "margaritaatpinecreek.com", refrigerated: true, emailLocal: "orders" },

  // ── Front Range craft breweries ─────────────────────────────────
  { name: "Wynkoop Brewing Company", industry: "smallbiz", domain: "wynkoop.com", refrigerated: true, emailLocal: "orders" },
  { name: "Great Divide Brewing", industry: "smallbiz", domain: "greatdivide.com", refrigerated: true, emailLocal: "orders" },
  { name: "Renegade Brewing", industry: "smallbiz", domain: "renegadebrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Black Shirt Brewing", industry: "smallbiz", domain: "blackshirtbrewingco.com", refrigerated: true, emailLocal: "orders" },
  { name: "Crooked Stave Artisan Beer", industry: "smallbiz", domain: "crookedstave.com", refrigerated: true, emailLocal: "orders" },
  { name: "Cerebral Brewing", industry: "smallbiz", domain: "cerebralbrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Ratio Beerworks", industry: "smallbiz", domain: "ratiobeerworks.com", refrigerated: true, emailLocal: "orders" },
  { name: "TRVE Brewing", industry: "smallbiz", domain: "trvebrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Comrade Brewing", industry: "smallbiz", domain: "comradebrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Spangalang Brewery", industry: "smallbiz", domain: "spangalangbrewery.com", refrigerated: true, emailLocal: "orders" },
  { name: "Mockery Brewing", industry: "smallbiz", domain: "mockerybrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Diebolt Brewing", industry: "smallbiz", domain: "dieboltbrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Joyride Brewing", industry: "smallbiz", domain: "joyridebrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Goldspot Brewing", industry: "smallbiz", domain: "goldspotbrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Bull & Bush Brewery", industry: "smallbiz", domain: "bullandbush.com", refrigerated: true, emailLocal: "orders" },
  { name: "Strange Craft Beer Company", industry: "smallbiz", domain: "strangecraft.com", refrigerated: true, emailLocal: "orders" },
  { name: "4 Noses Brewing", industry: "smallbiz", domain: "4nosesbrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Westbound & Down Brewing", industry: "smallbiz", domain: "westboundanddown.com", refrigerated: true, emailLocal: "orders" },
  { name: "New Image Brewing", industry: "smallbiz", domain: "newimagebrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Avery Brewing", industry: "smallbiz", domain: "averybrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Upslope Brewing", industry: "smallbiz", domain: "upslopebrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Sanitas Brewing", industry: "smallbiz", domain: "sanitasbrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Twisted Pine Brewing", industry: "smallbiz", domain: "twistedpinebrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Asher Brewing", industry: "smallbiz", domain: "asherbrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Wibby Brewing", industry: "smallbiz", domain: "wibbybrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Oskar Blues Brewery", industry: "smallbiz", domain: "oskarblues.com", refrigerated: true, emailLocal: "orders" },
  { name: "Left Hand Brewing", industry: "smallbiz", domain: "lefthandbrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Grimm Brothers Brewhouse", industry: "smallbiz", domain: "grimmbrosbrewhouse.com", refrigerated: true, emailLocal: "orders" },
  { name: "New Belgium Brewing", industry: "smallbiz", domain: "newbelgium.com", refrigerated: true, emailLocal: "orders" },
  { name: "Odell Brewing", industry: "smallbiz", domain: "odellbrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Funkwerks", industry: "smallbiz", domain: "funkwerks.com", refrigerated: true, emailLocal: "orders" },
  { name: "Equinox Brewing", industry: "smallbiz", domain: "equinoxbrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Horse & Dragon Brewing", industry: "smallbiz", domain: "horseanddragonbrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Black Bottle Brewery", industry: "smallbiz", domain: "blackbottlebrewery.com", refrigerated: true, emailLocal: "orders" },
  { name: "WeldWerks Brewing", industry: "smallbiz", domain: "weldwerksbrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Bristol Brewing", industry: "smallbiz", domain: "bristolbrewing.com", refrigerated: true, emailLocal: "orders" },
  { name: "Phantom Canyon Brewing", industry: "smallbiz", domain: "phantomcanyon.com", refrigerated: true, emailLocal: "orders" },
  { name: "Trinity Brewing", industry: "smallbiz", domain: "trinitybrew.com", refrigerated: true, emailLocal: "orders" },

  // ── Distilleries & wineries ─────────────────────────────────────
  { name: "Stranahan's Colorado Whiskey", industry: "smallbiz", domain: "stranahans.com", emailLocal: "orders" },
  { name: "Mile High Spirits", industry: "smallbiz", domain: "milehighspirits.com", emailLocal: "orders" },
  { name: "Family Jones Spirit House", industry: "smallbiz", domain: "thefamilyjones.co", emailLocal: "orders" },
  { name: "Leopold Bros. Distillery", industry: "smallbiz", domain: "leopoldbros.com", emailLocal: "orders" },
  { name: "Bear Creek Distillery", industry: "smallbiz", domain: "bearcreekdistillery.com", emailLocal: "orders" },
  { name: "Boulder Spirits", industry: "smallbiz", domain: "boulderspirits.com", emailLocal: "orders" },
  { name: "Spirit Hound Distillers", industry: "smallbiz", domain: "spirithounds.com", emailLocal: "orders" },
  { name: "Distillery 291", industry: "smallbiz", domain: "distillery291.com", emailLocal: "orders" },
  { name: "Talnua Distillery", industry: "smallbiz", domain: "talnua.com", emailLocal: "orders" },
  { name: "Carboy Winery", industry: "smallbiz", domain: "carboywinery.com", emailLocal: "orders" },
  { name: "Balistreri Vineyards", industry: "smallbiz", domain: "balistrerivineyards.com", emailLocal: "orders" },

  // ── Specialty coffee roasters (B2B wholesale + cafés) ───────────
  { name: "Novo Coffee", industry: "smallbiz", domain: "novocoffee.com", refrigerated: true, emailLocal: "orders" },
  { name: "Corvus Coffee Roasters", industry: "smallbiz", domain: "corvuscoffee.com", refrigerated: true, emailLocal: "orders" },
  { name: "Pablo's Coffee", industry: "smallbiz", domain: "pabloscoffee.com", refrigerated: true, emailLocal: "orders" },
  { name: "Sweet Bloom Coffee Roasters", industry: "smallbiz", domain: "sweetbloomcoffee.com", refrigerated: true, emailLocal: "orders" },
  { name: "Boxcar Coffee Roasters", industry: "smallbiz", domain: "boxcarcoffeeroasters.com", refrigerated: true, emailLocal: "orders" },
  { name: "Ozo Coffee", industry: "smallbiz", domain: "ozocoffee.com", refrigerated: true, emailLocal: "orders" },
  { name: "Allegro Coffee Roasters", industry: "smallbiz", domain: "allegrocoffee.com", refrigerated: true, emailLocal: "orders" },
  { name: "Conscious Coffees", industry: "smallbiz", domain: "consciouscoffees.com", refrigerated: true, emailLocal: "orders" },
  { name: "Kaladi Coffee Roasters", industry: "smallbiz", domain: "kaladicoffee.com", refrigerated: true, emailLocal: "orders" },
  { name: "Solar Roast Coffee", industry: "smallbiz", domain: "solarroast.com", refrigerated: true, emailLocal: "orders" },

  // ── Bakeries / specialty food / artisan markets ─────────────────
  { name: "Rheinlander Bakery", industry: "restaurants", domain: "rheinlanderbakery.com", refrigerated: true, emailLocal: "orders" },
  { name: "Tony's Market", industry: "smallbiz", domain: "tonysmarket.com", refrigerated: true, emailLocal: "orders" },
  { name: "Marczyk Fine Foods", industry: "smallbiz", domain: "marczykfinefoods.com", refrigerated: true, emailLocal: "orders" },
  { name: "Babettes Artisan Breads", industry: "restaurants", domain: "babettesbakery.com", refrigerated: true, emailLocal: "orders" },
  { name: "Trompeau Bakery", industry: "restaurants", domain: "trompeaubakery.com", refrigerated: true, emailLocal: "orders" },
  { name: "Cured", industry: "smallbiz", domain: "curedboulder.com", refrigerated: true, emailLocal: "orders" },
  { name: "The Truffle Cheese Shop", industry: "smallbiz", domain: "trufflecheese.com", refrigerated: true, emailLocal: "orders" },
  { name: "Mondo Vino", industry: "smallbiz", domain: "mondovino.com", refrigerated: true, emailLocal: "orders" },
  { name: "The Real Dill", industry: "smallbiz", domain: "therealdill.com", refrigerated: true, emailLocal: "orders" },
  { name: "Polidori Sausage", industry: "smallbiz", domain: "polidorisausage.com", refrigerated: true, emailLocal: "orders" },
  { name: "Continental Sausage", industry: "smallbiz", domain: "continental-sausage.com", refrigerated: true, emailLocal: "orders" },

  // ── Independent caterers / event food ───────────────────────────
  { name: "Three Tomatoes Catering", industry: "restaurants", domain: "threetomatoescatering.com", refrigerated: true, emailLocal: "orders" },
  { name: "Catering by Design", industry: "restaurants", domain: "cateringbydesign.com", refrigerated: true, emailLocal: "orders" },
  { name: "Footers Catering", industry: "restaurants", domain: "footerscatering.com", refrigerated: true, emailLocal: "orders" },
  { name: "Biscuits & Berries", industry: "restaurants", domain: "biscuitsandberries.com", refrigerated: true, emailLocal: "orders" },
  { name: "Occasions Catering", industry: "restaurants", domain: "occasionscatering.com", refrigerated: true, emailLocal: "orders" },
  { name: "A Spice of Life", industry: "restaurants", domain: "aspiceoflife.com", refrigerated: true, emailLocal: "orders" },

  // ── Independent CO general contractors / construction managers ──
  { name: "Saunders Construction", industry: "construction", domain: "saundersci.com", emailLocal: "procurement" },
  { name: "Catamount Constructors", industry: "construction", domain: "catamountinc.com", emailLocal: "procurement" },
  { name: "Haselden Construction", industry: "construction", domain: "haselden.com", emailLocal: "procurement" },
  { name: "Hyder Construction", industry: "construction", domain: "hyderconstruction.com", emailLocal: "procurement" },
  { name: "Pinkard Construction", industry: "construction", domain: "pinkardcc.com", emailLocal: "procurement" },
  { name: "GE Johnson Construction", industry: "construction", domain: "gejohnson.com", emailLocal: "procurement" },
  { name: "Calcon Constructors", industry: "construction", domain: "calconconstructors.com", emailLocal: "procurement" },
  { name: "Drahota Commercial", industry: "construction", domain: "drahotacommercial.com", emailLocal: "procurement" },
  { name: "Bryan Construction", industry: "construction", domain: "bryanconstruction.com", emailLocal: "procurement" },
  { name: "Adolfson & Peterson Construction", industry: "construction", domain: "a-p.com", emailLocal: "procurement" },
  { name: "Mortenson Construction", industry: "construction", domain: "mortenson.com", emailLocal: "procurement" },
  { name: "Brinkmann Constructors", industry: "construction", domain: "brinkmannconstructors.com", emailLocal: "procurement" },
  { name: "PCL Construction", industry: "construction", domain: "pcl.com", emailLocal: "procurement" },

  // ── Heavy equipment / industrial dealers (CO-based) ─────────────
  { name: "Wagner Equipment Co.", industry: "construction", domain: "wagnerequipment.com", emailLocal: "procurement" },
  { name: "Honnen Equipment", industry: "construction", domain: "honnen.com", emailLocal: "procurement" },
  { name: "4 Rivers Equipment", industry: "construction", domain: "4riversequipment.com", emailLocal: "procurement" },
  { name: "Power Motive Corporation", industry: "construction", domain: "pmccolorado.com", emailLocal: "procurement" },
  { name: "Faris Machinery", industry: "construction", domain: "farismachinery.com", emailLocal: "procurement" },

  // ── Construction supply (lumber / concrete / masonry) ───────────
  { name: "Front Range Lumber", industry: "construction", domain: "frontrangelumber.com", emailLocal: "procurement" },
  { name: "Stock Building Supply", industry: "construction", domain: "stockbuildingsupply.com", emailLocal: "procurement" },
  { name: "Brannan Companies", industry: "construction", domain: "brannancos.com", emailLocal: "procurement" },
  { name: "Aggregate Industries", industry: "construction", domain: "aggregate-us.com", emailLocal: "procurement" },
  { name: "Castle Rock Construction", industry: "construction", domain: "castlerockcc.com", emailLocal: "procurement" },

  // ── Boutique / historic hotels ──────────────────────────────────
  { name: "The Brown Palace Hotel", industry: "smallbiz", domain: "brownpalace.com", refrigerated: true, emailLocal: "purchasing" },
  { name: "The Crawford Hotel", industry: "smallbiz", domain: "thecrawfordhotel.com", refrigerated: true, emailLocal: "purchasing" },
  { name: "Hotel Boulderado", industry: "smallbiz", domain: "boulderado.com", refrigerated: true, emailLocal: "purchasing" },
  { name: "The Stanley Hotel", industry: "smallbiz", domain: "stanleyhotel.com", refrigerated: true, emailLocal: "purchasing" },
  { name: "The Broadmoor", industry: "smallbiz", domain: "broadmoor.com", refrigerated: true, emailLocal: "purchasing" },
  { name: "The Cliff House at Pikes Peak", industry: "smallbiz", domain: "thecliffhouse.com", refrigerated: true, emailLocal: "purchasing" },
  { name: "Sonnenalp Hotel", industry: "smallbiz", domain: "sonnenalp.com", refrigerated: true, emailLocal: "purchasing" },
  { name: "Hotel Talisa", industry: "smallbiz", domain: "hoteltalisa.com", refrigerated: true, emailLocal: "purchasing" },
  { name: "Manor Vail Lodge", industry: "smallbiz", domain: "manorvail.com", refrigerated: true, emailLocal: "purchasing" },
  { name: "The Little Nell", industry: "smallbiz", domain: "thelittlenell.com", refrigerated: true, emailLocal: "purchasing" },
  { name: "Beaver Run Resort", industry: "smallbiz", domain: "beaverrun.com", refrigerated: true, emailLocal: "purchasing" },

  // ── Mountain ski areas & resort operators ──────────────────────
  { name: "Aspen Skiing Company", industry: "smallbiz", domain: "aspensnowmass.com", refrigerated: true, emailLocal: "purchasing" },
  { name: "Steamboat Ski Resort", industry: "smallbiz", domain: "steamboat.com", refrigerated: true, emailLocal: "purchasing" },
  { name: "Arapahoe Basin (A-Basin)", industry: "smallbiz", domain: "arapahoebasin.com", refrigerated: true, emailLocal: "purchasing" },
  { name: "Winter Park Resort", industry: "smallbiz", domain: "winterparkresort.com", refrigerated: true, emailLocal: "purchasing" },
  { name: "Eldora Mountain Resort", industry: "smallbiz", domain: "eldora.com", refrigerated: true, emailLocal: "purchasing" },
  { name: "Crested Butte Mountain Resort", industry: "smallbiz", domain: "skicb.com", refrigerated: true, emailLocal: "purchasing" },
  { name: "Telluride Ski Resort", industry: "smallbiz", domain: "tellurideskiresort.com", refrigerated: true, emailLocal: "purchasing" },
  { name: "Wolf Creek Ski Area", industry: "smallbiz", domain: "wolfcreekski.com", emailLocal: "purchasing" },
  { name: "Loveland Ski Area", industry: "smallbiz", domain: "skiloveland.com", emailLocal: "purchasing" },
  { name: "Echo Mountain", industry: "smallbiz", domain: "echomtn.com", emailLocal: "purchasing" },

  // ── Independent retail (book / outdoor / specialty) ─────────────
  { name: "Tattered Cover Book Store", industry: "smallbiz", domain: "tatteredcover.com", emailLocal: "procurement" },
  { name: "Boulder Book Store", industry: "smallbiz", domain: "boulderbookstore.com", emailLocal: "procurement" },
  { name: "BookBar", industry: "smallbiz", domain: "bookbardenver.com", emailLocal: "procurement" },
  { name: "The Wizard's Chest", industry: "smallbiz", domain: "wizardschest.com", emailLocal: "procurement" },
  { name: "Topo Designs", industry: "smallbiz", domain: "topodesigns.com", emailLocal: "procurement" },
  { name: "Wilderness Exchange", industry: "smallbiz", domain: "wildernessx.com", emailLocal: "procurement" },
  { name: "McGuckin Hardware", industry: "smallbiz", domain: "mcguckin.com", emailLocal: "procurement" },
  { name: "Boulder Cycle Sport", industry: "smallbiz", domain: "bouldercyclesport.com", emailLocal: "procurement" },
  { name: "Backcountry Access (BCA)", industry: "smallbiz", domain: "backcountryaccess.com", emailLocal: "procurement" },
  { name: "Smartwool", industry: "smallbiz", domain: "smartwool.com", emailLocal: "procurement" },
  { name: "Eldorado Climbing Walls", industry: "smallbiz", domain: "eldoclimbing.com", emailLocal: "procurement" },
  { name: "Ute Mountaineer", industry: "smallbiz", domain: "utemountaineer.com", emailLocal: "procurement" },
];
