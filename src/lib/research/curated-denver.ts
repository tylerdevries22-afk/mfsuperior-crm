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
];
