import { generateCard } from "../ai/generation/cardGenerationPipeline.js";

const artifact = await generateCard({
  mode: "hybrid",
  textPrompt: "a memory that arrives too late",
  imagePrompt: "surreal railway platform under a moonlit ocean"
});

console.log(JSON.stringify(artifact, null, 2));
