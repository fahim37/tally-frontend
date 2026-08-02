"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
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

  const hasAnything = state.expenses.some((e) => !e.deletedAt);

  if (!hasAnything) {
    return (
      <div className="px-5 pt-6 pb-8">
        <PageHeader title="Insights" />
        {/* Every panel here is a comparison — this week against last, a
            forecast from the pace so far, an outlier against its category's
            own history. None of them mean anything without days behind them,
            and a week summary reading "৳0 against ৳0" is worse than saying so. */}
        <EmptyState
          icon="warning"
          title="Nothing to compare yet."
          body="Once there are a few days logged, this reads back what changed week to week, where the month is heading, and anything that looks unusual for you."
          action={{ href: "/", label: "Log something" }}
        />
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <PageHeader title="Insights" />

      {/* Weekly summary */}
      <Card className="mb-3" title={`Week of ${summary.rangeLabel}`}>
        {summary.sentences.map((sentence, index) => (
          <p
            key={sentence}
            className={
              index === 0
                ? "mb-3 font-display text-subhead font-normal"
                : "mb-3 text-label leading-[1.55] last:mb-0"
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
            <span style={{ color: "var(--amber-text)" }}>
              <Icon name="warning" size={15} strokeWidth={2} />
            </span>
            <span
              className="text-eyebrow uppercase"
              style={{ color: "var(--amber-text)" }}
            >
              Unusual
            </span>
          </div>

          <p className="text-label" style={{ color: "var(--text)" }}>
            {formatMoney(anomaly.amountMinor, currency)} on {anomaly.name.toLowerCase()},{" "}
            {shortDate(anomaly.localDate)}. {anomaly.reason}
          </p>
        </div>
      ))}

      {/* Forecast */}
      <Card className="mb-3" title="Month-end forecast">
        <div className="mb-3.5 flex items-baseline gap-2.5">
          <span
            className="font-display text-display tabular-nums"
            style={{ color: forecast.isOver ? "var(--amber-text)" : "var(--teal-text)" }}
          >
            {formatMoney(forecast.projectedMinor, currency)}
          </span>
          {forecast.limitMinor > 0 && (
            <span className="text-body" style={{ color: "var(--muted)" }}>
              of {formatMoney(forecast.limitMinor, currency)}
            </span>
          )}
        </div>

        {forecast.limitMinor > 0 && (
          <div
            className="relative mb-2.5 h-2.5 rounded-pill"
            style={{ background: "var(--bg)" }}
          >
            {/* scaleX rather than width: a width transition relayouts and
                repaints the bar every frame. */}
            <div
              className="absolute top-0 left-0 h-2.5 w-full origin-left rounded-pill"
              style={{
                transform: `scaleX(${Math.min(1, forecast.ratio)})`,
                background: forecast.isOver ? "var(--amber)" : "var(--teal)",
                transition: "transform var(--dur-slow) var(--ease-out)",
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

        <p className="text-body leading-[1.45]" style={{ color: "var(--muted)" }}>
          {forecast.sentence}
        </p>
      </Card>

      {/* Ask */}
      <Card title="Ask about your money">
        <label
          htmlFor="ask-input"
          className="mb-3 flex cursor-text items-center gap-2.5 rounded-card border px-3.5 py-3"
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
            className="min-w-0 flex-1 bg-transparent text-label outline-none"
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
            className="mb-3 rounded-card p-3.5 text-label"
            style={{ background: "var(--sky)", color: "var(--text)" }}
          >
            {answer}
          </p>
        )}

        {unanswered && (
          <p
            className="mb-3 rounded-card p-3.5 text-body"
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
              className="tap-target rounded-pill px-3 py-2 text-meta"
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
