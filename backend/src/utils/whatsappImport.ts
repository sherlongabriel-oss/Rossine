export interface ParsedWhatsappMessage {
  timestamp: string;
  sender: string;
  body: string;
}

const LINE_START_RE =
  /^(\d{1,2}\/\d{1,2}\/\d{2,4})(?:,)?\s+(\d{1,2}:\d{2})(?::(\d{2}))?\s+-\s+(.*)$/;

function toIsoDate(datePart: string, timePart: string, secondsPart?: string) {
  const [day, month, yearRaw] = datePart.split("/").map((v) => Number(v));
  const [hour, minute] = timePart.split(":").map((v) => Number(v));
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  const second = secondsPart ? Number(secondsPart) : 0;
  return new Date(year, month - 1, day, hour, minute, second).toISOString();
}

function isSystemLine(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("mensagens e chamadas sao protegidas") ||
    lower.includes("mensagens e chamadas estao protegidas") ||
    lower.includes("messages and calls are end-to-end encrypted") ||
    lower.includes("mudou o nome do grupo") ||
    lower.includes("mudou o assunto do grupo")
  );
}

export function parseWhatsappExport(text: string): ParsedWhatsappMessage[] {
  const lines = text.split(/\r?\n/);
  const result: ParsedWhatsappMessage[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    const match = line.match(LINE_START_RE);
    if (!match) {
      const last = result[result.length - 1];
      if (last) {
        last.body = `${last.body}\n${line}`.trim();
      }
      continue;
    }

    const datePart = match[1];
    const timePart = match[2];
    const secondsPart = match[3];
    const rest = match[4] || "";

    if (isSystemLine(rest)) continue;

    const separatorIndex = rest.indexOf(":");
    if (separatorIndex === -1) {
      result.push({
        timestamp: toIsoDate(datePart, timePart, secondsPart),
        sender: "Sistema",
        body: rest.trim(),
      });
      continue;
    }

    const sender = rest.slice(0, separatorIndex).trim();
    const body = rest.slice(separatorIndex + 1).trim();

    result.push({
      timestamp: toIsoDate(datePart, timePart, secondsPart),
      sender: sender || "Sistema",
      body: body || "(sem texto)",
    });
  }

  return result;
}
