// The unit tests of the game's rules (lib/, docs/ARCHITECTURE.md): one file per
// rule module, then a check that the rules and the words in the canonical
// source stay in step.
await import("./test-economy.mjs");
await import("./test-community-table.mjs");
await import("./test-seasons.mjs");
await import("./test-acts.mjs");
await import("./test-wildlife.mjs");
await import("./test-rules-words.mjs");
