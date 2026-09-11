/**
 * Card definition types for JSON-loaded cards.
 * Aligned with Young Jedi style: Character, Weapon, Location, Starship, Battle, etc.
 */

export type CardDotColor = "red" | "blue" | "green" | "orange" | "yellow" | "purple";

export type CardTypeName =
  | "character"
  | "weapon"
  | "location"
  | "starship"
  | "battle"
  | "effect";

/** Base fields present on every card definition */
export interface CardDefinitionBase {
  id: string;
  name: string;
  side: "light" | "dark";
  dotColor: CardDotColor;
  type: CardTypeName;
  text?: string;  // rules / gametext
  /** Game text (card ability description). */
  gametext?: string;
  /** Parsed bonus: "number, whatItAffects, condition" e.g. "1, power, obiwanslightsaber". */
  gametextbonus?: string;
  /** Image filename (e.g. "1obiwankenobiyoungjedi.gif") */
  image?: string;
  /** Set identifier (e.g. "menaceofdarthmaul") */
  set?: string;
}

/** Character: title, side, color, cost, power, bonus1–3, damage, lore/gametext, destiny, uniqueness, image */
export interface CharacterCardDefinition extends CardDefinitionBase {
  type: "character";
  /** Deploy cost */
  cost?: number;
  power?: number;
  /** Bonus value 1 (e.g. ability, armor) */
  bonus1?: number;
  bonus2?: number;
  bonus3?: number;
  /** Bonus at location 1 (location id) */
  bonus1loc?: string;
  /** Bonus at location 2 (location id) */
  bonus2loc?: string;
  /** Bonus at location 3 (location id) */
  bonus3loc?: string;
  /** Damage/forfeit value */
  damage?: number;
  /** Lore or game text */
  lore?: string;
  /** Game text (ability description). */
  gametext?: string;
  /** Parsed bonus: "number, whatItAffects, condition" e.g. "1, power, obiwanslightsaber". */
  gametextbonus?: string;
  destiny?: number;
  /** True if unique (•) card */
  uniqueness?: boolean;
  /** If true, multiple copies of this unique may be deployed at the same location; default false */
  stackable?: boolean;
  /** @deprecated use ability; kept for compatibility */
  ability?: number;
}

/** Weapon card: title, cost, powerAdd, destinyAdd, lore, color, canUse, destiny, image, uniqueness (from base) */
export interface WeaponCardDefinition extends CardDefinitionBase {
  type: "weapon";
  /** True if unique (•) card */
  uniqueness?: boolean;
  /** If true, multiple copies of this unique may be deployed at the same location; default false */
  stackable?: boolean;
  /** Deploy/play cost */
  cost?: number;
  /** Add this to power when deployed (e.g. adds 4 to character power) */
  powerAdd?: number;
  /** Second power add when canUse2 matches (e.g. "any") */
  powerAdd2?: number;
  /** Add this to destiny when used */
  destinyAdd?: number;
  /** Second destiny add when canUse2 matches */
  destinyAdd2?: number;
  /** Lore or game text */
  lore?: string;
  /** When/where card can be used (e.g. "deploy on Obi-Wan") */
  canUse?: string;
  /** Second eligibility (e.g. "any"); checked only if canUse does not match */
  canUse2?: string;
  /** Destiny number for destiny draws */
  destiny?: number;
}

/** Location: title, planet, destiny number, color, side, image (from base) */
export interface LocationCardDefinition extends CardDefinitionBase {
  type: "location";
  /** Planet (e.g. "Tatooine", "Naboo", "Coruscant") */
  planet: string;
  /** Destiny number for destiny draws */
  destiny?: number;
}

/** Starship card: title, image, power, damage, lore/gametext, color, destiny, trait (starfighter/transport), destinyAdd */
export interface StarshipCardDefinition extends CardDefinitionBase {
  type: "starship";
  /** "starfighter" can intercept transports and draw destiny; "transport" can evacuate stranded cards */
  trait?: string;
  power?: number;
  /** Destiny add for starship battles (starfighters get this, transports do not) */
  destinyAdd?: number;
  /** Damage/forfeit value */
  damage?: number;
  /** True if unique (•) card */
  unique?: boolean;
  /** If true, multiple copies of this unique may be at the same location; default false. Not used in gameplay yet. */
  stackable?: boolean;
  /** Lore or game text (also text on base) */
  lore?: string;
  /** Destiny number for destiny draws */
  destiny?: number;
}

/** Battle card: title, powerAdd, lore/gametext, color, canUse, condition, destiny, image */
export interface BattleCardDefinition extends CardDefinitionBase {
  type: "battle";
  /** Add this to power when played (e.g. +2 to dark side power) */
  powerAdd?: number;
  /** Lore or game text (also text on base) */
  lore?: string;
  /** When/where card can be used (e.g. "battle", "during battle") */
  canUse?: string;
  /** Optional condition for bonus (e.g. "against:jedi" = opponent must have trait jedi). Empty = no condition. */
  condition?: string;
  /** Destiny number for destiny draws */
  destiny?: number;
  /** Image filename (from base; battle card image) */
  image?: string;
}

export type CardDefinition =
  | CharacterCardDefinition
  | WeaponCardDefinition
  | LocationCardDefinition
  | StarshipCardDefinition
  | BattleCardDefinition;

/** Deck card entry: id, optional set (for same-name cards across sets), count */
export interface DeckCardEntry {
  id: string;
  set?: string;
  count: number;
}

/** Deck definition: list of card entries (id + set + count) */
export interface DeckDefinition {
  id: string;
  name: string;
  side: "light" | "dark";
  cards: DeckCardEntry[];
}

/** Instance of a card in a game (id + optional set for lookup) */
export interface CardInstance {
  instanceId: string;
  cardId: string;
  /** Set the card came from (for correct lookup when same id exists in multiple sets). */
  cardSet?: string;
  ownerSide: "light" | "dark";
  zone: "deck" | "hand" | "in_play" | "discard";
  position?: number;  // order in zone
  /** True when deployed face down (turn 1); flipped face up at start of turn 2. */
  faceDown?: boolean;
}
