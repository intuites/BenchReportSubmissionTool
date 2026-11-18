import { useEffect, useState } from "react";
import { CheckCircle2, Mail, Send } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useLive } from "../lib/live";
import { fmtDate } from "../lib/period";
import { SkeletonLine, SkeletonRows } from "../components/Loading";
import PageHead from "../components/PageHead";

const PRESETS = [1, 2, 3, 5, 7];
const plural = (n) => `${n} day${n === 1 ? "" : "s"}`;

export default function Settings({ admin }) {
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(null);
  const [due, setDue] = useState(null);
  const [log, setLog] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [s, d, l] = await Promise.all([
      supabase.from("bt_settings").select("*").eq("id", 1).single(),
      supabase
        .from("bt_followups_due")
        .select("*")
        .order("days_idle", { ascending: false }),
      supabase
        .from("bt_followup_log")
        .select(
          "id, sent_at, days_idle, candidates:bt_candidates(name), recruiters:bt_recruiters(name)",
        )
        .order("sent_at", { ascending: false })
        .limit(8),
    ]);
    const failed = [s, d, l].find((r) => r.error);
    if (failed) return setError(failed.error.message);
    setSettings(s.data);
    setSaved(s.data);
    setDue(d.data);
    setLog(l.data);
  }
  useEffect(() => {
    load();
  }, []);
  // live: who is due and what was sent refresh in place; the rule's fields only when nobody is
  // part-way through changing them
  useLive(["bt_settings", "bt_followup_log", "bt_candidates", "bt_submissions", "bt_recruiters"], async () => {
    const [s, d, l] = await Promise.all([
      supabase.from("bt_settings").select("*").eq("id", 1).single(),
      supabase.from("bt_followups_due").select("*").order("days_idle", { ascending: false }),
      supabase
        .from("bt_followup_log")
        .select("id, sent_at, days_idle, candidates:bt_candidates(name), recruiters:bt_recruiters(name)")
        .order("sent_at", { ascending: false })
        .limit(8),
    ]);
    if (!d.error) setDue(d.data);
    if (!l.error) setLog(l.data);
    if (!s.error && !changed) { setSettings(s.data); setSaved(s.data); }
  });

  const days = Math.max(1, Number(settings?.followup_days) || 1);
  const changed =
    settings &&
    saved &&
    (Number(settings.followup_days) !== Number(saved.followup_days) ||
      settings.followup_enabled !== saved.followup_enabled);

  async function save(e) {
    e.preventDefault();
    setMsg("");
    setSaving(true);
    const { error } = await supabase
      .from("bt_settings")
      .update({
        followup_days: days,
        followup_enabled: settings.followup_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) return setError(error.message);
    setMsg("Saved");
    load();
  }

  // The preview is the real email for the first recruiter with overdue candidates, else a sample
  const first = due?.[0];
  const mail = first
    ? {
        to: first.recruiter_name,
        email: first.recruiter_email,
        items: due
          .filter((d) => d.recruiter_id === first.recruiter_id)
          .map((d) => ({
            name: d.candidate_name,
            skill: d.skill,
            days: d.days_idle,
          })),
      }
    : {
        to: "Abdul Rahaman",
        email: "abdul@yourcompany.com",
        sample: true,
        items: [{ name: "Anshu", skill: "Java Full Stack", days: days + 1 }],
      };

  return (
    <section className="page">
      <PageHead
        title="Follow-ups"
        subtitle="Email a recruiter when an assigned candidate goes too long without a submission"
      >
        {saved && (
          <span className={`pill ${saved.followup_enabled ? "ok" : "off"}`}>
            {saved.followup_enabled
              ? `On · after ${plural(saved.followup_days)}`
              : "Off"}
          </span>
        )}
      </PageHead>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <form className="card rule-bar" onSubmit={save} aria-busy={!settings}>
        {/* only admins change the rule; the database refuses anyone else */}
        <fieldset className="rule-fieldset" disabled={!admin}>
        {!settings ? (
          <SkeletonLine width="60%" height={40} />
        ) : (
          <>
            <label className="switch">
              <input
                type="checkbox"
                role="switch"
                checked={settings.followup_enabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    followup_enabled: e.target.checked,
                  })
                }
              />
              <span className="switch-track" aria-hidden>
                <i />
              </span>
              Automatic emails
            </label>
            <div
              className={`rule-days ${settings.followup_enabled ? "" : "is-off"}`}
            >
              <span id="days-label">Email after</span>
              <div className="days" role="group" aria-labelledby="days-label">
                {PRESETS.map((n) => (
                  <button
                    type="button"
                    key={n}
                    aria-pressed={days === n}
                    className={days === n ? "on" : ""}
                    onClick={() =>
                      setSettings({ ...settings, followup_days: n })
                    }
                  >
                    {n}
                  </button>
                ))}
                <input
                  id="days"
                  type="number"
                  min={1}
                  max={30}
                  placeholder="Other"
                  aria-label="Other number of days"
                  value={
                    PRESETS.includes(Number(settings.followup_days))
                      ? ""
                      : settings.followup_days
                  }
                  onChange={(e) =>
                    setSettings({ ...settings, followup_days: e.target.value })
                  }
                />
              </div>
              <span>days without a submission</span>
            </div>
            <div className="rule-save">
              {msg && !changed && <span className="good small">{msg}</span>}
              {!admin && <span className="muted small">Only admins change the rule</span>}
              {admin && <button
                className="btn primary"
                disabled={!changed || saving}
                aria-busy={saving}
              >
                Save rule
              </button>}
            </div>
          </>
        )}
        </fieldset>
      </form>

      <div className="followups">
        <div className="side-stack">
          <div className="card">
            <header className="card-head">
              <h2>
                Due now{" "}
                {due?.length > 0 && <span className="count">{due.length}</span>}
              </h2>
              <span className="muted small">Emailed weekdays at 14:00 UTC</span>
            </header>
            {!due ? (
              <table className="table">
                <tbody>
                  <SkeletonRows cols={3} rows={3} />
                </tbody>
              </table>
            ) : due.length === 0 ? (
              <p className="empty-line good">
                <CheckCircle2 size={18} strokeWidth={1.5} /> No one is overdue
              </p>
            ) : (
              <ul className="due-list">
                {due.map((d) => (
                  <li key={d.candidate_id}>
                    <div className="due-main">
                      <strong>{d.candidate_name}</strong>
                      <span className="sub">
                        Last activity {fmtDate(d.last_activity)} ·{" "}
                        {d.recruiter_name}
                      </span>
                    </div>
                    <span
                      className={`idle-days ${d.days_idle >= 14 ? "long" : ""}`}
                    >
                      {plural(d.days_idle)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <header className="card-head">
              <h2>Recently sent</h2>
            </header>
            {!log ? (
              <table className="table">
                <tbody>
                  <SkeletonRows cols={3} rows={2} />
                </tbody>
              </table>
            ) : log.length === 0 ? (
              <p className="empty-line">
                <Send size={16} strokeWidth={1.5} /> No follow-ups sent yet
              </p>
            ) : (
              <ul className="due-list">
                {log.map((l) => (
                  <li key={l.id}>
                    <div className="due-main">
                      <strong>{l.candidates?.name}</strong>
                      <span className="sub">
                        to {l.recruiters?.name} · {plural(l.days_idle)} idle
                      </span>
                    </div>
                    <span className="muted small nowrap">
                      {new Date(l.sent_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card email-card">
          <header className="card-head">
            <h2>
              <Mail size={16} strokeWidth={1.5} /> Email preview
            </h2>
            <span className="muted small">
              {mail.sample
                ? "Sample"
                : `Next email to ${mail.to.split(" ")[0]}`}
            </span>
          </header>
          <div className="email">
            <dl className="email-meta">
              <dt>From</dt>
              <dd>Bench Tracker</dd>
              <dt>To</dt>
              <dd>
                {mail.to} <span className="muted">&lt;{mail.email}&gt;</span>
              </dd>
              <dt>Subject</dt>
              <dd>
                <strong>
                  {mail.items.length === 1
                    ? `Update needed: no submissions for ${mail.items[0].name} in ${plural(mail.items[0].days)}`
                    : `Update needed: no submissions for ${mail.items.length} of your candidates`}
                </strong>
              </dd>
            </dl>
            <div className="email-body">
              <p>Hi {mail.to},</p>
              <p>
                These candidates assigned to you have had no submissions for{" "}
                {plural(days)} or more:
              </p>
              <ul>
                {mail.items.slice(0, 5).map((i) => (
                  <li key={i.name}>
                    <strong>{i.name}</strong>
                    {i.skill ? ` (${i.skill})` : ""}: no submissions in{" "}
                    {plural(i.days)}
                  </li>
                ))}
                {mail.items.length > 5 && (
                  <li className="muted">and {mail.items.length - 5} more</li>
                )}
              </ul>
              <p>
                Please reply with an update: why no submissions were made, and
                your plan for each candidate.
              </p>
              <p className="muted">Bench Tracker</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
