// Centralized glossary for help tooltips across WINE Operations Control.
// Usage: import { GLOSSARY } from '../utils/glossary'
//        <HelpTip term="wiqs_score" />

export const GLOSSARY = {
  // ── Core WIQS ──────────────────────────────────────────────────────────────
  wiqs:            'Wine Intelligence Quality Score — a composite 0–100 rating combining five pillars: terroir, prestige, classification, market validation, and sensory complexity.',
  wiqs_score:      'The overall WIQS rating (0–100). Exceptional ≥ 85, Distinguished ≥ 70, Quality ≥ 55, Standard ≥ 40, Basic < 40.',
  confidence:      'How reliable the WIQS score is (0–100%). Higher confidence means more data signals are available. Scores below 80% are flagged for review.',
  tier:            'Quality tier derived from the WIQS score: Exceptional, Distinguished, Quality, Standard, or Basic.',
  qpr:             'Quality-Price Ratio — compares the WIQS score to the wine\'s market price. Higher QPR means better value.',

  // ── Five Pillars ───────────────────────────────────────────────────────────
  p1:              'P1 Site & Terroir (max 25 pts) — measures the quality of the vineyard site, soil, climate, and geographic factors.',
  p2:              'P2 Producer Prestige (max 20 pts) — reflects the producer\'s reputation, track record, and winemaking heritage.',
  p3:              'P3 Classification (max 20 pts) — based on official wine classifications, appellations, and denomination rankings.',
  p4:              'P4 Market Validation (max 20 pts) — derived from market pricing, auction results, and commercial demand signals.',
  p5:              'P5 Sensory Complexity (max 15 pts) — based on tasting notes, critic scores, and sensory analysis data.',

  // ── Catalog ────────────────────────────────────────────────────────────────
  wine_families:   'Distinct wines regardless of vintage. Each family groups all vintages of the same wine (e.g., Château Margaux 2015, 2016, 2017 are one family).',
  vintages:        'Individual wine-year combinations. A wine family with 4 tracked vintages counts as 4 vintage rows.',
  vectors:         'Multi-dimensional data profiles attached to each vintage — includes tasting, price, climate, and soil data used for scoring and recommendations.',
  wiqs_scored:     'Vintages that have received a computed WIQS score. Unscored vintages are waiting for enough data signals.',
  production_tier: 'The wine\'s classification level in its appellation hierarchy (e.g., Grand Cru, Premier Cru, Village).',

  // ── LWIN ───────────────────────────────────────────────────────────────────
  lwin:            'Liv-ex Wine Identification Number — the global industry standard ID for identifying wine families. Used for cross-referencing with market data.',
  lwin7:           'The 7-digit version of the LWIN code that identifies a wine family (producer + wine name). Longer LWIN codes add vintage and format.',
  lwin_matched:    'Wine families successfully matched to a LWIN code in the Liv-ex database.',
  lwin_unmatched:  'Wine families not yet matched to a LWIN code — may need manual matching or the wine isn\'t in the Liv-ex database.',
  collision_held:  'LWIN matches that are on hold because multiple wines matched the same code — requires manual review to resolve.',

  // ── Data Quality ───────────────────────────────────────────────────────────
  p1_misses:       'Wines where P1 Site & Terroir is exactly 10.0 (the default), meaning the subregion quality score is missing or unset.',
  low_confidence:  'Wines where the WIQS confidence is below 80%, indicating insufficient data to produce a reliable score.',
  tier_anomalies:  'Wines where the WIQS score and the assigned tier don\'t align — e.g., a high-scoring wine classified in a low tier.',

  // ── Lookup Tables ──────────────────────────────────────────────────────────
  subregion_quality: 'A manually curated score (0–25) representing the inherent quality potential of a wine subregion. Feeds directly into P1.',
  quality_score:     'Subregion quality rating from 0 to 25. Higher scores indicate regions with greater terroir potential. Directly affects P1 pillar.',
  producer_prestige: 'A manually curated score (0–20) representing a producer\'s prestige and reputation. Feeds directly into P2.',
  prestige_score:    'Producer prestige rating from 0 to 20. Based on reputation, history, and quality consistency. Directly affects P2 pillar.',
  denomination_tiers:'Official wine classification tiers (DOC, DOCG, AOC, etc.) and their bonus points. Feeds into P3.',
  tier_bonus:        'Extra points added to P3 Classification based on the wine\'s official denomination level.',

  // ── Tasting Model ─────────────────────────────────────────────────────────
  tasting_events:    'Individual tasting records imported from professional tastings — each event is one taster\'s evaluation of one wine.',
  rollup_wines:      'Wines that have tasting data rolled up into their WIQS profile. Tasting notes feed the P5 Sensory Complexity pillar.',
  unresolved:        'Tasting records that couldn\'t be automatically matched to a wine family — need manual review.',
  active_archetypes: 'Distinct wine style clusters identified by the tasting model (e.g., "silken right bank bordeaux", "restrained mountain cabernet").',
  archetype:         'A wine\'s style cluster based on tasting profile — groups wines with similar sensory characteristics regardless of region.',
  maturity:          'Drinking window status: Pre-window (too young), Opening (becoming ready), Peak (optimal), Late (past prime), Mixed (vintages vary).',
  quality_bands:     'Tasting quality tiers: Icon (best), Elite, Excellent, Very Good, Good, Unclassified.',
  weighted_adj_score:'A normalized tasting score that adjusts for taster bias and event variability.',

  // ── Customer / Recommendations ─────────────────────────────────────────────
  palate_dimensions: 'A customer\'s taste preference profile across 9 dimensions: Body, Acidity, Tannin, Sweetness, Oak, Finish, Flavour, Site, and more.',
  influence_sensitivity:'How much a customer is swayed by external factors like trends, critics, and social proof vs. personal taste.',
  match_score:       'How well a specific wine matches a customer\'s palate profile (0–1). Higher means better fit.',
  similarity_score:  'Vector similarity between the customer\'s palate and the wine\'s sensory profile.',

  // ── System / Infrastructure ────────────────────────────────────────────────
  ssurgo_producers:  'Producers matched to USDA SSURGO soil survey data — enables terroir analysis for their vineyard sites.',
  batch_recompute:   'Recalculates WIQS scores for a group of wines. Use after updating lookup tables, adding overrides, or importing new data.',
  override:          'A manual adjustment to a pillar score or prestige rating that takes precedence over the computed value.',
  pillar_overrides:  'Manual overrides applied to individual pillar scores (P1–P5) for specific wine vintages.',
  prestige_overrides:'Manual overrides applied to a producer\'s prestige score, affecting P2 for all their wines.',
  vector_coverage:   'How many wines have complete vector data (all 8+ dimensions populated). Missing vectors reduce score accuracy.',
  scoring_distribution:'Breakdown of how wines are distributed across the five WIQS tiers.',
  score_anomalies:   'Wines whose WIQS score changed by more than 5 points in the last 30 days — may indicate data issues.',

  // ── Audit / Operations ─────────────────────────────────────────────────────
  operator:          'Who made a change: "steve" (manual), "claude_code" (AI assistant), or "pipeline_auto" (automated pipeline).',
  script:            'The automated script or process that triggered an audit log entry.',
  scope:             'Which wines to process: All wines, a specific region, or a specific tier. Narrower scopes run faster but only update the selected subset.',
  harvest_year:      'The vintage year being added to the catalog in the Annual Vintage workflow.',
  price_data_outstanding:'Wines missing retail price data — needed for P4 Market Validation scoring.',
}
