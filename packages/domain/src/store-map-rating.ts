/** Public FINDIT map rating from response speed — not scraped third-party reviews. */

export type PublicStoreMapRating = {
  score: number | null;
  stars: number;
  label: string;
};

export function publicStoreMapRating(store: {
  avg_response_minutes: number | null;
  is_verified: boolean;
}): PublicStoreMapRating {
  if (store.avg_response_minutes == null) {
    return {
      score: null,
      stars: store.is_verified ? 4 : 0,
      label: store.is_verified ? "Verified FINDIT store" : "New on FINDIT",
    };
  }
  const minutes = store.avg_response_minutes;
  const stars =
    minutes <= 10 ? 5 : minutes <= 20 ? 4.5 : minutes <= 35 ? 4 : minutes <= 60 ? 3.5 : 3;
  return {
    score: stars,
    stars,
    label: `Usually replies in about ${minutes} min`,
  };
}
