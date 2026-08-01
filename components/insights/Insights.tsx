"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Icon, SearchIcon } from "@/components/ui/Icon";
import { useTally } from "@/lib/store/TallyProvider";
import {
  answerLocally,
  findAnomalies,
  forecastInsight,
  weeklySummary,
} from "@/lib/insights";
import { formatMoney } from "@/lib/money";
import { shortDate } from "@/lib/date";

const SUGGESTIONS = [
  "How much on tea in the last 3 months?",
  "How much on transport this month?",
  "Total in the last 7 days",
];

export function Insights() {
  const { state } = useTally();
  const currency = state.profile.currency;

  const summary = useMemo(() => weeklySummary(state), [state]);
  const forecast = useMemo(() => forecastInsight(state), [state]);
  const anomalies = useMemo(() => findAnomalies(state), [state]);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [unanswered, setUnanswered] = useState(false);

  const ask = (text: string) => {
    setQuestion(text);
    const local = answerLocally(text, state);
    setAnswer(local);
    // Anything the local engine can't parse is what the AI endpoint is for.
    setUnanswered(local === null && text.trim().length > 0);
  };

  return (
    <div className="px-5 pb-8 pt-6">
      <PageHeader title="Insights" />

      {/* Weekly summary */}
      <Card className="mb-3" title={`Week of ${summary.rangeLabel}`}>
        {summary.sentences.map((sentence, index) => (
          <p
            key={sentence}
            className={
              index === 0
                ? "mb-3 font-display text-[17px] leading-[1.5] tracking-[-0.01em]"
                : "mb-3 text-[15px] leading-[1.55] last:mb-0"
            }
            style={{ color: "var(--text)" }}
          >
            {sentence}
          </p>
        ))}
      </Card>

      {/* Unusual */}
      {anomalies.map((anomaly) => (
        <div
          key={anomaly.id}
          className="mb-3 rounded-card border p-4"
          style={{
            background: "var(--surf)",
            borderColor: "var(--line)",
            borderLeft: "3px solid var(--amber)",
          }}
        >
          <div className="mb-2.5 flex items-center gap-2">
            <span style={{ color: "var(--amber)" }}>
              <Icon name="warning" size={15} strokeWidth={2} />
            </span>
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--amber)" }}
            >
              Unusual
            </span>
          </div>

          <p className="text-[14px] leading-[1.5]" style={{ color: "var(--text)" }}>
            {formatMoney(anomaly.amountMinor, currency)} on {anomaly.name.toLowerCase()},{" "}
            {shortDate(anomaly.localDate)}. {anomaly.reason}
          </p>
        </div>
      ))}

      {/* Forecast */}
      <Card className="mb-3" title="Month-end forecast">
        <div className="mb-3.5 flex items-baseline gap-2.5">
          <span
            className="font-display text-[34px] font-semibold leading-none tracking-[-0.035em] tabular-nums"
            style={{ color: forecast.isOver ? "var(--amber)" : "var(--teal)" }}
          >
            {formatMoney(forecast.projectedMinor, currency)}
          </span>
          {forecast.limitMinor > 0 && (
            <span className="text-[13px]" style={{ color: "var(--muted)" }}>
              of {formatMoney(forecast.limitMinor, currency)}
            </span>
          )}
        </div>

        {forecast.limitMinor > 0 && (
          <div
            className="relative mb-2.5 h-2.5 rounded-pill"
            style={{ background: "var(--bg)" }}
          >
            <div
              className="absolute left-0 top-0 h-2.5 rounded-pill"
              style={{
                width: `${Math.min(100, forecast.ratio * 100)}%`,
                background: forecast.isOver ? "var(--amber)" : "var(--teal)",
              }}
            />
            {/* Where the month actually is right now, against the projection. */}
            <div
              className="absolute w-0.5"
              style={{
                left: `${forecast.elapsedRatio * 100}%`,
                top: -4,
                height: 18,
                background: "var(--text)",
              }}
            />
          </div>
        )}

        <p className="text-[13px] leading-[1.45]" style={{ color: "var(--muted)" }}>
          {forecast.sentence}
        </p>
      </Card>

      {/* Ask */}
      <Card title="Ask about your money">
        <label
          htmlFor="ask-input"
          className="mb-3 flex cursor-text items-center gap-2.5 rounded-[14px] border px-3.5 py-3"
          style={{ background: "var(--bg)", borderColor: "var(--line)" }}
        >
          <span style={{ color: "var(--faint)" }}>
            <SearchIcon size={17} />
          </span>
          <input
            id="ask-input"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && ask(question)}
            placeholder="How much on tea last 3 months?"
            aria-label="Ask about your money"
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
            style={{ color: "var(--text)" }}
          />
          <button type="button" onClick={() => ask(question)} aria-label="Ask" className="tap-target px-1.5">
            <span style={{ color: "var(--blue)" }}>
              <Icon name="arrowRight" size={17} strokeWidth={1.9} />
            </span>
          </button>
        </label>

        {answer && (
          <p
            className="mb-3 rounded-[13px] p-3.5 text-[14px] leading-[1.5]"
            style={{ background: "var(--sky)", color: "var(--text)" }}
          >
            {answer}
          </p>
        )}

        {unanswered && (
          <p
            className="mb-3 rounded-[13px] p-3.5 text-[13px] leading-[1.5]"
            style={{ background: "var(--bg)", color: "var(--muted)" }}
          >
            That one needs the AI service, which isn&apos;t connected yet. Questions like
            &ldquo;how much on tea in the last 3 months&rdquo; are answered from your own data
            right now.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => ask(suggestion)}
              className="tap-target rounded-pill px-3 py-2 text-[12px]"
              style={{ background: "var(--sky)", color: "var(--text)" }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default Insights;
