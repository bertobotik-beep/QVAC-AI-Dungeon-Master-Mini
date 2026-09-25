// QVAC AI Dungeon Master Mini — core logic.
// The client holds the growing story history and replays it each turn so the
// model narrates consistently. After MAX_TURNS the DM is instructed to wrap
// the story up to a real ending instead of looping forever.

import { completion } from "@qvac/sdk";

const MAX_TURNS = 7;

const SYSTEM_PROMPT =
  "You are an imaginative but concise Dungeon Master running a short choose-your-own-adventure. " +
  "Narrate the current scene in 3-6 sentences, second person ('you'). Then on new lines offer 2-3 numbered choices " +
  "for what the player can do next, formatted exactly as '1. <choice>', '2. <choice>', optionally '3. <choice>'. " +
  "The player may also type a free-text action instead of picking a number. " +
  "Keep the story moving toward a satisfying conclusion — do not stall forever. " +
  "When told this is the FINAL turn, write a proper dramatic ending (no more choices) that resolves the adventure.";

function cleanChoiceText(text) {
  let t = text.trim();
  // Strip wrapping quotes the model sometimes adds around the whole choice.
  t = t.replace(/^['"]+/, "").replace(/['"]+$/, "").trim();
  // Strip a duplicated leading "N. " the model sometimes echoes inside the choice text itself.
  t = t.replace(/^\d+\.\s*/, "").trim();
  t = t.replace(/^['"]+/, "").replace(/['"]+$/, "").trim();
  return t;
}

function parseScene(raw) {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const choices = [];
  const narrationLines = [];
  for (const line of lines) {
    const m = line.match(/^(\d)\.\s*(.+)$/);
    if (m) {
      const cleaned = cleanChoiceText(m[2]);
      if (cleaned && !/^type (a |your )?response/i.test(cleaned)) choices.push(cleaned);
    } else if (!/^type (a |your )?response/i.test(line)) {
      narrationLines.push(line);
    }
  }
  return { narration: narrationLines.join("\n").trim(), choices };
}

export async function startStory(modelId, genre) {
  const history = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Start a new adventure. Genre/setting: ${genre}. Begin the opening scene now.` },
  ];

  const run = completion({
    modelId,
    history,
    stream: true,
    completionOpts: { temperature: 0.9, maxTokens: 350 },
  });

  let raw = "";
  for await (const token of run.tokenStream) raw += token;
  raw = raw.trim();

  const newHistory = [...history, { role: "assistant", content: raw }];
  const { narration, choices } = parseScene(raw);
  return { history: newHistory, narration, choices, turnCount: 1, ended: false };
}

export async function continueStory(modelId, history, choice, turnCount) {
  const nextTurn = turnCount + 1;
  const isFinal = nextTurn >= MAX_TURNS;

  const instruction = isFinal
    ? `The player chose/did: "${choice}". This is the FINAL turn — write a satisfying dramatic ending that resolves the adventure. Do not offer any more choices.`
    : `The player chose/did: "${choice}". Continue the story from here with the next scene and new choices.`;

  const turn = [...history, { role: "user", content: instruction }];

  const run = completion({
    modelId,
    history: turn,
    stream: true,
    completionOpts: { temperature: 0.9, maxTokens: 350 },
  });

  let raw = "";
  for await (const token of run.tokenStream) raw += token;
  raw = raw.trim();

  const newHistory = [...turn, { role: "assistant", content: raw }];
  const { narration, choices } = parseScene(raw);
  return {
    history: newHistory,
    narration,
    choices: isFinal ? [] : choices,
    turnCount: nextTurn,
    ended: isFinal,
  };
}
