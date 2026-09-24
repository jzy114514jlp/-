export type NoticeField = {
  value: string;
  evidence: string;
  edited?: boolean;
};

export type NoticeTask = {
  id: string;
  text: string;
  evidence: string;
  done: boolean;
};

export type NoticeCard = {
  title: NoticeField;
  eventTime: NoticeField | null;
  place: NoticeField | null;
  deadline: NoticeField | null;
  participation: NoticeField | null;
  tasks: NoticeTask[];
  original: string;
};

function field(value: string, evidence: string): NoticeField {
  return { value: value.trim().replace(/\s+/g, " "), evidence: evidence.trim() };
}

function segments(source: string): string[] {
  return source
    .split(/[\n。！？；;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function labeled(source: string, names: string[]): NoticeField | null {
  const pattern = new RegExp(`(?:^|[\\n。；;])\\s*(?:${names.join("|")})\\s*[:：]\\s*([^\\n。；;]+)`, "i");
  const match = source.match(pattern);
  if (!match) return null;
  return field(match[1], match[0].trim().replace(/^[。；;]\s*/, ""));
}

function findDeadline(parts: string[], source: string): NoticeField | null {
  const named = labeled(source, ["报名截止时间", "报名截止日期", "报名截止", "截止时间", "截止日期", "截止"]);
  if (named) return named;
  const dateBefore = /(?:(?:20\d{2})\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}\s*日(?:\s*\d{1,2}\s*(?::|：|时)\s*\d{0,2}\s*分?)?\s*前/;
  for (const part of parts) {
    if (!/(报名|提交|申请|填报|缴费|登记)/.test(part)) continue;
    const match = part.match(dateBefore);
    if (match) return field(match[0], part);
  }
  return null;
}

function findEventTime(parts: string[], source: string): NoticeField | null {
  const named = labeled(source, ["活动时间", "举办时间", "活动日期", "日期", "时间"]);
  if (named) return named;
  const date = /(?:(?:20\d{2})\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}\s*日/;
  const part = parts.find((item) => /(活动|讲座|比赛|课程|会议|展览|举办|举行)/.test(item) && date.test(item) && !/(截止|报名前)/.test(item));
  if (!part) return null;
  const match = part.match(date);
  return match ? field(part.slice(match.index), part) : null;
}

function findPlace(parts: string[], source: string): NoticeField | null {
  const named = labeled(source, ["活动地点", "举办地点", "集合地点", "地点", "地址"]);
  if (named) return named;
  for (const part of parts) {
    const match = part.match(/在([^，,。；;]{2,36}?)(?:举行|举办|开展|进行)/);
    if (match) return field(match[1], part);
  }
  return null;
}

function findActions(parts: string[]): NoticeTask[] {
  const actions = parts.filter((part) => /(扫描|填写|提交|上传|携带|领取|请于|请在|请到|联系|点击|前往)/.test(part));
  const unique = [...new Set(actions)].slice(0, 3);
  if (!unique.length) return [{ id: "task-1", text: "阅读原文，确认自己需要完成的步骤", evidence: "", done: false }];
  return unique.map((part, index) => ({ id: `task-${index + 1}`, text: part.replace(/^[▪•\-\s]+/, ""), evidence: part, done: false }));
}

export function extractNotice(source: string): NoticeCard {
  const original = source.trim();
  const parts = segments(original);
  const first = parts[0] ?? "未命名通知";
  const titleText = first
    .replace(/^[▪•\-\s]+/, "")
    .split(/正式开启|正式开始|，|,/)[0]
    .trim()
    .slice(0, 48) || "未命名通知";

  return {
    title: field(titleText, first),
    eventTime: findEventTime(parts, original),
    place: findPlace(parts, original),
    deadline: findDeadline(parts, original),
    participation: labeled(original, ["参与方式", "报名方式", "参加方式", "参与条件", "报名条件"]),
    tasks: findActions(parts),
    original,
  };
}
