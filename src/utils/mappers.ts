export function toCollectionItemUpdateRow(input: Partial<CollectionItemInput>) {
  const row: Record<string, any> = {};
  
  if (input.variant !== undefined) row.variant = input.variant;
  if (input.cardLanguage !== undefined) row.card_language = input.cardLanguage;
  if (input.condition !== undefined) row.condition = input.condition;
  if (input.purchasePrice !== undefined) row.purchase_price = input.purchasePrice;
  if (input.purchaseSource !== undefined) row.purchase_source = input.purchaseSource;
  if (input.acquiredAt !== undefined) row.acquired_at = input.acquiredAt;
  if (input.notes !== undefined) row.notes = input.notes;
  if (input.inSleeve !== undefined) row.in_sleeve = input.inSleeve;
  if (input.inBinder !== undefined) row.in_binder = input.inBinder;
  if (input.gradingCompany !== undefined) row.grading_company = input.gradingCompany;
  if (input.gradingScore !== undefined) row.grading_score = input.gradingScore;
  if (input.gradingCertificate !== undefined) row.grading_certificate = input.gradingCertificate;
  if (input.gradeCentering !== undefined) row.grade_centering = input.gradeCentering;
  if (input.gradeCorners !== undefined) row.grade_corners = input.gradeCorners;
  if (input.gradeEdges !== undefined) row.grade_edges = input.gradeEdges;
  if (input.gradeSurface !== undefined) row.grade_surface = input.gradeSurface;
  if (input.quantity !== undefined) row.quantity = input.quantity;
  if (input.favorite !== undefined) row.favorite = input.favorite;
  if (input.imageUrl !== undefined) row.image_url = input.imageUrl;
  if (input.cardName !== undefined) row.card_name = input.cardName;
  if (input.setName !== undefined) row.set_name = input.setName;
  if (input.cardNumber !== undefined) row.card_number = input.cardNumber;
  if (input.rarity !== undefined) row.rarity = input.rarity;
  if (input.marketPrice !== undefined) row.market_price = input.marketPrice;
  if (input.tcgplayerPrice !== undefined) row.tcgplayer_price = input.tcgplayerPrice;
  
  return row;
}