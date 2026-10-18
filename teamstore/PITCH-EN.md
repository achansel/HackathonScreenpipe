# Pitch (English): 2 minutes, over Minguk's film

> **Visual:** Minguk's film, [minguk/motion/film.html](../minguk/motion/film.html) (version of 18/10, 13:41: 1:55, 12 scenes, three acts).
> **Numbers:** those in [RAPPORT-DEMO.md](../RAPPORT-DEMO.md#5-chiffres-à-dire-les-mêmes-partout), the same everywhere.
> French version and jury answers: [PITCH.md](PITCH.md).

## How it works

- The film starts at **0:00** and runs for 1:55. **The speaker says the voice-over**, one line per scene, then closes at 2:00.
- Each line is shorter than the film's subtitle, at about 2.3 words per second, so it can be said calmly.

## Before you start

- Open `minguk/motion/film.html` in Chrome. **Internet is required**: the animation library (GSAP) loads from a CDN.
- Press **S** to turn the subtitles off (the speaker says the text), **H** to hide everything but the film, then **F** for full screen.
- Press **Space** on the first word.

## The script

| Time | Scene | Line |
| --- | --- | --- |
| **0:00** | The idea | "**A friction should be paid once, not ten times.** We catch it, unblock people, and fix it for good." |
| **0:06** | The setting | "To prove it, we built a real support desk: PipingTable, booking software for restaurants. Fictional customers, real tools: Crisp, HubSpot, Slack, Notion." |
| **0:15** | Meet the team | "Meet Debora, three weeks in support. Hamza, three years in, knows every unwritten rule. Claire, the manager, decides them, but nobody writes them down." |
| **0:25** | Who do I ask? | "So Debora asks Hamza. Again and again. The questions pile up in Slack… and the customer waits." |
| **0:35** | Screenpipe sees · *Act one* | "**Act one: catch.** Nine-oh-five, Jean wants compensation. Debora searches HubSpot by email: zero results. Screenpipe, recording locally, sees the detour." |
| **0:47** | The AI judges | "Our agent sends the model only those seconds, identifiers masked. Two point six seconds: it's a friction, and the team has a fix." |
| **0:56** | The answer · *Act two* | "**Act two: unblock.** The answer shows up in a Screenpipe notification. One click, Jean's record opens, ten seconds after the search." |
| **1:06** | Nobody knows | "And when nobody on her computer knows? The question goes to the team, encrypted and nameless. Hamza shares in one click, never knowing who asked." |
| **1:18** | At night · *Act three* | "**Act three: fix it once.** At night, the agent remembers: the AI turns what the team shared into a rule. Claire certifies it in the morning." |
| **1:29** | The next day | "Next day, Adam hits the same step. The answer is already there, certified. Hamza isn't interrupted." |
| **1:37** | Someone leaves | "When Hamza changes teams, we change the key. He can't read anything anymore, and his rules stay." |
| **1:46** | Proof | "Measured in rehearsal: ten seconds to the answer. It runs locally, it's encrypted before it leaves, and it measures the process, never the person." |
| **1:55** | Final frame | "friction-assist. **Every friction, paid only once.** Thank you." |

About 290 words in 2 minutes.

## Tips

- **Rehearse twice with the film.** The film keeps its own pace: if a line runs long, cut words rather than speed up.
- **← →** jump scenes if the film needs to catch up with the speaker.
- The film shows a small note on each scene (**"Real screenshots · fictional data"** or **"Illustration based on the real process"**). If the jury asks what is real, point to it.
- **Without Internet:** play the guided tour instead (`./teamstore/start.sh`, then `http://127.0.0.1:4322/parcours`). The names differ: Debora is Léa, Hamza is Karim, Adam is Yasmine.

## If there are 3 minutes instead of 2

After 1:55, before "Thank you", add the live proof and our honest numbers (about 35 s):

> "And this isn't just a film. Last night, in rehearsal on Andrea's computer, the real Screenpipe read Crisp, judged the search and showed Jean's record ten seconds after the gesture. Our numbers, as they are: when the agent speaks up, it's right seven times out of ten; it still misses one friction in two, and that's our next job. Everything lives in Screenpipe: notifications, Live Views, its model. And we're proposing three improvements to them, including the fix for buttons on Mac."

## Ready answers (2 minutes of questions)

- **"Are you monitoring employees?"** No. We count detours per process step, never per person. Team data carries no identity, and the server only sees encrypted, same-size blocks. There is consent and a pause button.
- **"Does it really work?"** Yes for instant help: rehearsed end to end on 17/10 evening, the customer record shown 10 s after the search. The model judges an episode in 2.6 s (median). Sharing between colleagues was measured at 7 s, then 4 s, on the previous storage; it still has to be re-measured between two real machines.
- **"How reliable is detection?"** On 172 labelled episodes: precision 0.71, recall 0.46. When the agent speaks up it is usually right, but it misses about half the frictions. Labels were set by Claude and reviewed by Andrea.
- **"What if the AI invents a rule?"** It only proposes. Nothing enters team memory without the manager. A rule containing a name, an email or a phone number is rejected.
- **"Is the night loop reliable?"** 28 out of 28 correct, but **on cases we wrote ourselves**. Say it as is.
- **"Why not send the question right away?"** In a team of five, the time of a message is enough to guess who is stuck. The product adds a random 10 to 60 s delay, turned off for the demo.

## Check as a team before saying it on stage

- **"Three improvements"**: never say "no fork". The Mac demo uses a patched Screenpipe; we **propose** the fix to them.
- **"Last night, for real"**: true as of 18/10 (rehearsal on 17/10 at 23:43). If the morning rehearsal fails, drop the sentence.
- **Names**: the film says Debora, Hamza, Adam; Andrea's live demo and the guided tour say Léa, Karim, Yasmine. Pick one cast for the stage.
