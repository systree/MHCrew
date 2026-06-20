// Cube sheet — estimated volume per item in cubic metres (m³).
//
// AUSTRALIAN MARKET: figures are drawn from typical Australian removalist cube
// sheets and reflect the practical truck space an item occupies when loaded
// (not just its raw bounding box). m³ is the unit AU movers use to size trucks.
//
// These are estimates only. The list is to brief the operator/manager BEFORE they
// call the client to quote — it is not a binding measurement. The operator confirms
// on the call. Items in VARIABLE_ITEMS differ a lot in real life (size/qty), so
// treat their figures as rough.
//
// Keys MUST match the exact item name strings in `categories.ts`. When you add an
// item there, add its volume here too. Any unmapped item falls back to
// DEFAULT_ITEM_VOLUME_M3 so totals never silently read as zero.

export const itemVolumesM3: Record<string, number> = {
  // Bedrooms
  'King Bed (frame + mattress)': 1.6,
  'Queen Bed (frame + mattress)': 1.2,
  'Double Bed (frame + mattress)': 1.0,
  'King Single Bed (frame + mattress)': 0.85,
  'Single Bed (frame + mattress)': 0.7,
  'Bunk Bed': 1.2,
  'Mattress (spare)': 0.4,
  'Bedside Table': 0.15,
  'Tallboy / Dresser': 0.6,
  'Wardrobe (freestanding)': 1.0,
  'Mirror (large)': 0.1,
  'Blanket Box': 0.25,
  'Cot / Baby Bed': 0.5,
  'Change Table': 0.4,
  'TV (bedroom)': 0.1,
  'TV Stand (bedroom)': 0.3,

  // Lounge & Living
  '3-Seater Sofa': 1.4,
  '2-Seater Sofa': 1.0,
  'Armchair / Recliner': 0.7,
  'Sofa Bed': 1.3,
  'Ottoman / Footstool': 0.2,
  'Coffee Table': 0.3,
  'TV Unit / Entertainment Unit': 0.6,
  'TV (main)': 0.15,
  'Bookcase / Shelving Unit': 0.5,
  'Display Cabinet': 0.7,
  'Side Table': 0.15,
  'Rug (large)': 0.15,
  'Floor Lamp': 0.1,
  'Pedestal / Standing Fan': 0.1,
  'Portable Air Conditioner': 0.2,
  'Bar Fridge': 0.25,

  // Dining
  'Dining Table (6+ seater)': 0.8,
  'Dining Table (4 seater)': 0.5,
  'Dining Chairs': 0.15,
  'Bar Stools': 0.12,
  'High Chair': 0.15,
  'Buffet / Sideboard': 0.7,
  'China Cabinet / Hutch': 0.9,

  // Kitchen
  'Fridge (large, French door)': 0.9,
  'Fridge (medium)': 0.6,
  'Chest Freezer': 0.6,
  'Upright Freezer': 0.5,
  'Dishwasher': 0.3,
  'Microwave': 0.08,
  'Small Appliances (box)': 0.06,
  'Bar Fridge / Wine Fridge': 0.3,

  // Laundry
  'Washing Machine': 0.35,
  'Dryer': 0.3,
  'Laundry Trough (freestanding)': 0.2,
  'Ironing Board': 0.08,
  'Clothes Airer / Horse': 0.1,
  'Laundry Hamper / Basket': 0.08,
  'Vacuum Cleaner': 0.1,

  // Home Office
  'Desk (large)': 0.7,
  'Desk (small)': 0.4,
  'Office Chair': 0.3,
  'Filing Cabinet (2-drawer)': 0.2,
  'Filing Cabinet (4-drawer)': 0.35,
  'Bookcase': 0.5,
  'Desktop Computer + Monitor': 0.12,
  'Printer': 0.08,
  'Safe (small)': 0.1,

  // Garage & Outdoor
  'Workbench': 0.7,
  'Tool Cabinet': 0.4,
  'Garage Shelving Unit': 0.4,
  'Ride-on Lawnmower': 1.2,
  'Petrol Lawnmower': 0.3,
  'Whipper Snipper / Line Trimmer': 0.1,
  'Garden Tools (bundle)': 0.2,
  'Wheelbarrow': 0.3,
  'Ladder (extension)': 0.15,
  'Garden Shed (flatpack)': 0.8,
  'Clothesline (Hills Hoist / folding)': 0.4,
  'Outdoor Table + Chairs (6-seater)': 1.2,
  'Outdoor Lounge Setting': 1.0,
  'BBQ (large)': 0.5,
  'Pot Plants (large)': 0.2,
  'Esky / Camping Gear': 0.2,
  'Bikes': 0.3,
  'Surfboard / Paddleboard': 0.2,
  'Kayak / Canoe': 0.6,
  'Pram / Stroller': 0.2,
  'Kids Play Equipment (swing set / cubby)': 1.0,
  'Trailer (if on property)': 2.0,

  // Special Items
  'Upright Piano': 1.2,
  'Grand Piano': 2.5,
  'Pool Table': 2.0,
  'Spa / Hot Tub': 3.0,
  'Treadmill': 0.7,
  'Exercise Bike': 0.4,
  'Antique / High-value Furniture': 0.8,
  'Safe (large)': 0.5,
  'Gym Equipment (per piece)': 0.5,
  'Large Aquarium': 0.5,
  'Trampoline': 1.0,

  // Boxes & Packing
  'Small Box (books, heavy items)': 0.04,
  'Medium Box': 0.06,
  'Large Box': 0.11,
  'Wardrobe Box (hanging clothes)': 0.3,
  'Picture / Mirror Box': 0.05,
  'Plastic Storage Tub': 0.06,
}

// Fallback for any item not found in the table above (keeps totals safe if the
// catalog and cube sheet drift out of sync).
export const DEFAULT_ITEM_VOLUME_M3 = 0.2

// Loading inefficiency factor — irregular shapes and gaps mean a truck never packs
// to 100% of raw item volume. AU movers typically allow ~15–35% on top. Tune to taste.
export const PACKING_FACTOR = 1.15

// Items whose real-world size/quantity varies a lot — figures here are rough.
// Useful later for flagging "operator to confirm" in the UI.
export const VARIABLE_ITEMS = new Set<string>([
  'Antique / High-value Furniture',
  'Gym Equipment (per piece)',
  'Bikes',
  'Pot Plants (large)',
  'Garden Tools (bundle)',
  'Esky / Camping Gear',
  'Small Appliances (box)',
  'Kids Play Equipment (swing set / cubby)',
  'Trailer (if on property)',
])

export function getItemVolume(name: string): number {
  return itemVolumesM3[name] ?? DEFAULT_ITEM_VOLUME_M3
}

// Usable load volume of a typical AU 4.5 tonne pantech removal truck (~20 m³).
// Tune to your fleet. Used to suggest how many truck loads the move needs.
export const TRUCK_CAPACITY_M3 = 20

// Suggested number of 4.5t truck loads for a given total volume (min 1 if anything
// is selected). It's a rough guide for the operator — they confirm on the call.
export function getSuggestedTrucks(totalVolumeM3: number): number {
  if (totalVolumeM3 <= 0) return 0
  return Math.max(1, Math.ceil(totalVolumeM3 / TRUCK_CAPACITY_M3))
}
