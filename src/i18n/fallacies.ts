import type { Locale } from "./locales";

/**
 * The fallacy taxonomy. Small on purpose: fewer classes, fewer false
 * positives. The ids travel in events and scores; the names and definitions
 * below feed both the judge's prompt (in the room's language) and the
 * interface tooltips (in the viewer's language).
 */
export const FALLACY_IDS = [
  "ad_hominem",
  "straw_man",
  "false_dilemma",
  "hasty_generalization",
  "slippery_slope",
  "appeal_authority",
  "appeal_emotion",
  "ad_populum",
  "false_cause",
  "circular",
  "whataboutism",
  "red_herring",
  "burden_shift",
] as const;

export type FallacyId = (typeof FALLACY_IDS)[number];

export function isFallacyId(value: unknown): value is FallacyId {
  return typeof value === "string" && (FALLACY_IDS as readonly string[]).includes(value);
}

export interface FallacyText {
  name: string;
  definition: string;
}

export const FALLACIES: Record<Locale, Record<FallacyId, FallacyText>> = {
  en: {
    ad_hominem: {
      name: "Ad hominem",
      definition: "Attacks the person instead of the argument.",
    },
    straw_man: {
      name: "Straw man",
      definition: "Refutes a distorted version of what the other side said.",
    },
    false_dilemma: {
      name: "False dilemma",
      definition: "Presents two options as if they were the only ones.",
    },
    hasty_generalization: {
      name: "Hasty generalization",
      definition: "Draws a conclusion about all cases from a few.",
    },
    slippery_slope: {
      name: "Slippery slope",
      definition: "Asserts a chain of consequences without supporting each step.",
    },
    appeal_authority: {
      name: "Appeal to authority",
      definition: "Treats who said it as proof, when that person is not evidence.",
    },
    appeal_emotion: {
      name: "Appeal to emotion",
      definition: "Uses feeling in place of a reason.",
    },
    ad_populum: {
      name: "Appeal to the majority",
      definition: "Claims something is true because many people believe it.",
    },
    false_cause: {
      name: "False cause",
      definition: "Takes a correlation or a sequence in time as a cause.",
    },
    circular: {
      name: "Circular reasoning",
      definition: "Assumes the conclusion inside the premise.",
    },
    whataboutism: {
      name: "Whataboutism",
      definition: "Deflects criticism by pointing at a fault of the other side.",
    },
    red_herring: {
      name: "Red herring",
      definition: "Changes the subject to escape the point being discussed.",
    },
    burden_shift: {
      name: "Shifting the burden of proof",
      definition: "Demands that the other side disprove a claim that was never supported.",
    },
  },
  pt: {
    ad_hominem: {
      name: "Ad hominem",
      definition: "Ataca a pessoa em vez do argumento.",
    },
    straw_man: {
      name: "Espantalho",
      definition: "Refuta uma versão distorcida do que o outro lado disse.",
    },
    false_dilemma: {
      name: "Falso dilema",
      definition: "Apresenta duas opções como se fossem as únicas.",
    },
    hasty_generalization: {
      name: "Generalização apressada",
      definition: "Conclui sobre todos os casos a partir de poucos.",
    },
    slippery_slope: {
      name: "Ladeira escorregadia",
      definition: "Afirma uma cadeia de consequências sem sustentar cada passo.",
    },
    appeal_authority: {
      name: "Apelo à autoridade",
      definition: "Trata quem disse como prova, quando essa pessoa não é evidência.",
    },
    appeal_emotion: {
      name: "Apelo à emoção",
      definition: "Usa sentimento no lugar de uma razão.",
    },
    ad_populum: {
      name: "Apelo à maioria",
      definition: "Diz que algo é verdade porque muita gente acredita.",
    },
    false_cause: {
      name: "Falsa causa",
      definition: "Toma uma correlação ou uma sequência no tempo como causa.",
    },
    circular: {
      name: "Raciocínio circular",
      definition: "Já assume a conclusão dentro da premissa.",
    },
    whataboutism: {
      name: "E o outro lado?",
      definition: "Desvia da crítica apontando uma falha do adversário.",
    },
    red_herring: {
      name: "Desvio de assunto",
      definition: "Muda de assunto para fugir do ponto em discussão.",
    },
    burden_shift: {
      name: "Inversão do ônus da prova",
      definition: "Exige que o outro lado refute uma afirmação que nunca foi sustentada.",
    },
  },
};
