# 01 — Market research (2026-10-06)

Web research done before writing any code. Product descriptions come from listing pages (Product Hunt, hunted.space, lablab.ai, aggregator sites), not from using the products. Treat details as Unverified and try the two or three closest ones before the presentation: the professor may ask "does this exist already?".

## Verdict

**Good idea for a showcase, not a novel one.** At least eight products already do "humans debate, AI judges"; several advertise real-time fallacy detection. So do not pitch it as "nobody has done this". Pitch what is different (below).

Two honest readings of the landscape:

- For: the concept is validated enough that many people independently built it, and the research problem underneath (fallacy detection, LLM as judge) is an active field.
- Against: none of the launches found shows traction (the two Product Hunt launches checked had 0 upvotes). That is either weak demand or weak distribution. It does not matter for a class showcase; it would matter for a startup.

## What exists

| Product | What it is (per its listing) | Notes |
|---|---|---|
| Who's Right (whosright.app) | Gamified debates; AI analyses each message in real time for biases, fallacies, manipulation; fact-checking; "100% transparent" scoring with sources | Closest to our idea. Launched around 2026-01. 0 upvotes, 2 followers on Product Hunt |
| Wram (wram.chat) | "Settle any dispute in a pixel courtroom": argue against a friend or an AI lawyer, an AI judge rules in seconds | Free. Verdict at the end rather than a live meter, as far as the listing shows |
| Rebuttal Live | 2 to 20 people debate live, AI scores every argument on logic, vocabulary, persuasion; ELO and a global leaderboard | Competitive game framing. 0 upvotes on Product Hunt |
| ArguFight | Structured rounds; judges score logic, evidence, rhetoric; several models (DeepSeek, Gemini/Groq second opinion, Wikipedia context) | Multi-model judging is a credible idea to borrow |
| PNYX | Live **audio** arena; AI judge fact-checks in real time, scores truth and conduct | Voice, not text |
| Debatia | Real-time fallacy identification (ad hominem, straw man) in your and your opponent's arguments | Training tool |
| Debate Club, On Demand Judge | Hackathon projects (lablab.ai): staged judging pipeline, PDF summary; one uses Groq Llama + Whisper with WebRTC video | Shows the idea fits a hackathon-sized build |

Academic neighbours: DISPUTool 3.0 (ACL 2025 demo) detects and repairs fallacies in political debates; "AI Debate Aids Assessment of Controversial Claims" (arXiv 2506.02175) studies AI debate as an aid to human judgement.

## How this project differs (Decided by Lucas, 2026-10-06)

The two headline differences, the ones to protect and to lead the pitch with:

1. **The score is computed and shown in real time, with the math visible.** Every point won or lost appears as a ledger entry tied to a quoted excerpt and a reason; the arithmetic lives in code, not in the model. Who's Right also advertises transparent scoring, so the claim is not "only we explain": it is the live ledger and the formula on screen. Try Who's Right before Friday to know exactly where the line is.
2. **The bot is summoned with `@`.** A debater calls the bot into the conversation to validate a claim or to web-search something about the debate, and the result changes the score. No listing found describes a referee you can challenge mid-debate.

Supporting differences:

3. **Bilingual, Portuguese by default.** Every product found is English only.
4. **Link and play.** No account, no app, no leaderboard.
5. **Manipulation is part of the game.** Trying to prompt-inject the bot is detected and penalised as a move.
6. **The meter is the interface.** A full-screen WebGPU field (vgpu) where two colours push against each other.
7. Honest framing: it scores argument quality, not truth.

Moved to "after Friday" (`06-roadmap.md`): the projector stage view and audience voting.

## What research says about the hard part

The judge is the risk, not the chat.

- **LLM judges are biased.** "Justice or Prejudice? Quantifying Biases in LLM-as-a-Judge" (ICLR 2025, the CALM framework) catalogues 12 biases, including a *fallacy-oversight* bias (overlooking flawed reasoning), position bias and verbosity bias. A 2026 follow-up (BiasScope, ICLR 2026) reports error rates above 50% for strong models on its hardest benchmark. Numbers here come from search summaries: read the papers before quoting them on a slide.
- **Fallacy classification is hard zero-shot but prompt design helps a lot.** A NAACL 2025 Findings paper (arXiv 2503.23363, 29 fallacy types, 5 domains, GPT and LLaMA models) reports large zero-shot F1 gains from making the model first consider the argument's **counterargument, explanation and goal** before classifying. This is directly usable in our prompt; see `03-judge.md`.
- **Consequences for the design**: a small fallacy list, a confidence threshold before anything is shown, verbatim quotes as evidence, sides anonymised as A/B, deterministic scoring, visible reasoning, and a clear "the judge can be wrong" stance. A second-opinion model (as ArguFight does) is a roadmap item.

## Evidence for the pitch

- InternetLab + Rede Conhecimento Social, "Vetores da Comunicação Política em Aplicativos de Mensagens", 5th edition: 3,113 messaging-app users, fieldwork 2024-11-20 to 2024-12-10. 56% say discussing politics online generates fear; 65% prefer not to discuss it with family and friends; half avoid it in family groups; 52% police what they share. Political talk in family groups fell from 31% (2023) to 23% (2024). 25% received political video or images clearly made by AI. Numbers verified against the Convergência Digital article (published 2025-12-15).
- Genial/Quaest: 87% of voters do not intend to join WhatsApp political groups in the 2026 elections (from a search summary of a spacemoney.com.br article, not opened: verify before using).

## Sources

- Who's Right: https://www.producthunt.com/products/who-s-right-the-debating-app
- Wram: https://aiindigo.com/tool/wram
- Rebuttal Live: https://hunted.space/product/rebuttal-live
- ArguFight: https://hunted.space/dashboard/argufight
- PNYX: https://webmail.hunted.space/product/pnyx
- Debatia: https://www.toolmage.com/en/tool/debatia/
- Debate Club: https://lablab.ai/ai-hackathons/ai-genesis/vincero/debate-club
- DISPUTool 3.0: https://preview.aclanthology.org/setup/2025.acl-demo.45
- AI Debate Aids Assessment of Controversial Claims: https://arxiv.org/pdf/2506.02175
- Justice or Prejudice? (CALM): https://arxiv.org/abs/2410.02736
- BiasScope: https://iclr.cc/virtual/2026/poster/10009605
- Logical fallacy prompt formulation (NAACL 2025 Findings): https://arxiv.org/abs/2503.23363
- LLMs-as-Judges survey: https://arxiv.org/pdf/2412.05579
- InternetLab survey (Convergência Digital): https://convergenciadigital.com.br/internet/discutir-politica-brasileiro-foge-dos-grupos-de-whatsapp/
- Quaest 87%: https://www.spacemoney.com.br/politica/87-brasileiros-rejeitam-grupos-whatsapp-eleicoes-2026/
- Upstash Realtime: https://upstash.com/docs/realtime/overall/quickstart
- WebSockets on Vercel (context): https://ably.com/vercel/websockets-on-vercel
- Groq rate limits: https://console.groq.com/docs/rate-limits
