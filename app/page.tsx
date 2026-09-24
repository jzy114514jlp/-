"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle, ArrowUpRight, CalendarDays, Check, ClipboardList, FileImage,
  ImagePlus, LoaderCircle, MapPin, Pencil, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { extractNotice, type NoticeCard, type NoticeField } from "@/lib/notice";
import { makeEventIcs, parseEventDates } from "@/lib/calendar";

const demoNotice = `Edge Future 2026 边缘未来黑客松正式开启招募，欢迎对 AI、技术、设计和创新实践感兴趣的同学参与。\n你是否有一个一直想实现的创意？一款解决身边问题的小工具，一种展示荆州的新方式，或一个让生活更便利的想法……\n本次活动设置两大赛道：荆州奇旅、科技向善。\n活动时间：2026 年 9 月 30 日至 10 月 2 日\n活动地点：荆州大学城城市展厅\n参与方式：支持个人报名，也可 2–5 人组队参加。\n扫描招募海报中的二维码，即可填写报名信息。`;

type EditableKey = "title" | "eventTime" | "place" | "deadline" | "participation";

function Evidence({ item }: { item: NoticeField | null }) {
  if (!item?.evidence) return item?.edited ? <p className="mt-1 text-sm text-[#667e9b]">已手动填写</p> : null;
  return <p className="mt-2 border-l-2 border-[#d4dff2] pl-2 text-sm leading-5 text-[#71849e]">依据：{item.evidence}</p>;
}

function Fact({ label, item, empty, editing, onChange, icon: Icon }: {
  label: string;
  item: NoticeField | null;
  empty: string;
  editing: boolean;
  onChange: (value: string) => void;
  icon?: typeof CalendarDays;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[#e1e8f2] bg-[#f8faff] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#647a97]">{Icon && <Icon size={16} />} {label}</p>
      {editing ? <Input aria-label={label} value={item?.value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder={empty} className="mt-2 h-10 border-[#b9c9e1] bg-white text-base md:text-base" /> :
        <p className={`mt-2 break-words text-base font-semibold leading-6 ${item?.value ? "text-[#172c4a]" : "text-[#8a5d19]"}`}>{item?.value || empty}</p>}
      {!editing && <Evidence item={item} />}
    </div>
  );
}

export default function Home() {
  const [noticeText, setNoticeText] = useState("");
  const [card, setCard] = useState<NoticeCard | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const resultSection = useRef<HTMLElement>(null);

  function produceCard(text: string) {
    const clean = text.trim();
    if (!clean) { setStatus("请先粘贴通知文字，或上传一张截图。"); return; }
    setCard(extractNotice(clean));
    setEditing(false);
    setStatus("已整理。请对照原文核对重要信息。");
    if (window.innerWidth < 1024) setTimeout(() => resultSection.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function updateField(key: EditableKey, value: string) {
    setCard((current) => {
      if (!current) return null;
      const next = { value, evidence: current[key]?.evidence ?? "", edited: true };
      return { ...current, [key]: key === "title" || value.trim() ? next : null };
    });
  }

  function updateTask(id: string, patch: { done?: boolean; text?: string }) {
    setCard((current) => current ? { ...current, tasks: current.tasks.map((task) => task.id === id ? { ...task, ...patch } : task) } : null);
  }

  async function readImage(file: File) {
    if (!file.type.startsWith("image/")) { setStatus("请选择图片文件。"); return; }
    if (file.size > 10 * 1024 * 1024) { setStatus("图片请小于 10 MB。"); return; }
    setBusy(true);
    setStatus("正在浏览器中识别图片文字；首次使用需要下载识字模型。");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("chi_sim");
      try {
        const result = await worker.recognize(file);
        const recognized = result.data.text
          .replace(/([\u3400-\u9fff])[ \t]+(?=[\u3400-\u9fff])/g, "$1")
          .replace(/[ \t]+([：:])/g, "$1")
          .trim();
        if (!recognized) throw new Error("没有识别到文字");
        setNoticeText(recognized);
        produceCard(recognized);
        setStatus(`已从 ${file.name} 识别 ${recognized.split(/\n/).filter(Boolean).length} 行文字。请核对识别结果。`);
      } finally {
        await worker.terminate();
      }
    } catch (error) {
      setStatus(`截图识别失败：${error instanceof Error ? error.message : "请换一张清晰截图"}。也可以直接粘贴文字。`);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function exportCalendar() {
    if (!card) return;
    const ics = makeEventIcs(card);
    if (!ics) { setStatus("活动时间需要写明年份、月份和日期，才能导出日历。"); return; }
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "别漏事-活动日历.ics";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("日历文件已下载。导入日历时请再次核对日期。");
  }

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "organize_notice",
      title: "整理通知",
      description: "把一段中文通知整理成可核对的行动卡，并显示在页面上。",
      inputSchema: { type: "object", properties: { text: { type: "string", minLength: 1 } }, required: ["text"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input: unknown) {
        if (!input || typeof input !== "object" || !("text" in input) || typeof input.text !== "string" || !input.text.trim()) throw new Error("请提供通知文字");
        const text = input.text.trim();
        setNoticeText(text);
        const result = extractNotice(text);
        setCard(result);
        setEditing(false);
        setStatus("已整理。请对照原文核对重要信息。");
        return { title: result.title.value, eventTime: result.eventTime?.value ?? null, place: result.place?.value ?? null, deadline: result.deadline?.value ?? null, taskCount: result.tasks.length };
      },
    }, { signal: lifecycle.signal })).catch(() => {});
    return () => lifecycle.abort();
  }, []);

  const canExport = Boolean(card?.eventTime && parseEventDates(card.eventTime.value));

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-[#16243a]">
      <header className="border-b border-[#dce4ef] bg-white">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#2456d8] text-white"><ClipboardList size={22} strokeWidth={2.2} /></span>
            <div><p className="text-[19px] font-bold leading-6">别漏事</p><p className="text-xs text-[#667994]">通知整理小工具</p></div>
          </div>
          <span className="rounded-full border border-[#dce4ef] px-3 py-1.5 text-sm text-[#526680]">浏览器本地处理</span>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-5 pb-12 pt-8 md:px-8 md:pt-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold tracking-[0.08em] text-[#2456d8]">把通知变成清楚的下一步</p>
            <h1 className="text-[29px] font-bold leading-tight tracking-tight md:text-[37px]">看完通知，知道该做什么。</h1>
            <p className="mt-3 text-base text-[#5a6c85]">粘贴群公告或上传截图，核对时间、地点和待办。</p>
          </div>
          <Button variant="outline" className="h-10 border-[#c8d7f0] bg-white px-4 text-[#2456d8] hover:bg-[#eef4ff]" onClick={() => { setNoticeText(demoNotice); produceCard(demoNotice); }}>
            试用黑客松通知 <ArrowUpRight size={16} />
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
          <section className="overflow-hidden rounded-[22px] border border-[#dce4ef] bg-white shadow-[0_14px_45px_rgba(28,58,107,.06)]" aria-labelledby="input-title">
            <div className="flex items-center justify-between border-b border-[#e7edf5] px-5 py-5 md:px-7">
              <div><p className="text-xs font-bold text-[#2456d8]">01 / 输入通知</p><h2 id="input-title" className="mt-1 text-xl font-bold">放进一条通知</h2></div>
              <span className="flex size-9 items-center justify-center rounded-lg bg-[#edf3ff] text-[#2456d8]"><ImagePlus size={19} /></span>
            </div>
            <div className="p-5 md:p-7">
              <label htmlFor="notice" className="mb-2 block text-sm font-semibold text-[#344a67]">通知内容</label>
              <Textarea id="notice" value={noticeText} onChange={(event) => setNoticeText(event.target.value)} placeholder="把群公告、活动招募或办事通知粘贴在这里…" className="min-h-[300px] resize-y rounded-xl border-[#cfd9e8] bg-[#fbfcff] p-4 text-base leading-7 placeholder:text-[#8a99ad] focus-visible:border-[#2456d8] focus-visible:ring-[#2456d8]/20" />
              <input ref={fileInput} type="file" accept="image/*" aria-label="选择通知截图" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImage(file); }} />
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()} className="min-h-14 justify-start rounded-xl border-dashed border-[#a9bee7] bg-[#f6f9ff] px-4 text-sm font-semibold text-[#2456d8] hover:bg-[#edf3ff]"><FileImage size={19} /> 上传通知截图</Button>
                <Button className="min-h-14 rounded-xl bg-[#2456d8] text-base font-semibold hover:bg-[#1945b6]" onClick={() => produceCard(noticeText)} disabled={busy || !noticeText.trim()}>{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Sparkles size={17} />} 整理成行动卡</Button>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#72849c]">图片在浏览器内识别；首次使用需下载识字模型。整理结果请对照原文核查。</p>
              {status && <p role="status" aria-live="polite" className="mt-4 rounded-xl bg-[#edf3ff] px-4 py-3 text-sm leading-6 text-[#234b9c]">{status}</p>}
            </div>
          </section>

          <section ref={resultSection} className="overflow-hidden rounded-[22px] border border-[#dce4ef] bg-white shadow-[0_14px_45px_rgba(28,58,107,.06)]" aria-labelledby="result-title">
            <div className="flex items-center justify-between border-b border-[#e7edf5] px-5 py-5 md:px-7">
              <div><p className="text-xs font-bold text-[#2456d8]">02 / 核对行动</p><h2 id="result-title" className="mt-1 text-xl font-bold">行动卡</h2></div>
              {card && <Button variant="ghost" className="h-9 text-[#2456d8] hover:bg-[#edf3ff]" onClick={() => setEditing((value) => !value)}>{editing ? <Check size={17} /> : <Pencil size={17} />}{editing ? "完成" : "修改"}</Button>}
            </div>
            {card ? <div className="p-5 md:p-7">
              <div className="rounded-2xl bg-[#132846] px-5 py-6 text-white">
                <p className="text-sm text-[#b7c9e9]">通知主题</p>
                {editing ? <Input aria-label="通知主题" value={card.title.value} onChange={(event) => updateField("title", event.target.value)} className="mt-2 h-11 border-[#6c86ad] bg-white text-base text-[#16243a] md:text-base" /> : <h3 className="mt-2 break-words text-[22px] font-bold leading-snug">{card.title.value || "未命名通知"}</h3>}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Fact label="活动时间" item={card.eventTime} empty="原文未提及" editing={editing} onChange={(value) => updateField("eventTime", value)} icon={CalendarDays} />
                <Fact label="活动地点" item={card.place} empty="原文未提及" editing={editing} onChange={(value) => updateField("place", value)} icon={MapPin} />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Fact label="参与方式" item={card.participation} empty="原文未提及" editing={editing} onChange={(value) => updateField("participation", value)} />
                <Fact label="报名截止" item={card.deadline} empty="原文未提及，需自行确认" editing={editing} onChange={(value) => updateField("deadline", value)} />
              </div>

              {!card.deadline?.value && !editing && <div className="mt-4 flex gap-3 rounded-xl border border-[#f4d899] bg-[#fff9ea] p-4 text-[#8d5a0b]"><AlertCircle className="mt-0.5 shrink-0" size={19} /><div><p className="font-semibold">报名截止时间未写明</p><p className="mt-1 text-sm leading-6">请查看原海报或向主办方确认，不要根据活动日期猜测。</p></div></div>}

              <h4 className="mb-3 mt-6 font-bold">我需要做什么</h4>
              <div className="space-y-2">
                {card.tasks.map((task) => <div key={task.id} className="flex items-start gap-3 rounded-xl border border-[#dce4ef] p-4">
                  <Checkbox checked={task.done} onCheckedChange={(checked) => updateTask(task.id, { done: checked === true })} aria-label={`完成：${task.text}`} className="mt-1 size-5" />
                  <div className="min-w-0 flex-1">
                    {editing ? <Input aria-label="待办内容" value={task.text} onChange={(event) => updateTask(task.id, { text: event.target.value })} className="h-10 text-base md:text-base" /> : <p className={`break-words leading-6 ${task.done ? "text-[#8a9bb0] line-through" : "text-[#263b58]"}`}>{task.text}</p>}
                    {!editing && task.evidence && <p className="mt-2 text-sm leading-5 text-[#71849e]">依据：{task.evidence}</p>}
                  </div>
                </div>)}
              </div>

              <Button variant="outline" disabled={!canExport} onClick={exportCalendar} className="mt-5 h-11 w-full rounded-xl border-[#c8d7f0] text-[#2456d8] hover:bg-[#edf3ff]"><CalendarDays size={17} /> 导出活动日历</Button>
              {!canExport && <p className="mt-2 text-center text-sm text-[#71849e]">导出需要明确的年份、月份和日期，可点“修改”补充。</p>}
              {canExport && <p className="mt-2 text-center text-sm text-[#71849e]">活动前一天提醒；导入日历时请核对日期。</p>}
              <details className="mt-6 rounded-xl border border-[#e1e8f2] p-4 text-sm"><summary className="cursor-pointer font-semibold text-[#4d6584]">查看原通知</summary><p className="mt-3 whitespace-pre-wrap break-words leading-6 text-[#5b6f88]">{card.original}</p></details>
            </div> : <div className="flex min-h-[460px] flex-col items-center justify-center px-8 text-center"><span className="flex size-16 items-center justify-center rounded-2xl bg-[#edf3ff] text-[#2456d8]"><ClipboardList size={28} /></span><h3 className="mt-5 text-lg font-bold">你的行动卡会出现在这里</h3><p className="mt-2 max-w-xs text-base leading-7 text-[#71839b]">放入一条通知，先看清时间地点，再确认每一步要做的事。</p></div>}
          </section>
        </div>
      </div>
    </main>
  );
}
