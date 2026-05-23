import type { Challenge } from "@/lib/mappers/types";

function isNatureObservationChallenge(challenge: Challenge) {
    return challenge.tags.includes("自然观察");
}

export function getFeaturedNatureChallenges(challenges: {
    activeTimed: Challenge[];
    evergreen: Challenge[];
}) {
    return [...challenges.activeTimed, ...challenges.evergreen].filter(isNatureObservationChallenge);
}
