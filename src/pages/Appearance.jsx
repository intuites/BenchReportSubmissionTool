import { useEffect, useState } from 'react'
import { confirmDialog } from '../components/Confirm'
import { Monitor, Moon, RotateCcw, Sun } from 'lucide-react'
import { FONTS, RADII, SIZES, fontHref, usePrefs } from '../lib/prefs'
import { ACCENT_GROUPS, ALL_ACCENTS } from '../lib/accents'
import ColourSelect from '../components/ColourSelect'
import PageHead from '../components/PageHead'
import Segmented from '../components/Segmented'

const MODES = [['system', 'System', Monitor, 'Follows your computer'], ['light', 'Light', Sun, 'Off-white ground'], ['dark', 'Dark', Moon, 'Warm charcoal']]
const SIZE_LABELS = { s: 'Small', m: 'Default', l: 'Large', xl: 'Extra large' }
const RADIUS_LABELS = { sharp: 'Sharp', crisp: 'Crisp', soft: 'Soft', round: 'Round', pill: 'Extra round' }

// A setting: its name and a line on the left, the control on the right (wide controls go under the words)
function Row({ label, note, wide, children }) {
  return (
    <div className={`set-row ${wide ? 'set-row--wide' : ''}`}>
      <span className="set-label"><b>{label}</b>{note && <small>{note}</small>}</span>
      <div className="set-control">{children}</div>
    </div>
  )
}

// An on/off setting: the whole row is the switch's label
function Toggle({ label, note, checked, onChange }) {
  return (
    <label className="set-row set-row--switch">
      <span className="set-label"><b>{label}</b>{note && <small>{note}</small>}</span>
      <span className="switch">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch-track" aria-hidden><i /></span>
      </span>
    </label>
  )
}

function Group({ title, children }) {
  return (
    <section className="set-group">
      <h2>{title}</h2>
      <div className="card set-card">{children}</div>
    </section>
  )
}

const SYNC = { local: 'Saved on this device', loading: 'Loading your saved look', saved: 'Saved to your account, on every device', saving: 'Saving to your account', error: 'Saved on this device. Run supabase/schema.sql to save it to your account' }

export default function Appearance({ admin }) {
  const { prefs, set, reveal, reset, resolved, sync, team, setTeamDefault } = usePrefs()
  const [teamMsg, setTeamMsg] = useState('')
  const [teamBusy, setTeamBusy] = useState(false)
  async function saveTeam(p) {
    setTeamBusy(true); setTeamMsg('')
    try { await setTeamDefault(p); setTeamMsg(Object.keys(p).length ? 'This look is now the team default' : 'Team default cleared') }
    catch (e) { setTeamMsg(e.message) }
    setTeamBusy(false)
  }

  // Load every Google typeface once so each card previews in its own letters
  useEffect(() => {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: fontHref(Object.keys(FONTS)) })
    document.head.appendChild(link)
    return () => link.remove()
  }, [])

  const font = FONTS[prefs.fonts]

  return (
    <section className="page">
      <PageHead title="Appearance" subtitle={<>Your own look: colours, typeface and sizes. <span className={`sync sync--${sync}`}>{SYNC[sync]}</span></>}>
        <button className="btn" onClick={reset}><RotateCcw size={15} /> {team ? 'Reset to team default' : 'Reset to default'}</button>
      </PageHead>

      <div className="look">
        <div className="look-main">
          <Group title="Colour">
            <Row label="Theme" note="Light, dark, or whichever your computer uses" wide>
              <div className="mode-grid" role="group" aria-label="Colour mode">
                {MODES.map(([id, label, Icon, note]) => (
                  <button key={id} type="button" className={`mode-card mode-card--${id}`} aria-pressed={prefs.mode === id} onClick={(e) => reveal({ mode: id }, e)}>
                    <span className="mode-thumb" aria-hidden><i /><i /><i /></span>
                    <span className="mode-label"><Icon size={15} strokeWidth={1.5} /> {label}</span>
                    <small>{note}</small>
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Accent colour" note={`The main button, links, focus and the current page. ${ALL_ACCENTS.length} colours, each tested to read in light and dark`} wide>
              <ColourSelect groups={ACCENT_GROUPS} value={prefs.accent} onChange={(accent) => set({ accent })} label="Accent colour" />
            </Row>
          </Group>

          <Group title="Type">
            <Row label="Typeface" note={`${Object.keys(FONTS).length} grotesk and sans families for the whole app`} wide>
              <div className="font-grid" role="group" aria-label="Typeface">
                {Object.entries(FONTS).map(([id, f]) => (
                  <button key={id} type="button" className="font-card" aria-pressed={prefs.fonts === id} onClick={() => set({ fonts: id })} style={{ fontFamily: `'${f.name}', system-ui` }}>
                    <span className="aa" aria-hidden>Aa</span>
                    <span className="font-text">
                      <span className="font-name">{f.name}</span>
                      <small>{f.note}{f.italic ? '' : ' · no true italic'}</small>
                    </span>
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Interface size" note="Scales everything, so tables and buttons stay in proportion">
              <Segmented label="Interface size" items={Object.keys(SIZES).map((id) => [id, SIZE_LABELS[id]])} value={prefs.size} onChange={(size) => set({ size })} />
            </Row>
            <Toggle
              label="Italic headings"
              note={font.italic ? `Page titles and figures in ${font.name} Italic` : `${font.name} has no true italic, so headings are slanted`}
              checked={prefs.italic}
              onChange={(italic) => set({ italic })}
            />
          </Group>

          <Group title="Layout">
            <Row label="Corners" note="How round buttons, fields and cards are" wide>
              <div className="radius-grid" role="group" aria-label="Corners">
                {Object.entries(RADII).map(([id, r]) => (
                  <button key={id} type="button" className="radius-card" aria-pressed={prefs.radius === id} onClick={() => set({ radius: id })}>
                    <span className="radius-demo" style={{ borderRadius: Math.round(r * 0.75) }} aria-hidden />
                    <span>{RADIUS_LABELS[id]}</span>
                    <small>{r}px</small>
                  </button>
                ))}
              </div>
            </Row>
            <Toggle label="Compact tables" note="Shorter rows, more records on screen" checked={prefs.density === 'compact'} onChange={(on) => set({ density: on ? 'compact' : 'comfortable' })} />
          </Group>

          <Group title="Accessibility">
            <Toggle label="Higher contrast" note="Darker secondary text and stronger lines" checked={prefs.contrast === 'high'} onChange={(on) => set({ contrast: on ? 'high' : 'normal' })} />
            <Toggle label="Reduce motion" note="No sliding, rolling or fading. Your computer's setting is respected too; the calendar's burst and drop pet stop only with this switch" checked={prefs.motion === 'reduced'} onChange={(on) => set({ motion: on ? 'reduced' : 'full' })} />
          </Group>

          {admin && (
            <Group title="Team default">
              <Row label="Starting look" note={`${team ? `Set: ${FONTS[team.fonts]?.name ?? 'Host Grotesk'}, ${ALL_ACCENTS.find(([, c]) => c === team.accent)?.[0] ?? team.accent ?? 'default colour'}, ${team.mode ?? 'system'} theme` : 'Not set: the app default applies'}. New members, and anyone who has not chosen their own look, start with it`} wide>
                <div className="team-default">
                  <div className="preview-actions">
                    <button type="button" className="btn primary" disabled={teamBusy} aria-busy={teamBusy} onClick={() => saveTeam(prefs)}>Use my look as the team default</button>
                    {team && <button type="button" className="btn" disabled={teamBusy} onClick={async () => { if (await confirmDialog('Clear the team default?', { body: 'New members, and anyone who has not chosen their own look, go back to the app default. Nobody loses the look they picked themselves.', confirm: 'Clear default', cancel: 'Keep it' })) saveTeam({}) }}>Clear team default</button>}
                  </div>
                  {teamMsg && <span className="small good">{teamMsg}</span>}
                </div>
              </Row>
            </Group>
          )}
        </div>

        <aside className="preview-panel" aria-label="Preview">
          <div className="preview-head">
            <h2>Preview</h2>
            <span className="muted small">{FONTS[prefs.fonts].name} · {SIZE_LABELS[prefs.size]}</span>
          </div>
          <div className="preview-a">
            <p className="preview-title">Interviews this month</p>
          <div className="card figures">
            <div className="figure accent"><span>Interviews</span><strong>17</strong><small>+4 vs last month</small></div>
            <div className="figure"><span>Submissions</span><strong>38</strong><small>+6 vs last month</small></div>
          </div>
          </div>
          <div className="preview-b">
          <div className="preview-actions">
            <button type="button" className="btn primary">Log submission</button>
            <button type="button" className="btn">Cancel</button>
          </div>
          <div className="chips">
            <span className="pill strong">Selected</span><span className="pill info">Scheduled</span><span className="pill off">Completed</span><span className="idle-days long">14 days idle</span>
          </div>
          <div className="card">
            <table className="table">
              <tbody>
                <tr><td><strong>Abdul Rahman</strong><div className="sub">Imran to Cognizant</div></td><td className="num">$65/hr</td></tr>
                <tr><td><strong>Anshuman Mishra</strong><div className="sub">Tanvi to Infosys</div></td><td className="num">$60/hr</td></tr>
              </tbody>
            </table>
          </div>
          <p className="preview-link">Links look <a href="#appearance" onClick={(e) => e.preventDefault()}>like this</a></p>
          </div>
        </aside>
      </div>
    </section>
  )
}
