export const categories = [
  ['general-questions', 'General Questions'], ['camping-equipment', 'Camping Equipment'],
  ['product-troubleshooting', 'Product Troubleshooting'], ['shipping-and-delivery', 'Shipping and Delivery'],
  ['returns-and-warranties', 'Returns and Warranties'], ['product-reviews', 'Product Reviews'],
  ['tips-and-recommendations', 'Tips and Recommendations'],
].map(([slug, name]) => ({ slug, name }));

const entries = [
  ['raccoon-ridge-lantern-battery-problem', 'Raccoon Ridge Lantern Battery Problem', 2, 'Alice', 'My Raccoon Ridge lantern shuts off after about twenty minutes. Has anyone experienced this?', 'Bob', 'Check that the batteries are installed correctly and that the contacts are clean. If it continues, ask support to inspect it rather than opening the housing.'],
  ['trailblazer-backpack-warranty', 'Trailblazer Backpack Warranty', 4, 'Bob', 'Does anyone know whether the Trailblazer 45L backpack comes with a manufacturer warranty?', 'Morgan', 'The official product documentation is the right place to check. Support can confirm the terms for your particular purchase.'],
  ['waterproof-jacket-sizing', 'Waterproof Jacket Sizing', 0, 'Morgan', 'I am considering the TrailGuard jacket. How does the sizing compare with standard outdoor jackets?', 'Alice', 'I found room for a light fleece in my usual size. Check the product measurements and your layers before deciding.'],
  ['keeping-a-sleeping-bag-dry', 'Keeping a sleeping bag dry on a damp trip', 1, 'Alice', 'What is your packing routine for a sleeping bag when the forecast calls for rain?', 'Morgan', 'I use a dry liner inside the pack and air the bag when conditions allow. I keep wet tent fabric in a different compartment.'],
  ['tracking-says-label-created', 'Tracking still says label created', 3, 'Bob', 'My parcel tracking has shown label created since yesterday. Is that normal?', 'Alice', 'Mine updated after the carrier made its first scan. The official shipping page explains the usual timing; contact support privately if it takes longer.'],
  ['returning-an-unused-lantern', 'Returning an unused lantern', 4, 'Morgan', 'I ordered two lanterns but only need one. What should I keep in the return package?', 'Bob', 'Keep the packaging and order reference, and contact support for return instructions. Do not post your address or order details here.'],
  ['field-kit-weekend-review', 'Night Shift Field Kit on a weekend walk', 5, 'Alice', 'The small field kit fit neatly in my day bag. I especially liked having the little items together instead of loose in a pocket.', 'Morgan', 'Thanks for sharing. How did the pouch handle a damp morning?', 'A light mist was fine on my walk, but I would use a dry bag in sustained rain.'],
  ['first-campsite-packing-list', 'What would you take to a first campsite?', 6, 'Bob', 'I am planning a one-night trip at an established campsite. What basics do people most often forget?', 'Alice', 'Check the site rules, weather and water access. A light source, spare batteries, warm layers and a way to keep essentials dry are on my list.'],
  ['cleaning-a-water-bottle', 'Cleaning a bottle after a long weekend', 2, 'Morgan', 'How do you keep an insulated bottle fresh after several days on the trail?', 'Bob', 'I follow the care instructions, wash the removable seal separately when allowed, and let everything dry fully before putting it away.'],
  ['split-delivery-question', 'Can items from one order arrive separately?', 3, 'Alice', 'A friend mentioned receiving two parcels for one order. Has anyone else had that happen?', 'Morgan', 'It can depend on packing and stock. Check the dispatch message and ask support privately to confirm your shipment.'],
  ['pocket-notebook-in-wet-weather', 'Keeping a pocket notebook dry', 6, 'Morgan', 'I like taking field notes, but my notebook gets damp in a jacket pocket. Any practical suggestions?', 'Alice', 'A small resealable pouch helped me. I also keep a pencil with it so I can write when the weather changes.'],
  ['ranger-cap-fit-review', 'Ranger Cap fit after a few outings', 5, 'Bob', 'The Ranger Cap adjustment has been comfortable for my short walks. The brim packs flatter than my old cap.', 'Morgan', 'Good to know. I would compare the listed measurements rather than assume one fit suits everyone.'],
  ['lantern-storage-between-trips', 'Storing a lantern between trips', 1, 'Morgan', 'I will not use my camping lantern for a few months. What should I do before storing it?', 'Alice', 'Follow the storage instructions for that model. For my removable-battery light I take the batteries out and keep everything dry.'],
  ['damaged-buckle-next-steps', 'Damaged backpack buckle: what next?', 4, 'Alice', 'One buckle on my pack is cracked. Should I try to replace it myself?', 'Bob', 'Contact support with a private description and photos first. They can check compatibility and the relevant warranty terms.'],
  ['choosing-a-small-day-bag', 'Choosing a bag for short nature walks', 0, 'Bob', 'I only need room for water, a layer and a notebook. What should I compare when choosing a small day bag?', 'Morgan', 'Try the fit with your usual load, check accessible pockets and compare the product dimensions. Personal comfort matters more than my preferences.'],
];
export const discussions = entries.map(([slug, title, category, author, body, replyAuthor, reply, followup], i) => ({
  slug, title, category: categories[category].slug, author, body,
  createdAt: new Date(Date.UTC(2026, 9, 5 + i, 14)).toISOString(),
  updatedAt: new Date(Date.UTC(2026, 9, 6 + i, 10)).toISOString(),
  replies: [{ author: replyAuthor, body: reply, createdAt: new Date(Date.UTC(2026, 9, 6 + i, 9)).toISOString() },
    ...(followup ? [{ author, body: followup, createdAt: new Date(Date.UTC(2026, 9, 6 + i, 10)).toISOString() }] : [])],
}));
