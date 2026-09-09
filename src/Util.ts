export function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function extractKey(html: string) {
  const skss = html.indexOf("eval(function(p,a,c,k,e,d)");
  const skse = html.indexOf("</script>", skss);
  const sks = html.substring(skss, skse).replace("eval", "");

  const skds = eval(sks);

  const sksl = skds.indexOf("'");
  const skel = skds.indexOf(";");

  const skrs = skds.substring(sksl, skel);

  return eval(skrs) as string;
}

export function convertAssToVtt(ass: string): string {
  const lines = ass.split(/\r?\n/);
  const output: string[] = ["WEBVTT", ""];

  for (const line of lines) {
    if (!line.startsWith("Dialogue:")) {
      continue;
    }

    const parts = line.split(",");

    if (parts.length < 10) {
      continue;
    }

    const start = assTimeToVtt(parts[1]);
    const end = assTimeToVtt(parts[2]);

    const text = parts
      .slice(9)
      .join(",")
      .replace(/\\N/g, "\n")
      .replace(/\{[^}]*\}/g, "");

    output.push(`${start} --> ${end}`);
    output.push(text);
    output.push("");
  }

  return output.join("\n");
}

export function assTimeToVtt(time: string): string {
  const match = time.trim().match(/(\d+):(\d+):(\d+)\.(\d+)/);

  if (!match) {
    return "00:00:00.000";
  }

  const [, h, m, s, cs] = match;

  return (
    `${h.padStart(2, "0")}:` +
    `${m.padStart(2, "0")}:` +
    `${s.padStart(2, "0")}.` +
    `${cs.padEnd(3, "0")}`
  );
}
