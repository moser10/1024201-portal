#!/usr/bin/env node
import { run } from "../lib/main.js";

run(process.argv.slice(2)).catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});
