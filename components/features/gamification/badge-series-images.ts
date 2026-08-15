const SERIES_IMAGE_BY_KEY: Record<string, string> = {
  intro_likes: "thumbs_up",
  intro_publish: "upload",
  intro_collections: "bookmark",
  science_expert: "atom",
  tech_expert: "circuit",
  engineering_expert: "tower",
  art_expert: "palette",
  math_expert: "grid",
  social: "branch",
  popularity: "heart",
  milestone: "trophy",
  level: "medal",
  challenge: "target",
  streak: "flame",
  bird_observer: "binoculars",
  species_collector: "feather",
  bird_common: "magpie",
  bird_uncommon: "falcon",
  bird_rare: "eagle",
  insect_rank: "dragonfly",
  first_steps: "bolt",
  playground_explorer: "grid",
  playground_victories: "trophy",
  playground_star: "target",
  rare: "crown",
};

const SINGLE_IMAGE_BY_ICON: Record<string, string> = {
  award: "single-medal",
  binary: "single-binary",
  bird: "single-bird",
  bomb: "single-bomb",
  bookmark: "single-bookmark_single",
  brain: "single-brain",
  bug: "single-bug",
  butterfly: "single-butterfly",
  cake: "single-cake",
  calculator: "single-calculator",
  compass: "single-compass",
  crown: "single-crown",
  cube: "single-cube",
  dna: "single-dna",
  feather: "single-feather_single",
  flag_checkered: "single-flag_checkered",
  flame: "single-flame",
  flask: "single-flask",
  footprints: "single-footprints",
  grid_nine: "single-grid_nine",
  hand_heart: "single-hand_heart",
  hash: "single-hash",
  heart: "single-heart_single",
  layers: "single-layers",
  lightbulb_filament: "single-lightbulb_filament",
  medal: "single-medal",
  number_square_two: "single-number_square_two",
  puzzle_piece: "single-puzzle_piece",
  rocket: "single-rocket",
  shield_star: "single-shield_star",
  strategy: "single-strategy",
  target: "single-target",
  thumbs_up: "single-heart_single",
  timer: "single-timer",
  tree_structure: "single-tree_structure",
  trophy: "trophy-bronze",
  upload: "single-upload_single",
  zap: "single-zap",
};

export function getBadgeSeriesImage(seriesKey?: string, tier?: string, icon?: string) {
  if (!tier && icon) {
    const singleImage = SINGLE_IMAGE_BY_ICON[icon];
    if (singleImage) return `/assets/badges/series/${singleImage}.png`;
  }

  if (!seriesKey) return null;
  const image = SERIES_IMAGE_BY_KEY[seriesKey];
  return image ? `/assets/badges/series/${image}-${tier ?? "bronze"}.png` : null;
}
