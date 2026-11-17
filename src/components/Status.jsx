export const Status = ({ on, yes = 'Active', no = 'Inactive' }) => <span className={`pill ${on ? 'ok' : 'off'}`}>{on ? yes : no}</span>

// one colour: Selected solid accent, Scheduled soft accent, the rest neutral
const TONES = { Scheduled: 'info', Completed: 'off', Selected: 'strong', Rejected: 'off', 'No show': 'off' }
export const InterviewStatus = ({ value }) => <span className={`pill ${TONES[value] || 'off'}`}>{value}</span>
