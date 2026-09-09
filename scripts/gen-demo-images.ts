import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";

const demos = [
  {
    key: "dry-tap",
    prompt:
      "Resident smartphone photo: a kitchen tap held open with a hand, completely dry, no water coming out, dim evening kitchen light, realistic amateur photo, slightly grainy",
  },
  {
    key: "leak-street",
    prompt:
      "Resident smartphone photo: quiet suburban Johannesburg street at dusk, dry tar road and grass verge, no water visible, parked cars, realistic amateur photo",
  },
  {
    key: "burst-pipe",
    prompt:
      "Documentary photo: burst water pipe flooding a township road intersection in South Africa, water pooling across the road, daytime, realistic",
  },
  {
    key: "reservoir",
    prompt:
      "Close-up smartphone photo of a round water pressure gauge on a household pipe, needle near the low end, morning light, realistic amateur photo",
  },
];

async function main() {
  const zai = await ZAI.create();
  fs.mkdirSync("public/demo", { recursive: true });
  for (const d of demos) {
    const out = `public/demo/${d.key}.jpg`;
    if (fs.existsSync(out)) {
      console.log("skip", d.key);
      continue;
    }
    try {
      const res = await zai.images.generations.create({
        prompt: d.prompt,
        size: "1152x864",
      });
      const b64 = res.data?.[0]?.base64;
      if (!b64) throw new Error("no base64 in response");
      fs.writeFileSync(out, Buffer.from(b64, "base64"));
      console.log("OK", d.key, fs.statSync(out).size, "bytes");
    } catch (e) {
      console.error("FAIL", d.key, String(e).slice(0, 200));
    }
  }
}

main();
